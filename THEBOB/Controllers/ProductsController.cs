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

        [HttpPost("colors")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Color>> CreateColor([FromBody] Color color)
        {
            if (color == null || string.IsNullOrWhiteSpace(color.Name))
                return BadRequest(new { success = false, message = "Tên màu là bắt buộc" });

            var exists = await _context.Colors.AnyAsync(c => c.Name.ToLower() == color.Name.ToLower());
            if (exists) return BadRequest(new { success = false, message = "Màu này đã tồn tại" });

            _context.Colors.Add(color);
            await _context.SaveChangesAsync();
            return Ok(color);
        }

        [HttpPost("sizes")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Size>> CreateSize([FromBody] Size size)
        {
            if (size == null || string.IsNullOrWhiteSpace(size.Name))
                return BadRequest(new { success = false, message = "Tên kích thước là bắt buộc" });

            var exists = await _context.Sizes.AnyAsync(s => s.Name.ToLower() == size.Name.ToLower());
            if (exists) return BadRequest(new { success = false, message = "Kích thước này đã tồn tại" });

            _context.Sizes.Add(size);
            await _context.SaveChangesAsync();
            return Ok(size);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> CreateProduct([FromBody] ProductCreateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (request.Variants == null || !request.Variants.Any())
                return BadRequest(new { message = "Product must have at least one variant." });

            var validationError = ValidateProductRequest(request);
            if (validationError != null)
                return BadRequest(new { message = validationError });

            var requestSkus = request.Variants.Select(v => v.Sku!.Trim()).ToList();
            if (requestSkus.Count != requestSkus.Distinct(StringComparer.OrdinalIgnoreCase).Count())
            {
                return BadRequest(new { message = "Các mã SKU của các biến thể không được trùng nhau." });
            }

            var skus = request.Variants.Select(v => v.Sku!.Trim().ToLower()).ToList();
            var existingVariant = await _context.ProductVariants
                .FirstOrDefaultAsync(v => skus.Contains(v.Sku.ToLower()));
            if (existingVariant != null)
            {
                return BadRequest(new { message = $"Mã SKU '{existingVariant.Sku}' đã tồn tại ở một sản phẩm khác." });
            }

            var product = new Product
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim() ?? string.Empty,
                BrandId = request.BrandId,
                Material = request.Material?.Trim() ?? string.Empty,
                CareInstructions = request.CareInstructions?.Trim() ?? string.Empty,
                MainImageUrl = request.MainImageUrl?.Trim() ?? string.Empty,
                IsFeatured = request.IsFeatured,
                IsAvailable = request.IsAvailable,
                CategoryId = request.CategoryId,
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
                product.ProductVariants.Add(CreateVariant(product, variantRequest));
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

            var validationError = ValidateProductRequest(request);
            if (validationError != null)
                return BadRequest(new { message = validationError });

            if (request.Variants != null)
            {
                var requestSkus = request.Variants.Select(v => v.Sku!.Trim()).ToList();
                if (requestSkus.Count != requestSkus.Distinct(StringComparer.OrdinalIgnoreCase).Count())
                {
                    return BadRequest(new { message = "Các mã SKU của các biến thể không được trùng nhau." });
                }

                var skus = request.Variants.Select(v => v.Sku!.Trim().ToLower()).ToList();
                var existingVariant = await _context.ProductVariants
                    .FirstOrDefaultAsync(v => skus.Contains(v.Sku.ToLower()) && v.ProductId != id);
                if (existingVariant != null)
                {
                    return BadRequest(new { message = $"Mã SKU '{existingVariant.Sku}' đã tồn tại ở một sản phẩm khác." });
                }
            }

            var product = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Images)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            product.Name = request.Name.Trim();
            product.Description = request.Description?.Trim() ?? string.Empty;
            product.BrandId = request.BrandId;
            product.Material = request.Material?.Trim() ?? string.Empty;
            product.CareInstructions = request.CareInstructions?.Trim() ?? string.Empty;
            product.MainImageUrl = request.MainImageUrl?.Trim() ?? string.Empty;
            product.IsFeatured = request.IsFeatured;
            product.IsAvailable = request.IsAvailable;
            product.CategoryId = request.CategoryId;
            product.UpdatedAt = DateTime.UtcNow;

            if (request.ImageUrls != null)
            {
                _context.ProductImages.RemoveRange(product.Images);
                product.Images.Clear();
                foreach (var item in request.ImageUrls.Where(url => !string.IsNullOrWhiteSpace(url)).Select((url, index) => new { url, index }))
                {
                    product.Images.Add(new ProductImage { Url = item.url.Trim(), SortOrder = item.index });
                }
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
                        product.ProductVariants.Add(CreateVariant(product, variantRequest));
                        continue;
                    }

                    existing.SizeId = variantRequest.SizeId!.Value;
                    existing.ColorId = variantRequest.ColorId!.Value;
                    existing.Price = variantRequest.Price;
                    existing.Stock = variantRequest.Stock;
                    existing.Sku = variantRequest.Sku!.Trim();
                    existing.IsAvailable = variantRequest.IsAvailable ?? variantRequest.Stock > 0;
                    existing.IsDeleted = false;
                    existing.DeletedAt = null;
                    existing.UpdatedAt = DateTime.UtcNow;
                    ReplaceVariantImages(existing, variantRequest.ImageUrls);
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
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Images)
                .AsSplitQuery();
        }

        private static ProductVariant CreateVariant(Product product, VariantItemDto variantRequest)
        {
            var variant = new ProductVariant
            {
                Product = product,
                SizeId = variantRequest.SizeId!.Value,
                ColorId = variantRequest.ColorId!.Value,
                Price = variantRequest.Price,
                Stock = variantRequest.Stock,
                Sku = variantRequest.Sku!.Trim(),
                IsAvailable = variantRequest.IsAvailable ?? variantRequest.Stock > 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            ReplaceVariantImages(variant, variantRequest.ImageUrls);
            return variant;
        }

        private static void ReplaceVariantImages(ProductVariant variant, List<string>? imageUrls)
        {
            variant.Images.Clear();
            if (imageUrls == null) return;

            foreach (var image in imageUrls.Where(url => !string.IsNullOrWhiteSpace(url)).Select((url, index) => new { url, index }))
            {
                variant.Images.Add(new ProductVariantImage
                {
                    Url = image.url.Trim(),
                    SortOrder = image.index,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        private static string? ValidateProductRequest(ProductCreateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return "Product name is required.";

            if (!request.BrandId.HasValue)
                return "BrandId is required.";

            if (!request.CategoryId.HasValue)
                return "CategoryId is required.";

            if (request.Variants == null || request.Variants.Count == 0)
                return "Product must have at least one variant.";

            foreach (var variant in request.Variants)
            {
                if (!variant.ColorId.HasValue)
                    return "Variant ColorId is required.";

                if (!variant.SizeId.HasValue)
                    return "Variant SizeId is required.";

                if (string.IsNullOrWhiteSpace(variant.Sku))
                    return "Variant SKU is required.";

                if (variant.Price <= 0)
                    return "Variant price must be greater than 0.";

                if (variant.Stock < 0)
                    return "Variant stock cannot be negative.";
            }

            return null;
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
                minPrice,
                maxPrice = activeVariants.Count == 0 ? 0 : activeVariants.Max(v => v.Price),
                price = minPrice,
                totalStock = activeVariants.Sum(v => v.Stock),
                stock = activeVariants.Sum(v => v.Stock),
                rating = p.Rating,
                reviewCount = p.ReviewCount,
                images = p.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder }),
                variants = activeVariants.Select(v => new
                {
                    v.Id,
                    v.SizeId,
                    size = v.Size?.Name ?? string.Empty,
                    v.ColorId,
                    color = v.Color?.Name ?? string.Empty,
                    hexCode = v.Color?.HexCode ?? string.Empty,
                    v.Price,
                    v.Sku,
                    v.Stock,
                    v.IsAvailable,
                    images = v.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder })
                }),
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
                    v.IsAvailable,
                    images = v.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder })
                }),
                sizes = activeVariants
                    .Where(v => v.Size != null)
                    .Select(v => new { id = v.SizeId, sizeValue = v.Size!.Name })
                    .Distinct(),
                isFeatured = p.IsFeatured,
                isAvailable = p.IsAvailable,
                categoryId = p.CategoryId,
                category = p.Category?.Name ?? string.Empty,
                categoryName = p.Category?.Name ?? string.Empty,
                brandName = p.Brand?.Name ?? string.Empty,
                variantCount = activeVariants.Count
            };
        }
    }

    public class ProductCreateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? BrandId { get; set; }
        public string? Material { get; set; }
        public string? CareInstructions { get; set; }
        public string? MainImageUrl { get; set; }
        public bool IsFeatured { get; set; }
        public bool IsAvailable { get; set; } = true;
        public int? CategoryId { get; set; }
        public List<string>? ImageUrls { get; set; }
        public List<VariantItemDto>? Variants { get; set; }
    }

    public class VariantItemDto
    {
        public int? Id { get; set; }
        public int? SizeId { get; set; }
        public int? ColorId { get; set; }
        public decimal Price { get; set; }
        public string? Sku { get; set; }
        public int Stock { get; set; }
        public bool? IsAvailable { get; set; }
        public List<string>? ImageUrls { get; set; }
    }

    public class ProductUpdateRequest : ProductCreateRequest { }
}
