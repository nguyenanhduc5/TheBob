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
    public class CouponsController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public CouponsController(ThebobDbContext context)
        {
            _context = context;
        }

        private int? GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return claim != null ? int.Parse(claim) : null;
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET: api/coupons  (Admin only)
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetCoupons()
        {
            var coupons = await _context.Coupons
                .Include(c => c.Product)
                .Include(c => c.Category)
                .Include(c => c.TargetUser)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id, c.Name, c.Code, c.DiscountType, c.DiscountValue,
                    c.MinOrderValue, c.MaxDiscountAmount,
                    c.StartDate, c.EndDate,
                    c.UsageLimit, c.UsedCount,
                    c.IsAutomatic, c.ProductId, c.CategoryId, c.TargetUserId,
                    ProductName = c.Product != null ? c.Product.Name : null,
                    CategoryName = c.Category != null ? c.Category.Name : null,
                    TargetUserEmail = c.TargetUser != null ? c.TargetUser.Email : null,
                    TargetUserName = c.TargetUser != null ? c.TargetUser.FullName : null,
                    c.CreatedAt, c.UpdatedAt,
                    // NotMapped aliases for backward-compat
                    DiscountPercent = c.DiscountValue,
                    ExpiryDate = c.EndDate,
                    IsActive = DateTime.UtcNow >= c.StartDate && DateTime.UtcNow <= c.EndDate
                                && (c.UsageLimit == 0 || c.UsedCount < c.UsageLimit)
                })
                .ToListAsync();

            return Ok(coupons);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET: api/coupons/automatic  (Public — for auto-apply on cart/checkout)
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("automatic")]
        public async Task<ActionResult<IEnumerable<object>>> GetAutomatic()
        {
            var now = DateTime.UtcNow;
            var promos = await _context.Coupons
                .Where(c => c.IsAutomatic
                    && c.StartDate <= now
                    && c.EndDate >= now
                    && (c.UsageLimit == 0 || c.UsedCount < c.UsageLimit))
                .Select(c => new
                {
                    c.Id, c.Name, c.Code, c.DiscountType, c.DiscountValue,
                    c.MinOrderValue, c.MaxDiscountAmount,
                    c.StartDate, c.EndDate,
                    c.ProductId, c.CategoryId,
                    DiscountPercent = c.DiscountValue,
                    ExpiryDate = c.EndDate,
                })
                .ToListAsync();

            return Ok(promos);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET: api/coupons/my-vouchers  (Authenticated — coupons gửi cho user đang đăng nhập)
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("my-vouchers")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<object>>> GetMyVouchers()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var now = DateTime.UtcNow;
            var vouchers = await _context.Coupons
                .Where(c => c.TargetUserId == userId.Value
                    && !c.IsAutomatic
                    && c.EndDate >= now)
                .Select(c => new
                {
                    c.Id, c.Name, c.Code, c.DiscountType, c.DiscountValue,
                    c.MinOrderValue, c.MaxDiscountAmount,
                    c.StartDate, c.EndDate,
                    c.UsageLimit, c.UsedCount,
                    c.ProductId, c.CategoryId,
                    DiscountPercent = c.DiscountValue,
                    ExpiryDate = c.EndDate,
                    IsActive = now >= c.StartDate && now <= c.EndDate
                                && (c.UsageLimit == 0 || c.UsedCount < c.UsageLimit),
                    AlreadyUsed = _context.CouponUsages.Any(u => u.CouponId == c.Id && u.UserId == userId.Value)
                })
                .ToListAsync();

            return Ok(vouchers);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET: api/coupons/5
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> GetCoupon(int id)
        {
            var coupon = await _context.Coupons
                .Include(c => c.Product)
                .Include(c => c.Category)
                .Include(c => c.TargetUser)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (coupon == null)
                return NotFound(new { message = "Không tìm thấy mã giảm giá" });

            return Ok(coupon);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET: api/coupons/code/SALE10  (User validates a coupon code)
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("code/{code}")]
        public async Task<ActionResult<object>> GetByCode(string code, [FromQuery] decimal orderTotal = 0)
        {
            var coupon = await _context.Coupons
                .FirstOrDefaultAsync(c => c.Code.ToUpper() == code.ToUpper() && !c.IsAutomatic);

            if (coupon == null)
                return NotFound(new { message = "Mã giảm giá không tồn tại" });

            // ── Date validation ────────────────────────────────────────────
            if (DateTime.UtcNow < coupon.StartDate)
                return BadRequest(new { message = "Mã giảm giá chưa bắt đầu" });

            if (DateTime.UtcNow > coupon.EndDate)
                return BadRequest(new { message = "Mã giảm giá đã hết hạn" });

            // ── Usage limit ────────────────────────────────────────────────
            if (coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit)
                return BadRequest(new { message = "Mã giảm giá đã hết lượt sử dụng" });

            // ── MinOrderValue validation ───────────────────────────────────
            if (coupon.MinOrderValue > 0 && orderTotal > 0 && orderTotal < coupon.MinOrderValue)
                return BadRequest(new
                {
                    message = $"Đơn hàng tối thiểu {coupon.MinOrderValue:N0} VNĐ để dùng mã này"
                });

            // ── TargetUser validation ──────────────────────────────────────
            if (coupon.TargetUserId.HasValue)
            {
                var userId = GetCurrentUserId();
                if (!userId.HasValue)
                    return Unauthorized(new { message = "Vui lòng đăng nhập để dùng mã này" });
                if (userId.Value != coupon.TargetUserId.Value)
                    return Forbid(); // 403 — mã này không dành cho user hiện tại
            }

            // ── Check if already used by this user ────────────────────────
            var currentUserId = GetCurrentUserId();
            if (currentUserId.HasValue)
            {
                bool alreadyUsed = await _context.CouponUsages
                    .AnyAsync(u => u.CouponId == coupon.Id && u.UserId == currentUserId.Value);
                if (alreadyUsed)
                    return BadRequest(new { message = "Bạn đã sử dụng mã giảm giá này rồi" });
            }

            return Ok(new
            {
                coupon.Id, coupon.Name, coupon.Code,
                coupon.DiscountType, coupon.DiscountValue,
                coupon.MinOrderValue, coupon.MaxDiscountAmount,
                coupon.StartDate, coupon.EndDate,
                coupon.ProductId, coupon.CategoryId,
                DiscountPercent = coupon.DiscountValue,
                ExpiryDate = coupon.EndDate,
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // POST: api/coupons  (Admin — Create coupon/promotion)
        // ─────────────────────────────────────────────────────────────────────
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Coupon>> Create([FromBody] CreateCouponRequest request)
        {
            // For non-automatic coupons, Code is required and must be unique
            if (!request.IsAutomatic)
            {
                if (string.IsNullOrWhiteSpace(request.Code))
                    return BadRequest(new { message = "Mã code không được để trống" });

                var codeUpper = request.Code.Trim().ToUpper();
                bool exists = await _context.Coupons.AnyAsync(c => c.Code == codeUpper);
                if (exists)
                    return BadRequest(new { message = "Mã giảm giá đã tồn tại" });

                request.Code = codeUpper;
            }
            else
            {
                // Automatic promotions get a generated unique internal code
                request.Code = $"AUTO_{Guid.NewGuid():N}".Substring(0, 20).ToUpper();
            }

            var coupon = new Coupon
            {
                Name = request.Name?.Trim() ?? string.Empty,
                Code = request.Code,
                DiscountType = request.DiscountType ?? "Percentage",
                DiscountValue = request.DiscountValue,
                MinOrderValue = request.MinOrderValue,
                MaxDiscountAmount = request.MaxDiscountAmount,
                StartDate = request.StartDate ?? DateTime.UtcNow,
                EndDate = request.EndDate ?? DateTime.UtcNow.AddYears(1),
                UsageLimit = request.UsageLimit,
                UsedCount = 0,
                IsAutomatic = request.IsAutomatic,
                ProductId = request.ProductId,
                CategoryId = request.CategoryId,
                TargetUserId = request.TargetUserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Coupons.Add(coupon);
            await _context.SaveChangesAsync();

            // If there is a TargetUserId, send notification to that user
            if (request.TargetUserId.HasValue)
            {
                _context.Notifications.Add(new Notification
                {
                    UserId = request.TargetUserId.Value,
                    Message = $"Bạn vừa nhận được voucher giảm giá: {coupon.Code}"
                        + (string.IsNullOrEmpty(coupon.Name) ? "" : $" — {coupon.Name}"),
                    Type = "Info",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction(nameof(GetCoupon), new { id = coupon.Id }, new
            {
                coupon.Id, coupon.Name, coupon.Code, coupon.DiscountType, coupon.DiscountValue,
                coupon.MinOrderValue, coupon.MaxDiscountAmount,
                coupon.StartDate, coupon.EndDate,
                coupon.UsageLimit, coupon.UsedCount,
                coupon.IsAutomatic, coupon.ProductId, coupon.CategoryId, coupon.TargetUserId,
                coupon.CreatedAt
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // POST: api/coupons/{id}/send/{userId}  (Admin — Send personal voucher)
        // ─────────────────────────────────────────────────────────────────────
        [HttpPost("{id}/send/{userId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SendToUser(int id, int userId)
        {
            var originalCoupon = await _context.Coupons.FindAsync(id);
            if (originalCoupon == null)
                return NotFound(new { message = "Không tìm thấy mã giảm giá" });

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound(new { message = "Không tìm thấy người dùng" });

            // Generate a unique code for this personal voucher
            var personalCode = $"{originalCoupon.Code.Substring(0, Math.Min(originalCoupon.Code.Length, 8))}_{Guid.NewGuid():N}".Substring(0, Math.Min(20, 20)).ToUpper();

            var personalVoucher = new Coupon
            {
                Name = originalCoupon.Name,
                Code = personalCode,
                DiscountType = originalCoupon.DiscountType,
                DiscountValue = originalCoupon.DiscountValue,
                MinOrderValue = originalCoupon.MinOrderValue,
                MaxDiscountAmount = originalCoupon.MaxDiscountAmount,
                StartDate = originalCoupon.StartDate,
                EndDate = originalCoupon.EndDate,
                UsageLimit = 1, // Personal voucher: 1 use only
                UsedCount = 0,
                IsAutomatic = false,
                ProductId = originalCoupon.ProductId,
                CategoryId = originalCoupon.CategoryId,
                TargetUserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Coupons.Add(personalVoucher);

            _context.Notifications.Add(new Notification
            {
                UserId = userId,
                Message = $"Bạn vừa nhận được voucher cá nhân: {personalCode}"
                    + (string.IsNullOrEmpty(originalCoupon.Name) ? "" : $" — {originalCoupon.Name}"),
                Type = "Info",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Đã gửi voucher {personalCode} đến {user.Email}",
                code = personalCode,
                userId,
                userEmail = user.Email
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // PUT: api/coupons/5  (Admin — Update)
        // ─────────────────────────────────────────────────────────────────────
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateCouponRequest model)
        {
            var coupon = await _context.Coupons.FindAsync(id);
            if (coupon == null)
                return NotFound(new { message = "Không tìm thấy mã giảm giá" });

            // Check code uniqueness if changing code
            if (!coupon.IsAutomatic && !string.IsNullOrWhiteSpace(model.Code))
            {
                var newCode = model.Code.Trim().ToUpper();
                bool codeConflict = await _context.Coupons
                    .AnyAsync(c => c.Code == newCode && c.Id != id);
                if (codeConflict)
                    return BadRequest(new { message = "Mã giảm giá đã tồn tại" });
                coupon.Code = newCode;
            }

            coupon.Name = model.Name?.Trim() ?? coupon.Name;
            coupon.DiscountType = model.DiscountType ?? coupon.DiscountType;
            coupon.DiscountValue = model.DiscountValue > 0 ? model.DiscountValue : coupon.DiscountValue;
            coupon.MinOrderValue = model.MinOrderValue;
            coupon.MaxDiscountAmount = model.MaxDiscountAmount;
            coupon.StartDate = model.StartDate ?? coupon.StartDate;
            coupon.EndDate = model.EndDate ?? coupon.EndDate;
            coupon.UsageLimit = model.UsageLimit;
            coupon.IsAutomatic = model.IsAutomatic;
            coupon.ProductId = model.ProductId;
            coupon.CategoryId = model.CategoryId;
            coupon.TargetUserId = model.TargetUserId;
            coupon.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                coupon.Id, coupon.Name, coupon.Code, coupon.DiscountType, coupon.DiscountValue,
                coupon.MinOrderValue, coupon.MaxDiscountAmount,
                coupon.StartDate, coupon.EndDate, coupon.UsageLimit, coupon.UsedCount,
                coupon.IsAutomatic, coupon.ProductId, coupon.CategoryId, coupon.TargetUserId,
                coupon.UpdatedAt
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // DELETE: api/coupons/5  (Admin)
        // ─────────────────────────────────────────────────────────────────────
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var coupon = await _context.Coupons.FindAsync(id);
            if (coupon == null)
                return NotFound(new { message = "Không tìm thấy mã giảm giá" });

            // Check if coupon has been used
            bool hasUsages = await _context.CouponUsages.AnyAsync(u => u.CouponId == id);
            if (hasUsages)
            {
                // Soft-delete: just expire the coupon instead of deleting it
                coupon.EndDate = DateTime.UtcNow.AddDays(-1);
                coupon.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Mã đã được vô hiệu hóa (đã có lượt dùng, không thể xóa hoàn toàn)" });
            }

            _context.Coupons.Remove(coupon);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DTO
    // ─────────────────────────────────────────────────────────────────────────
    public class CreateCouponRequest
    {
        public string? Name { get; set; }
        public string? Code { get; set; }
        public string? DiscountType { get; set; } = "Percentage";
        public decimal DiscountValue { get; set; }
        public decimal MinOrderValue { get; set; } = 0;
        public decimal? MaxDiscountAmount { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int UsageLimit { get; set; } = 0;
        public bool IsAutomatic { get; set; } = false;
        public int? ProductId { get; set; }
        public int? CategoryId { get; set; }
        public int? TargetUserId { get; set; }
    }
}