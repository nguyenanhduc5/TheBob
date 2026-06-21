using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReviewsController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public ReviewsController(ThebobDbContext context)
        {
            _context = context;
        }

        [HttpGet("product/{productId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetProductReviews(int productId)
        {
            var reviews = await _context.ProductReviews
                .Where(r => r.ProductId == productId)
                .Include(r => r.User)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    r.ProductId,
                    r.OrderItemId,
                    r.Rating,
                    r.Comment,
                    r.CreatedAt,
                    Username = string.IsNullOrWhiteSpace(r.User.FullName) ? r.User.Email : r.User.FullName
                })
                .ToListAsync();

            return Ok(reviews);
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<object>> CreateOrUpdateReview([FromBody] ReviewRequest request)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            if (request.Rating < 1 || request.Rating > 5)
                return BadRequest(new { message = "Rating must be between 1 and 5" });

            if (string.IsNullOrWhiteSpace(request.Comment))
                return BadRequest(new { message = "Comment is required" });

            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null)
                return NotFound(new { message = "Product not found" });

            var purchasedOrderItem = await _context.OrderItems
                .Include(oi => oi.Order)
                .Include(oi => oi.Variant)
                .Where(oi => oi.Order.UserId == userId.Value)
                .Where(oi => oi.Variant != null && oi.Variant.ProductId == request.ProductId)
                .Where(oi => oi.Order.Status == OrderStatus.Processing ||
                             oi.Order.Status == OrderStatus.Shipped ||
                             oi.Order.Status == OrderStatus.Delivered)
                .Where(oi => !request.OrderItemId.HasValue || oi.Id == request.OrderItemId.Value)
                .OrderByDescending(oi => oi.Order.CreatedAt)
                .FirstOrDefaultAsync();

            if (purchasedOrderItem == null)
                return BadRequest(new { message = "Only users who purchased this product can review it." });

            var review = await _context.ProductReviews
                .FirstOrDefaultAsync(r => r.ProductId == request.ProductId && r.UserId == userId.Value);

            if (review == null)
            {
                review = new ProductReview
                {
                    ProductId = request.ProductId,
                    UserId = userId.Value,
                    OrderItemId = purchasedOrderItem.Id,
                    Rating = request.Rating,
                    Comment = request.Comment.Trim()
                };
                _context.ProductReviews.Add(review);
            }
            else
            {
                review.Rating = request.Rating;
                review.OrderItemId = purchasedOrderItem.Id;
                review.Comment = request.Comment.Trim();
                review.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            await UpdateProductRating(request.ProductId);

            return Ok(new { success = true });
        }

        private async Task UpdateProductRating(int productId)
        {
            var product = await _context.Products.FindAsync(productId);
            if (product == null)
                return;

            var stats = await _context.ProductReviews
                .Where(r => r.ProductId == productId)
                .GroupBy(r => r.ProductId)
                .Select(g => new { Count = g.Count(), Average = g.Average(r => r.Rating) })
                .FirstOrDefaultAsync();

            product.ReviewCount = stats?.Count ?? 0;
            product.Rating = stats?.Average ?? 0;
            product.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        private int? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value;
            if (int.TryParse(sub, out var id)) return id;

            var nameId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(nameId, out id)) return id;

            return null;
        }
    }

    public class ReviewRequest
    {
        public int ProductId { get; set; }
        public int? OrderItemId { get; set; }
        public int Rating { get; set; }
        public string Comment { get; set; } = string.Empty;
    }
}
