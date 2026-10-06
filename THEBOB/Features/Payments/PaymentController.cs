using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using THEBOB.Models;
using THEBOB.Services;
using THEBOB.Infrastructure.Filters;
using THEBOB.Infrastructure.RateLimiting;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentController : ControllerBase
    {
        private readonly IPaymentService _paymentService;

        public PaymentController(IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        // Rate limit 10 lần / 1 phút / User: Kết hợp Idempotency Key chống tạo giao dịch spam
        [HttpPost("create")]
        [Authorize]
        [Idempotent]
        [EnableRateLimiting(RateLimitingExtensions.PolicyOrderPayment)]
        public async Task<ActionResult<ApiResponse<CreatePaymentResponse>>> Create([FromBody] CreatePaymentRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse<CreatePaymentResponse>.Fail("Invalid payment request.", ModelState));

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(ApiResponse<CreatePaymentResponse>.Fail("Unauthorized."));

            var result = await _paymentService.CreatePaymentAsync(request.OrderId, userId.Value, request.Amount);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, ApiResponse<CreatePaymentResponse>.Fail(result.Message));
            }

            return Ok(ApiResponse<CreatePaymentResponse>.Ok(result.Data!));
        }

        [HttpPost("create-link")]
        [Authorize]
        public Task<ActionResult<ApiResponse<CreatePaymentResponse>>> CreateLink([FromBody] CreatePaymentLinkRequest request)
        {
            return Create(new CreatePaymentRequest { OrderId = request.OrderId, Amount = request.Amount });
        }

        [HttpPost("create-qr")]
        [Authorize]
        public Task<ActionResult<ApiResponse<CreatePaymentResponse>>> CreateQr([FromBody] CreateQrPaymentRequest request)
        {
            var orderId = request.OrderId > 0 ? request.OrderId : ExtractOrderId(request.OrderInfo);
            return Create(new CreatePaymentRequest
            {
                OrderId = orderId,
                Amount = request.Amount
            });
        }

        [HttpGet("status/{orderId}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<PaymentStatusResponse>>> GetPaymentStatus(int orderId)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(ApiResponse<PaymentStatusResponse>.Fail("Unauthorized."));

            var isAdmin = User.IsInRole("Admin");
            var result = await _paymentService.GetPaymentStatusAsync(orderId, userId.Value, isAdmin);

            if (!result.Success)
            {
                if (result.StatusCode == 403) return Forbid();
                return StatusCode(result.StatusCode, ApiResponse<PaymentStatusResponse>.Fail(result.Message));
            }

            return Ok(ApiResponse<PaymentStatusResponse>.Ok(result.Data!));
        }

        [HttpPost("cancel/{orderId}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<object>>> CancelPayment(int orderId)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));

            var result = await _paymentService.CancelPaymentAsync(orderId, userId.Value);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.Message));

            return Ok(ApiResponse<object>.Ok(new { orderId }, result.Message));
        }

        [HttpPost("webhook")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<object>>> Webhook([FromBody] JsonElement payload)
        {
            var result = await _paymentService.ProcessWebhookAsync(payload, Request);
            if (!result.Success)
            {
                if (result.StatusCode == 401)
                    return Unauthorized(ApiResponse<object>.Fail(result.Message));
                if (result.StatusCode == 400)
                    return BadRequest(ApiResponse<object>.Fail(result.Message));
                if (result.StatusCode == 404)
                    return NotFound(ApiResponse<object>.Fail(result.Message));

                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.Message));
            }

            return Ok(ApiResponse<object>.Ok(result.Data ?? new object(), result.Message));
        }

        [HttpGet("admin/transactions")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ApiResponse<PagedPaymentTransactionsResponse>>> GetTransactions(
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _paymentService.GetTransactionsAsync(status, page, pageSize);
            return Ok(ApiResponse<PagedPaymentTransactionsResponse>.Ok(result));
        }

        [HttpPost("confirm")]
        [HttpPost("orders/{orderId}/confirm")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ApiResponse<object>>> ConfirmPayment([FromBody] ConfirmPaymentRequest request)
        {
            var result = await _paymentService.ConfirmPaymentAsync(request);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.Message));

            return Ok(ApiResponse<object>.Ok(result.Data ?? new object(), result.Message));
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? int.Parse(userIdClaim) : null;
        }

        private static int ExtractOrderId(string orderInfo)
        {
            if (string.IsNullOrWhiteSpace(orderInfo))
                return 0;

            var index = orderInfo.IndexOf("THEBOB", StringComparison.OrdinalIgnoreCase);
            if (index >= 0)
            {
                var suffix = orderInfo.Substring(index + "THEBOB".Length);
                var digits = new string(suffix.Where(char.IsDigit).ToArray());
                return int.TryParse(digits, out var orderId) ? orderId : 0;
            }

            var allDigits = new string(orderInfo.Where(char.IsDigit).ToArray());
            return int.TryParse(allDigits, out var fallbackId) ? fallbackId : 0;
        }
    }

    public class CreatePaymentRequest
    {
        [Required]
        public int OrderId { get; set; }
        public decimal? Amount { get; set; }
    }

    public class CreatePaymentLinkRequest
    {
        public int OrderId { get; set; }
        public decimal? Amount { get; set; }
    }

    public class CreateQrPaymentRequest
    {
        public int OrderId { get; set; }
        public decimal Amount { get; set; }
        public string OrderInfo { get; set; } = string.Empty;
    }

    public class CreatePaymentResponse
    {
        public bool Success { get; set; }
        public string VaNumber { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string BankName { get; set; } = string.Empty;
        public string BankAccount { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string TransferContent { get; set; } = string.Empty;
        public string QrCode { get; set; } = string.Empty;
        public DateTime ExpiredAt { get; set; }
    }

    public class PaymentStatusResponse
    {
        public string Status { get; set; } = "Pending";
        public string PaymentStatus { get; set; } = "Pending";
        public string OrderStatus { get; set; } = string.Empty;
        public int RemainingSeconds { get; set; }
        public bool IsExpired { get; set; }
        public string? VaNumber { get; set; }
        public string? TransactionId { get; set; }
    }

    public class ConfirmPaymentRequest
    {
        public int OrderId { get; set; }
        public string? TransactionCode { get; set; }
        public string? Note { get; set; }
    }

    public class PagedPaymentTransactionsResponse
    {
        public List<PaymentTransactionDto> Items { get; set; } = new();
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
    }

    public class PaymentTransactionDto
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? VaNumber { get; set; }
        public string? TransactionId { get; set; }
        public string PaymentProvider { get; set; } = string.Empty;
        public DateTime? PaidAt { get; set; }
        public string? FailureReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
