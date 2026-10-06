using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using THEBOB.Models;
using THEBOB.Services;
using THEBOB.Infrastructure.Filters;
using THEBOB.Infrastructure.RateLimiting;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly IOrderService _orderService;

        public OrdersController(IOrderService orderService)
        {
            _orderService = orderService;
        }

        // GET: api/orders (user's orders)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetOrders()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var orders = await _orderService.GetUserOrdersAsync(userId.Value);
            return Ok(orders);
        }

        // GET: api/orders/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetOrder(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var result = await _orderService.GetOrderByIdAsync(id, userId.Value, IsCurrentUserAdmin());
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound();
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return Ok(result.Data);
        }

        // GET: api/orders/status/{id}
        [HttpGet("status/{id}")]
        public async Task<ActionResult<object>> GetOrderStatus(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var result = await _orderService.GetOrderStatusAsync(id, userId.Value, IsCurrentUserAdmin());
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return Ok(result.Data);
        }

        // POST: api/orders OR api/orders/checkout (checkout from cart)
        // Rate limit 10 lần / 1 phút / User: Kết hợp với Idempotency Key chống tạo đơn spam
        [HttpPost]
        [HttpPost("checkout")]
        [Idempotent]
        [EnableRateLimiting(RateLimitingExtensions.PolicyOrderPayment)]
        public async Task<ActionResult<object>> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var result = await _orderService.CreateOrderAsync(userId.Value, request);
            if (!result.Success)
            {
                if (result.StatusCode == 409)
                    return Conflict(new { message = result.Message, orderId = ((dynamic)result.Data!).orderId });

                return StatusCode(result.StatusCode, result.Data ?? new { message = result.Message });
            }

            return Ok(result.Data);
        }

        // GET: api/orders/admin/all (admin only)
        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetAllOrders()
        {
            var orders = await _orderService.GetAllOrdersAsync();
            return Ok(orders);
        }

        // GET: api/admin/orders (admin only, paginated & filtered & search)
        [HttpGet("/api/admin/orders")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAdminOrdersPaginated(
            [FromQuery] string? search,
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var data = await _orderService.GetAdminOrdersPaginatedAsync(search, status, page, pageSize);
            return Ok(data);
        }

        // PUT: api/orders/{id}/status (admin only)
        [HttpPut("{id}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusRequest request)
        {
            var result = await _orderService.UpdateOrderStatusAsync(id, request.Status, GetCurrentUserId());
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return Ok(result.Data);
        }

        // PUT: api/orders/{id}/cancel (customer can cancel own order before shipping)
        [HttpPut("{id}/cancel")]
        public async Task<ActionResult<object>> CancelOrder(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var result = await _orderService.CancelOrderAsync(id, userId.Value);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return Ok(result.Data);
        }

        // PATCH: /api/admin/orders/{id}/confirm (admin only)
        [HttpPatch("/api/admin/orders/{id}/confirm")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ConfirmOrderManual(int id)
        {
            var result = await _orderService.ConfirmOrderManualAsync(id, GetCurrentUserId());
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return Ok(result.Data);
        }

        // PATCH: /api/admin/orders/{id}/cancel (admin only)
        [HttpPatch("/api/admin/orders/{id}/cancel")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CancelOrderManual(int id)
        {
            var result = await _orderService.CancelOrderManualAsync(id, GetCurrentUserId());
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return Ok(result.Data);
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? int.Parse(userIdClaim) : null;
        }

        private bool IsCurrentUserAdmin()
        {
            return User.IsInRole("Admin");
        }
    }

    public class CreateOrderRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [RegularExpression(@"^(0(3|5|7|8|9)\d{8}|\+84(3|5|7|8|9)\d{8})$", ErrorMessage = "Số điện thoại Việt Nam không hợp lệ.")]
        public string Phone { get; set; } = string.Empty;

        [StringLength(255, MinimumLength = 2)]
        public string? FullName { get; set; }

        [Required]
        [StringLength(255, MinimumLength = 2)]
        public string ProvinceCity { get; set; } = string.Empty;

        [Required]
        [StringLength(255, MinimumLength = 2)]
        public string District { get; set; } = string.Empty;

        [Required]
        [StringLength(255, MinimumLength = 2)]
        public string Ward { get; set; } = string.Empty;

        [Required]
        [StringLength(500, MinimumLength = 2)]
        public string SpecificAddress { get; set; } = string.Empty;

        [Required]
        public string PaymentMethod { get; set; } = string.Empty;

        public string? TransactionCode { get; set; }
        public string? RawPaymentResponse { get; set; }
        public int? GhnProvinceId { get; set; }
        public int? GhnDistrictId { get; set; }
        public string? GhnWardCode { get; set; }
        public string? CouponCode { get; set; }
        public int? UserCouponId { get; set; }
    }

    public class UpdateOrderStatusRequest
    {
        public OrderStatus Status { get; set; }
    }
}
