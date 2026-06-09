using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using System.Security.Claims;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System;

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

        // 1. LẤY DANH SÁCH TẤT CẢ SẢN PHẨM (KÈM VARIANT)
        // GET: api/products
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            var products = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.ProductVariants)
                .ToListAsync();
            return Ok(products);
        }

        // 2. LẤY CHI TIẾT 1 SẢN PHẨM THEO ID
        // GET: api/products/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Product>> GetProduct(int id)
        {
            var product = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.ProductVariants) // Đã loại bỏ .Include(p => p.Sizes) gây lỗi 500
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null) return NotFound();
            return Ok(product);
        }

        // ⭐ LẤY DANH SÁCH DANH MỤC CHO DROPDOWN FRONTEND
        // GET: api/products/categories
        [HttpGet("categories")]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            var categories = await _context.Categories
                .OrderBy(c => c.Name)
                .ToListAsync();
            return Ok(categories);
        }

        // 3. THÊM MỚI SẢN PHẨM VÀ CÁC BIẾN THỂ
        // POST: api/products
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Product>> CreateProduct([FromBody] ProductCreateRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var product = new Product
            {
                Name = request.Name,
                Sku = request.Sku,
                Description = request.Description ?? string.Empty,
                Brand = request.Brand ?? string.Empty,
                Material = request.Material ?? string.Empty,
                CareInstructions = request.CareInstructions ?? string.Empty,
                MainImageUrl = request.MainImageUrl ?? string.Empty,
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

            if (request.Variants != null && request.Variants.Any())
            {
                product.ProductVariants = request.Variants.Select(v => new ProductVariant
                {
                    Size = v.Size ?? string.Empty,
                    Color = v.Color ?? string.Empty,
                    Sku = string.IsNullOrWhiteSpace(v.Sku) ? $"{request.Sku}-{v.Size}-{v.Color}" : v.Sku,
                    Price = v.Price,
                    Stock = v.Stock,
                    IsAvailable = v.Stock > 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }).ToList();
            }

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            var createdProduct = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.ProductVariants) // Đã loại bỏ .Include(p => p.Sizes) gây lỗi 500
                .FirstOrDefaultAsync(p => p.Id == product.Id);

            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, createdProduct);
        }

        // 4. CẬP NHẬT SẢN PHẨM VÀ BIẾN THỂ
        // PUT: api/products/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] ProductUpdateRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var product = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.ProductVariants) // Đã loại bỏ .Include(p => p.Sizes) gây lỗi 500
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null) return NotFound();

            product.Name = request.Name;
            product.Sku = request.Sku;
            product.Description = request.Description ?? string.Empty;
            product.Brand = request.Brand ?? string.Empty;
            product.Material = request.Material ?? string.Empty;
            product.CareInstructions = request.CareInstructions ?? string.Empty;
            product.MainImageUrl = request.MainImageUrl ?? string.Empty;
            product.IsFeatured = request.IsFeatured;
            product.CategoryId = request.CategoryId;
            product.Rating = request.Rating;
            product.ReviewCount = request.ReviewCount;
            product.UpdatedAt = DateTime.UtcNow;

            if (request.ImageUrls != null)
            {
                _context.ProductImages.RemoveRange(product.Images);
                product.Images = request.ImageUrls.Select((url, index) => new ProductImage { Url = url, SortOrder = index }).ToList();
            }

            if (request.Variants != null)
            {
                _context.ProductVariants.RemoveRange(product.ProductVariants);
                product.ProductVariants = request.Variants.Select(v => new ProductVariant
                {
                    Size = v.Size ?? string.Empty,
                    Color = v.Color ?? string.Empty,
                    Sku = string.IsNullOrWhiteSpace(v.Sku) ? $"{request.Sku}-{v.Size}-{v.Color}" : v.Sku,
                    Price = v.Price,
                    Stock = v.Stock,
                    IsAvailable = v.Stock > 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }).ToList();
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // 5. XÓA SẢN PHẨM
        // DELETE: api/products/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.ProductVariants) // Đã loại bỏ .Include(p => p.Sizes) gây lỗi 500
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null) return NotFound();

            _context.ProductVariants.RemoveRange(product.ProductVariants);
            _context.ProductImages.RemoveRange(product.Images);
            _context.Products.Remove(product);
            
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // 6. TÌM KIẾM / LỌC SẢN PHẨM CHO FRONTEND
        // GET: api/products/search
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<object>>> Search(
            [FromQuery] string? query,
            [FromQuery] int? categoryId,
            [FromQuery] string? color,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice)
        {
            var q = _context.Products
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.ProductVariants) // Đã loại bỏ .Include(p => p.Sizes) gây lỗi 500
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(query))
            {
                q = q.Where(p => p.Name.Contains(query) || p.Description.Contains(query) || p.Sku.Contains(query));
            }

            if (categoryId.HasValue)
            {
                q = q.Where(p => p.CategoryId == categoryId.Value);
            }

            if (!string.IsNullOrWhiteSpace(color))
            {
                q = q.Where(p => p.ProductVariants.Any(v => v.Color == color));
            }

            if (minPrice.HasValue || maxPrice.HasValue)
            {
                q = q.Where(p => p.ProductVariants.Any(v =>
                    (!minPrice.HasValue || v.Price >= minPrice.Value) &&
                    (!maxPrice.HasValue || v.Price <= maxPrice.Value)));
            }

            var list = await q.ToListAsync();

            var result = list.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                sku = p.Sku,
                description = p.Description,
                brand = p.Brand,
                material = p.Material,
                careInstructions = p.CareInstructions,
                mainImageUrl = p.MainImageUrl,
                // Lấy giá thấp nhất trong số các biến thể để hiển thị ngoài danh sách
                price = p.ProductVariants.Any() ? p.ProductVariants.Min(v => v.Price) : 0m,
                // Tính tổng tồn kho của toàn bộ các biến thể cộng lại
                stock = p.ProductVariants.Sum(v => v.Stock),
                rating = p.Rating,
                reviewCount = p.ReviewCount,
                images = p.Images.Select(i => new { url = i.Url }),
                productVariants = p.ProductVariants.Select(v => new
                {
                    v.Id,
                    v.Size,
                    v.Color,
                    v.Sku,
                    v.Price,
                    v.Stock,
                    v.IsAvailable
                }),
                // Sửa lại đoạn lấy danh sách các size từ chính các biến thể của sản phẩm đó để không bị crash dữ liệu trống
                sizes = p.ProductVariants.Select(v => v.Size).Distinct().Select(s => new { sizeValue = s }),
                isFeatured = p.IsFeatured,
                categoryId = p.CategoryId
            });

            return Ok(result);
        }
    }

    public class ProductCreateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Brand { get; set; }
        public string? Material { get; set; }
        public string? CareInstructions { get; set; }
        public string? MainImageUrl { get; set; }
        public bool IsFeatured { get; set; }
        public int? CategoryId { get; set; }
        public double Rating { get; set; }
        public int ReviewCount { get; set; }
        public List<string>? ImageUrls { get; set; }
        public List<VariantItemDto>? Variants { get; set; } 
    }

    public class VariantItemDto
    {
        public string? Size { get; set; }
        public string? Color { get; set; }
        public string? Sku { get; set; }
        public decimal Price { get; set; }
        public int Stock { get; set; }
    }

    public class ProductUpdateRequest : ProductCreateRequest {}
}
