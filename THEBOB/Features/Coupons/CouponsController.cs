using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CouponsController : ControllerBase
    {
        private readonly ICouponService _couponService;

        public CouponsController(ICouponService couponService)
        {
            _couponService = couponService;
        }

        private int? GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return claim != null ? int.Parse(claim) : null;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetCoupons()
        {
            var coupons = await _couponService.GetCouponsAsync();
            return Ok(coupons);
        }

        [HttpGet("automatic")]
        public async Task<ActionResult<IEnumerable<object>>> GetAutomatic()
        {
            var promos = await _couponService.GetAutomaticCouponsAsync();
            return Ok(promos);
        }

        [HttpGet("my-vouchers")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<object>>> GetMyVouchers()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var vouchers = await _couponService.GetMyVouchersAsync(userId.Value);
            return Ok(vouchers);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> GetCoupon(int id)
        {
            var coupon = await _couponService.GetByIdAsync(id);
            return Ok(coupon);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET: api/coupons/code/SALE10  (User validates a coupon code)
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("code/{code}")]
        public async Task<ActionResult<object>> GetByCode(string code, [FromQuery] decimal orderTotal = 0)
        {
            var userId = GetCurrentUserId();
            var data = await _couponService.ApplyCouponAsync(userId, code, orderTotal);
            return Ok(data);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Coupon>> Create([FromBody] CreateCouponRequest request)
        {
            var coupon = new Coupon
            {
                Name = request.Name?.Trim() ?? string.Empty,
                Code = request.Code ?? string.Empty,
                DiscountType = request.DiscountType ?? "Percentage",
                DiscountValue = request.DiscountValue,
                MinOrderValue = request.MinOrderValue,
                MaxDiscountAmount = request.MaxDiscountAmount,
                StartDate = request.StartDate ?? DateTime.UtcNow,
                EndDate = request.EndDate ?? DateTime.UtcNow.AddYears(1),
                UsageLimit = request.UsageLimit,
                IsAutomatic = request.IsAutomatic,
                ProductId = request.ProductId,
                CategoryId = request.CategoryId,
                TargetUserId = request.TargetUserId
            };

            var createdCoupon = await _couponService.CreateCouponAsync(coupon);
            return CreatedAtAction(nameof(GetCoupon), new { id = createdCoupon.Id }, createdCoupon);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateCouponRequest model)
        {
            var coupon = new Coupon
            {
                Name = model.Name ?? string.Empty,
                DiscountType = model.DiscountType ?? "Percentage",
                DiscountValue = model.DiscountValue,
                MinOrderValue = model.MinOrderValue,
                MaxDiscountAmount = model.MaxDiscountAmount,
                StartDate = model.StartDate ?? DateTime.UtcNow,
                EndDate = model.EndDate ?? DateTime.UtcNow,
                UsageLimit = model.UsageLimit,
                IsAutomatic = model.IsAutomatic,
                ProductId = model.ProductId,
                CategoryId = model.CategoryId,
                TargetUserId = model.TargetUserId
            };

            var updated = await _couponService.UpdateCouponAsync(id, coupon);
            return Ok(updated);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            await _couponService.DeleteCouponAsync(id);
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