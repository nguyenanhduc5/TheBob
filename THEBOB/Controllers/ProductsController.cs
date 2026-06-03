using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using System.Security.Claims;

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

        // GET: api/products
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            var products = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.Sizes)
                .ToListAsync();
            return Ok(products);
        }

        // GET: api/products/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Product>> GetProduct(int id)
        {
            var product = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.Sizes)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            return Ok(product);
        }

        // GET: api/products/search?query=&categoryId=&color=&minPrice=&maxPrice=
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<Product>>> SearchProducts(
            [FromQuery] string? query,
            [FromQuery] int? categoryId,
            [FromQuery] string? color,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice)
        {
            var productsQuery = _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.Sizes)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(query))
            {
                productsQuery = productsQuery.Where(p =>
                    p.Name.Contains(query) ||
                    p.Description.Contains(query));
            }

            if (categoryId.HasValue)
            {
                productsQuery = productsQuery.Where(p => p.CategoryId == categoryId.Value);
            }

            if (!string.IsNullOrWhiteSpace(color))
            {
                productsQuery = productsQuery.Where(p => p.Color == color);
            }

            if (minPrice.HasValue)
            {
                productsQuery = productsQuery.Where(p => p.Price >= minPrice.Value);
            }

            if (maxPrice.HasValue)
            {
                productsQuery = productsQuery.Where(p => p.Price <= maxPrice.Value);
            }

            var products = await productsQuery.ToListAsync();
            return Ok(products);
        }

        // GET: api/products/categories
        [HttpGet("categories")]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            var categories = await _context.Categories.OrderBy(c => c.Name).ToListAsync();
            return Ok(categories);
        }

        // POST: api/products
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Product>> CreateProduct([FromBody] ProductCreateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var product = new Product
            {
                Name = request.Name,
                Sku = request.Sku,
                Description = request.Description,
                Brand = request.Brand,
                Material = request.Material,
                Color = request.Color,
                CareInstructions = request.CareInstructions,
                Price = request.Price,
                Stock = request.Stock,
                MainImageUrl = request.MainImageUrl,
                IsFeatured = request.IsFeatured,
                CategoryId = request.CategoryId,
                Rating = request.Rating,
                ReviewCount = request.ReviewCount,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (request.ImageUrls != null)
            {
                product.Images = request.ImageUrls.Select((url, index) => new ProductImage
                {
                    Url = url,
                    SortOrder = index
                }).ToList();
            }

            if (request.Sizes != null)
            {
                product.Sizes = request.Sizes.Take(5).Select(size => new ProductSize
                {
                    SizeValue = size
                }).ToList();
            }

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            await LogInventoryChange(product.Id, InventoryChangeType.Added, product.Stock, "New product created", GetCurrentUserId());

            var createdProduct = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.Sizes)
                .FirstOrDefaultAsync(p => p.Id == product.Id);

            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, createdProduct);
        }

        // PUT: api/products/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] ProductUpdateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var product = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.Sizes)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            var stockDifference = request.Stock - product.Stock;

            product.Name = request.Name;
            product.Sku = request.Sku;
            product.Description = request.Description;
            product.Brand = request.Brand;
            product.Material = request.Material;
            product.Color = request.Color;
            product.CareInstructions = request.CareInstructions;
            product.Price = request.Price;
            product.Stock = request.Stock;
            product.MainImageUrl = request.MainImageUrl;
            product.IsFeatured = request.IsFeatured;
            product.CategoryId = request.CategoryId;
            product.Rating = request.Rating;
            product.ReviewCount = request.ReviewCount;
            product.UpdatedAt = DateTime.UtcNow;

            // Replace images
            if (request.ImageUrls != null)
            {
                _context.ProductImages.RemoveRange(product.Images);
                product.Images = request.ImageUrls.Take(10).Select((url, index) => new ProductImage
                {
                    Url = url,
                    SortOrder = index
                }).ToList();
            }

            // Replace sizes
            if (request.Sizes != null)
            {
                _context.ProductSizes.RemoveRange(product.Sizes);
                product.Sizes = request.Sizes.Take(5).Select(size => new ProductSize
                {
                    SizeValue = size
                }).ToList();
            }

            try
            {
                await _context.SaveChangesAsync();

                if (stockDifference != 0)
                {
                    var changeType = stockDifference > 0 ? InventoryChangeType.Added : InventoryChangeType.Adjusted;
                    await LogInventoryChange(id, changeType, stockDifference, "Product updated", GetCurrentUserId());
                }
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Products.Any(e => e.Id == id))
                    return NotFound();
                throw;
            }

            return NoContent();
        }

        // DELETE: api/products/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.Sizes)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return NotFound();

            _context.ProductImages.RemoveRange(product.Images);
            _context.ProductSizes.RemoveRange(product.Sizes);
            _context.Products.Remove(product);
            await _context.SaveChangesAsync();

            await LogInventoryChange(id, InventoryChangeType.Adjusted, -product.Stock, "Product deleted", GetCurrentUserId());

            return NoContent();
        }

        private async Task LogInventoryChange(int productId, InventoryChangeType changeType, int quantityChanged, string reason, int? userId)
        {
            var log = new InventoryLog
            {
                ProductId = productId,
                ChangeType = changeType,
                QuantityChanged = quantityChanged,
                Reason = reason,
                UserId = userId
            };

            _context.InventoryLogs.Add(log);
            await _context.SaveChangesAsync();
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? int.Parse(userIdClaim) : null;
        }
    }

    public class ProductCreateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Brand { get; set; } = string.Empty;
        public string Material { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public string CareInstructions { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public string MainImageUrl { get; set; } = string.Empty;
        public bool IsFeatured { get; set; }
        public int? CategoryId { get; set; }
        public double Rating { get; set; }
        public int ReviewCount { get; set; }
        public List<string>? ImageUrls { get; set; }
        public List<string>? Sizes { get; set; }
    }

    public class ProductUpdateRequest : ProductCreateRequest
    {
    }
}
