using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using THEBOB.DTOs.Promotion;
using THEBOB.Models;
using THEBOB.Models.Promotion;
using THEBOB.Services.Promotion;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/promotions")]
    public class PromotionsController : ControllerBase
    {
        private readonly IPromotionManagementService _promotionService;

        public PromotionsController(IPromotionManagementService promotionService)
        {
            _promotionService = promotionService;
        }

        private int? GetUserId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        // ─────────────────────────────────────────────────────────────────────
        // ADMIN — CRUD
        // ─────────────────────────────────────────────────────────────────────

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll(
            [FromQuery] PromotionStatus? status,
            [FromQuery] PromotionType? type,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _promotionService.GetAllAsync(status, type, page, pageSize);
            return Ok(result);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _promotionService.GetByIdAsync(id);
            if (!result.Success)
                return NotFound(new { message = result.Message });

            return Ok(result.Data);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] CreatePromotionRequest req)
        {
            var createdBy = User.FindFirstValue(ClaimTypes.Email) ?? "admin";
            var result = await _promotionService.CreateAsync(req, createdBy);
            if (!result.Success)
                return BadRequest(new { message = result.Message });

            return CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, result.Data);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] CreatePromotionRequest req)
        {
            var result = await _promotionService.UpdateAsync(id, req);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { message = result.Message });
                return BadRequest(new { message = result.Message });
            }

            return Ok(result.Data);
        }

        [HttpPut("{id}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdatePromotionStatusRequest req)
        {
            var result = await _promotionService.UpdateStatusAsync(id, req.Status);
            if (!result.Success) return NotFound();

            return Ok(result.Data);
        }

        [HttpPost("{id}/clone")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Clone(int id)
        {
            var createdBy = User.FindFirstValue(ClaimTypes.Email) ?? "admin";
            var result = await _promotionService.CloneAsync(id, createdBy);
            if (!result.Success) return NotFound();

            return Ok(result.Data);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _promotionService.DeleteAsync(id);
            if (!result.Success) return NotFound();

            if (result.NoContent)
                return NoContent();

            return Ok(new { message = result.Message });
        }

        // ─────────────────────────────────────────────────────────────────────
        // ADMIN — STATISTICS
        // ─────────────────────────────────────────────────────────────────────

        [HttpGet("{id}/stats")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetStats(int id)
        {
            var result = await _promotionService.GetStatsAsync(id);
            if (!result.Success) return NotFound();

            return Ok(result.Data);
        }

        [HttpGet("stats/summary")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetStatsSummary()
        {
            var result = await _promotionService.GetStatsSummaryAsync();
            return Ok(result);
        }

        [HttpGet("{id}/usages")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUsages(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _promotionService.GetUsagesAsync(id, page, pageSize);
            return Ok(result);
        }

        // ─────────────────────────────────────────────────────────────────────
        // ADMIN — USER COUPON MANAGEMENT
        // ─────────────────────────────────────────────────────────────────────

        [HttpPost("send-user-coupon")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SendUserCoupon([FromBody] SendUserCouponRequest req)
        {
            var result = await _promotionService.SendUserCouponAsync(req);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { message = result.Message });
                return BadRequest(new { message = result.Message });
            }

            return Ok(result.Data);
        }

        [HttpPost("send-bulk-coupon")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SendBulkCoupon([FromBody] SendBulkCouponRequest req)
        {
            var result = await _promotionService.SendBulkCouponAsync(req);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { message = result.Message });
                return BadRequest(new { message = result.Message });
            }

            return Ok(result.Data);
        }

        // ─────────────────────────────────────────────────────────────────────
        // USER — Coupon validate + My vouchers
        // ─────────────────────────────────────────────────────────────────────

        [HttpPost("validate-coupon")]
        [Authorize]
        public async Task<IActionResult> ValidateCoupon([FromBody] ApplyCouponRequest req)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var result = await _promotionService.ValidateCouponAsync(userId.Value, req.CouponCode);
            return Ok(result);
        }

        [HttpPost("calculate")]
        [Authorize]
        public async Task<IActionResult> CalculatePromotions([FromBody] CalculatePromotionsRequest req)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var result = await _promotionService.CalculatePromotionsAsync(userId.Value, req);
            return Ok(result);
        }

        [HttpGet("my-vouchers")]
        [Authorize]
        public async Task<IActionResult> GetMyVouchers()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var list = await _promotionService.GetMyVouchersAsync(userId.Value);
            return Ok(list);
        }

        [HttpGet("applicable")]
        [Authorize]
        public async Task<IActionResult> GetApplicable()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var list = await _promotionService.GetApplicableAsync(userId.Value);
            return Ok(list);
        }

        [HttpGet("{id:int}/eligible-products")]
        [AllowAnonymous]
        public async Task<IActionResult> GetEligibleProducts(int id)
        {
            var result = await _promotionService.GetEligibleProductsAsync(id);
            if (!result.Success)
                return NotFound(new { message = result.Message });

            return Ok(result.Data);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CUSTOMER GROUPS
        // ─────────────────────────────────────────────────────────────────────

        [HttpGet("customer-groups")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetCustomerGroups()
        {
            var groups = await _promotionService.GetCustomerGroupsAsync();
            return Ok(groups);
        }

        [HttpPost("customer-groups")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateCustomerGroup([FromBody] CustomerGroup group)
        {
            var result = await _promotionService.CreateCustomerGroupAsync(group);
            return Ok(result);
        }
    }
}
