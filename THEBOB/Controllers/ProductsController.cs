using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public ProductsController(ThebobDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetProducts()
        {
            var products = await ProductQuery().ToListAsync();
            return Ok(products.Select(ToProductDto));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetProduct(int id)
        {
            if (id <= 0)
                return BadRequest(new { error = "Product ID must be greater than 0" });

            var product = await ProductQuery().FirstOrDefaultAsync(p => p.Id == id);
            if (product == null)
                return NotFound(new { error = $"Product with ID {id} not found" });

            return Ok(ToProductDto(product));
        }

        [HttpGet("categories")]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            var categories = await _context.Categories
                .OrderBy(c => c.Name)
                .ToListAsync();

            return Ok(categories);
        }

        [HttpGet("brands")]
        public async Task<ActionResult<IEnumerable<Brand>>> GetBrands()
        {
            return Ok(await _context.Brands.OrderBy(b => b.Name).ToListAsync());
        }

        [HttpGet("sizes")]
        public async Task<ActionResult<IEnumerable<Size>>> GetSizes()
        {
            return Ok(await _context.Sizes.OrderBy(s => s.Name).ToListAsync());
        }

        [HttpGet("colors")]
        public async Task<ActionResult<IEnumerable<Color>>> GetColors()
        {
            return Ok(await _context.Colors.OrderBy(c => c.Name).ToListAsync());
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> CreateProduct([FromBody] ProductCreateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (request.Variants == null || !request.Variants.Any())
                return BadRequest(new { message = "Product must have at least one variant." });

            var product = new Product
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim() ?? string.Empty,
                BrandId = await ResolveBrandId(request.BrandId, request.Brand),
                Material = request.Material?.Trim() ?? string.Empty,
                CareInstructions = request.CareInstructions?.Trim() ?? string.Empty,
                MainImageUrl = request.MainImageUrl?.Trim() ?? string.Empty,
                IsFeatured = request.IsFeatured,
                CategoryId = request.CategoryId,
                Rating = request.Rating,
                ReviewCount = request.ReviewCount,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (request.ImageUrls != null)
            {
                product.Images = request.ImageUrls
                    .Where(url => !string.IsNullOrWhiteSpace(url))
                    .Select((url, index) => new ProductImage { Url = url.Trim(), SortOrder = index })
                    .ToList();
            }

            foreach (var variantRequest in request.Variants)
            {
                var variant = await CreateVariant(product, request.Sku, variantRequest, request.Price);
                product.ProductVariants.Add(variant);
            }

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            var createdProduct = await ProductQuery().FirstAsync(p => p.Id == product.Id);
            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, ToProductDto(createdProduct));
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] ProductUpdateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var product = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.ProductVariants)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            product.Name = request.Name.Trim();
            product.Description = request.Description?.Trim() ?? string.Empty;
            product.BrandId = await ResolveBrandId(request.BrandId, request.Brand);
            product.Material = request.Material?.Trim() ?? string.Empty;
            product.CareInstructions = request.CareInstructions?.Trim() ?? string.Empty;
            product.MainImageUrl = request.MainImageUrl?.Trim() ?? string.Empty;
            product.IsFeatured = request.IsFeatured;
            product.CategoryId = request.CategoryId;
            product.Rating = request.Rating;
            product.ReviewCount = request.ReviewCount;
            product.UpdatedAt = DateTime.UtcNow;

            if (request.ImageUrls != null)
            {
                _context.ProductImages.RemoveRange(product.Images);
                product.Images = request.ImageUrls
                    .Where(url => !string.IsNullOrWhiteSpace(url))
                    .Select((url, index) => new ProductImage { Url = url.Trim(), SortOrder = index })
                    .ToList();
            }

            if (request.Variants != null)
            {
                var requestIds = request.Variants.Where(v => v.Id.HasValue).Select(v => v.Id!.Value).ToHashSet();

                foreach (var existing in product.ProductVariants.Where(v => !requestIds.Contains(v.Id)))
                {
                    existing.IsDeleted = true;
                    existing.IsAvailable = false;
                    existing.DeletedAt = DateTime.UtcNow;
                    existing.UpdatedAt = DateTime.UtcNow;
                }

                foreach (var variantRequest in request.Variants)
                {
                    var existing = variantRequest.Id.HasValue
                        ? product.ProductVariants.FirstOrDefault(v => v.Id == variantRequest.Id.Value)
                        : null;

                    if (existing == null)
                    {
                        product.ProductVariants.Add(await CreateVariant(product, request.Sku, variantRequest, request.Price));
                        continue;
                    }

                    existing.SizeId = await ResolveSizeId(variantRequest.SizeId, variantRequest.Size);
                    existing.ColorId = await ResolveColorId(variantRequest.ColorId, variantRequest.Color, variantRequest.HexCode);
                    existing.Price = variantRequest.Price ?? request.Price;
                    existing.Stock = variantRequest.Stock;
                    existing.Sku = BuildSku(request.Sku, variantRequest);
                    existing.IsAvailable = variantRequest.IsAvailable ?? variantRequest.Stock > 0;
                    existing.IsDeleted = false;
                    existing.DeletedAt = null;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products
                .Include(p => p.ProductVariants)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            product.IsDeleted = true;
            product.DeletedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;

            foreach (var variant in product.ProductVariants)
            {
                variant.IsDeleted = true;
                variant.IsAvailable = false;
                variant.DeletedAt = DateTime.UtcNow;
                variant.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<object>>> Search(
            [FromQuery] string? query,
            [FromQuery] int? categoryId,
            [FromQuery] string? color,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice)
        {
            var q = ProductQuery();

            if (!string.IsNullOrWhiteSpace(query))
            {
                q = q.Where(p =>
                    p.Name.Contains(query) ||
                    p.Description.Contains(query) ||
                    p.ProductVariants.Any(v => v.Sku.Contains(query)));
            }

            if (categoryId.HasValue)
                q = q.Where(p => p.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(color))
                q = q.Where(p => p.ProductVariants.Any(v => v.Color != null && v.Color.Name == color));

            if (minPrice.HasValue || maxPrice.HasValue)
            {
                q = q.Where(p => p.ProductVariants.Any(v =>
                    (!minPrice.HasValue || v.Price >= minPrice.Value) &&
                    (!maxPrice.HasValue || v.Price <= maxPrice.Value)));
            }

            var products = await q.ToListAsync();
            return Ok(products.Select(ToProductDto));
        }

        private IQueryable<Product> ProductQuery()
        {
            return _context.Products
                .AsNoTracking()
                .Include(p => p.Brand)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Size)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Color)
                .AsSplitQuery();
        }

        private async Task<ProductVariant> CreateVariant(Product product, string? productSku, VariantItemDto variantRequest, decimal fallbackPrice)
        {
            return new ProductVariant
            {
                Product = product,
                SizeId = await ResolveSizeId(variantRequest.SizeId, variantRequest.Size),
                ColorId = await ResolveColorId(variantRequest.ColorId, variantRequest.Color, variantRequest.HexCode),
                Price = variantRequest.Price ?? fallbackPrice,
                Stock = variantRequest.Stock,
                Sku = BuildSku(productSku, variantRequest),
                IsAvailable = variantRequest.IsAvailable ?? variantRequest.Stock > 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
        }

        private async Task<int?> ResolveBrandId(int? brandId, string? brandName)
        {
            if (brandId.HasValue)
                return brandId.Value;

            if (string.IsNullOrWhiteSpace(brandName))
                return null;

            var normalized = brandName.Trim();
            var existing = await _context.Brands.FirstOrDefaultAsync(b => b.Name == normalized);
            if (existing != null)
                return existing.Id;

            var brand = new Brand { Name = normalized };
            _context.Brands.Add(brand);
            await _context.SaveChangesAsync();
            return brand.Id;
        }

        private async Task<int> ResolveSizeId(int? sizeId, string? sizeName)
        {
            if (sizeId.HasValue)
                return sizeId.Value;

            if (string.IsNullOrWhiteSpace(sizeName))
                throw new InvalidOperationException("Variant size is required.");

            var normalized = sizeName.Trim();
            var existing = await _context.Sizes.FirstOrDefaultAsync(s => s.Name == normalized);
            if (existing != null)
                return existing.Id;

            var size = new Size { Name = normalized };
            _context.Sizes.Add(size);
            await _context.SaveChangesAsync();
            return size.Id;
        }

        private async Task<int> ResolveColorId(int? colorId, string? colorName, string? hexCode)
        {
            if (colorId.HasValue)
                return colorId.Value;

            if (string.IsNullOrWhiteSpace(colorName))
                throw new InvalidOperationException("Variant color is required.");

            var normalized = colorName.Trim();
            var existing = await _context.Colors.FirstOrDefaultAsync(c => c.Name == normalized);
            if (existing != null)
                return existing.Id;

            var color = new Color { Name = normalized, HexCode = hexCode?.Trim() ?? string.Empty };
            _context.Colors.Add(color);
            await _context.SaveChangesAsync();
            return color.Id;
        }

        private static string BuildSku(string? productSku, VariantItemDto variantRequest)
        {
            if (!string.IsNullOrWhiteSpace(variantRequest.Sku))
                return variantRequest.Sku.Trim();

            var size = variantRequest.SizeId?.ToString() ?? variantRequest.Size ?? "SIZE";
            var color = variantRequest.ColorId?.ToString() ?? variantRequest.Color ?? "COLOR";
            var baseSku = string.IsNullOrWhiteSpace(productSku) ? "SKU" : productSku.Trim();
            return $"{baseSku}-{size}-{color}".ToUpperInvariant();
        }

        private static object ToProductDto(Product p)
        {
            var activeVariants = p.ProductVariants.Where(v => !v.IsDeleted).ToList();
            var minPrice = activeVariants.Count == 0 ? 0 : activeVariants.Min(v => v.Price);

            return new
            {
                id = p.Id,
                name = p.Name,
                sku = activeVariants.FirstOrDefault()?.Sku ?? string.Empty,
                description = p.Description,
                brandId = p.BrandId,
                brand = p.Brand?.Name ?? string.Empty,
                material = p.Material,
                careInstructions = p.CareInstructions,
                mainImageUrl = p.MainImageUrl,
                price = minPrice,
                stock = activeVariants.Sum(v => v.Stock),
                rating = p.Rating,
                reviewCount = p.ReviewCount,
                images = p.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder }),
                productVariants = activeVariants.Select(v => new
                {
                    v.Id,
                    v.SizeId,
                    Size = v.Size?.Name ?? string.Empty,
                    v.ColorId,
                    Color = v.Color?.Name ?? string.Empty,
                    HexCode = v.Color?.HexCode ?? string.Empty,
                    v.Price,
                    v.Sku,
                    v.Stock,
                    v.IsAvailable
                }),
                sizes = activeVariants
                    .Where(v => v.Size != null)
                    .Select(v => new { id = v.SizeId, sizeValue = v.Size!.Name })
                    .Distinct(),
                isFeatured = p.IsFeatured,
                categoryId = p.CategoryId,
                category = p.Category?.Name ?? string.Empty
            };
        }
    }

    public class ProductCreateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Sku { get; set; }
        public string? Description { get; set; }
        public int? BrandId { get; set; }
        public string? Brand { get; set; }
        public string? Material { get; set; }
        public string? CareInstructions { get; set; }
        public string? MainImageUrl { get; set; }
        public bool IsFeatured { get; set; }
        public int? CategoryId { get; set; }
        public double Rating { get; set; }
        public int ReviewCount { get; set; }
        public decimal Price { get; set; }
        public List<string>? ImageUrls { get; set; }
        public List<VariantItemDto>? Variants { get; set; }
    }

    public class VariantItemDto
    {
        public int? Id { get; set; }
        public int? SizeId { get; set; }
        public string? Size { get; set; }
        public int? ColorId { get; set; }
        public string? Color { get; set; }
        public string? HexCode { get; set; }
        public decimal? Price { get; set; }
        public string? Sku { get; set; }
        public int Stock { get; set; }
        public bool? IsAvailable { get; set; }
    }

    public class ProductUpdateRequest : ProductCreateRequest { }
}
