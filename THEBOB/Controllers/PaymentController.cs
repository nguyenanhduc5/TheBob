using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Hubs;
using System.Security.Claims;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PaymentController : ControllerBase
    {
        private readonly ThebobDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly ILogger<PaymentController> _logger;

        public PaymentController(
            ThebobDbContext context, 
            IHubContext<OrderHub> hubContext,
            ILogger<PaymentController> logger)
        {
            _context = context;
            _hubContext = hubContext;
            _logger = logger;
        }

        // POST: api/payment/create-qr
        [HttpPost("create-qr")]
        public async Task<ActionResult<object>> CreateQr([FromBody] CreateQrPaymentRequest request)
        {
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("CreateQr: Invalid ModelState");
                return BadRequest(ModelState);
            }

            try
            {
                // Extract OrderId from transferContent/orderInfo
                int orderId = 0;
                if (request.OrderInfo.StartsWith("PAY_ORDER_", StringComparison.OrdinalIgnoreCase))
                {
                    int.TryParse(request.OrderInfo.Substring("PAY_ORDER_".Length), out orderId);
                }
                else if (request.OrderInfo.StartsWith("THEBOB-", StringComparison.OrdinalIgnoreCase))
                {
                    int.TryParse(request.OrderInfo.Substring("THEBOB-".Length), out orderId);
                }
                else if (request.OrderInfo.StartsWith("THEBOB_", StringComparison.OrdinalIgnoreCase))
                {
                    int.TryParse(request.OrderInfo.Substring("THEBOB_".Length), out orderId);
                }
                else
                {
                    int.TryParse(request.OrderInfo, out orderId);
                }

                var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null)
                {
                    _logger.LogWarning("CreateQr: Order not found for OrderId: {OrderId}", orderId);
                    return NotFound(new { message = "Không tìm thấy đơn hàng tương ứng." });
                }

                // Security check: Validate amount to prevent manual tampering on frontend
                if (Math.Abs(order.TotalAmount - request.Amount) > 0.01m)
                {
                    _logger.LogWarning("CreateQr: Amount mismatch. DB: {DbAmount}, Request: {ReqAmount}", order.TotalAmount, request.Amount);
                    return BadRequest(new { message = "Số tiền thanh toán không khớp với tổng giá trị đơn hàng." });
                }

// FIXED SECTION: CreateQr
var bankName = "Sacombank";
var bankCode = "SACOMBANK";
var accountNumber = "050145284268";
var accountName = "NGUYEN ANH DUC";
var content = $"THEBOB_{order.Id}";

// Generate dynamic VietQR URL (FIXED BANK CODE)
var amountInt = (int)order.TotalAmount;

var qrUrl =
    $"https://img.vietqr.io/image/{bankCode}-{accountNumber}-print.png" +
    $"?amount={amountInt}" +
    $"&addInfo={Uri.EscapeDataString(content)}" +
    $"&accountName={Uri.EscapeDataString(accountName)}";

                _logger.LogInformation("CreateQr Success: OrderId={OrderId}, PaymentStatus={PaymentStatus}, OrderStatus={OrderStatus}", 
                    order.Id, order.PaymentStatus, order.Status);

                return Ok(new
                {
                    orderId = order.Id,
                    amount = amountInt,
                    bankName,
                    accountNumber,
                    accountName,
                    content,
                    qrUrl
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateQr Exception for OrderInfo: {OrderInfo}. Message: {Msg}", request.OrderInfo, ex.Message);
                return StatusCode(500, new { message = "Lỗi khi sinh mã QR thanh toán.", error = ex.Message });
            }
        }

        // GET: api/payment/status/{orderId}
        [HttpGet("status/{orderId}")]
        public async Task<ActionResult<object>> GetPaymentStatus(int orderId)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            try
            {
                var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null)
                {
                    _logger.LogWarning("GetPaymentStatus: Order not found for OrderId: {OrderId}", orderId);
                    return NotFound(new { message = "Không tìm thấy đơn hàng." });
                }

                // Allow only admin or the order owner to see the status
                if (order.UserId != userId && !IsCurrentUserAdmin())
                {
                    _logger.LogWarning("GetPaymentStatus: Forbidden access by User {UserId} to Order {OrderId}", userId, orderId);
                    return Forbid();
                }

                var now = DateTime.UtcNow;
                var expiresAt = order.CreatedAt.AddMinutes(15);
                var remainingSeconds = Math.Max(0, (int)Math.Floor((expiresAt - now).TotalSeconds));
                var isExpired = order.Status == OrderStatus.PendingPayment
                    && order.PaymentStatus == "Pending"
                    && remainingSeconds <= 0;

                if (isExpired)
                {
                    order.Status = OrderStatus.Cancelled;
                    order.PaymentStatus = "Expired";
                    order.UpdatedAt = now;

                    var payTx = await _context.PaymentTransactions.FirstOrDefaultAsync(t => t.OrderId == order.Id);
                    if (payTx != null)
                    {
                        payTx.Status = "Expired";
                        payTx.FailureReason = "Payment window expired";
                        payTx.UpdatedAt = now;
                    }

                    await _context.SaveChangesAsync();
                }

                _logger.LogInformation("GetPaymentStatus Success: OrderId={OrderId}, PaymentStatus={PaymentStatus}, OrderStatus={OrderStatus}", 
                    order.Id, order.PaymentStatus, order.Status);

                return Ok(new
                {
                    orderId = order.Id,
                    paymentStatus = order.PaymentStatus,
                    orderStatus = order.Status.ToString(),
                    remainingSeconds,
                    isExpired
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetPaymentStatus Exception for OrderId: {OrderId}. Message: {Msg}", orderId, ex.Message);
                return StatusCode(500, new { message = "Lỗi khi lấy trạng thái thanh toán.", error = ex.Message });
            }
        }

        // POST: api/payment/confirm (Admin confirms payment)
        [HttpPost("confirm")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> ConfirmPayment([FromBody] ConfirmPaymentRequest request)
        {
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("ConfirmPayment: Invalid ModelState");
                return BadRequest(ModelState);
            }

            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .FirstOrDefaultAsync(o => o.Id == request.OrderId);

            if (order == null)
            {
                _logger.LogWarning("ConfirmPayment: Order not found for OrderId: {OrderId}", request.OrderId);
                return NotFound(new { message = "Không tìm thấy đơn hàng." });
            }

            // Prevent duplicate confirmations
            if (order.PaymentStatus.Equals("Paid", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("ConfirmPayment: Order {OrderId} already confirmed as Paid.", order.Id);
                return BadRequest(new { message = "Đơn hàng này đã được xác nhận thanh toán trước đó." });
            }

            if (order.Status == OrderStatus.Cancelled || order.PaymentStatus == "Cancelled" || order.PaymentStatus == "Expired")
            {
                return BadRequest(new { message = "Đơn hàng đã bị hủy hoặc hết hạn thanh toán." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Update Order details
                order.PaymentStatus = "Paid";
                order.Status = OrderStatus.Processing;
                order.UpdatedAt = DateTime.UtcNow;

                // Deduct stock and log inventory change
                foreach (var item in order.OrderItems)
                {
                    if (item.Variant == null)
                        throw new InvalidOperationException("Biến thể sản phẩm không tồn tại.");
                    if (item.Variant.Stock < item.Quantity)
                        throw new InvalidOperationException($"Sản phẩm {item.ProductName} - {item.Sku} không đủ hàng tồn kho.");

                    item.Variant.Stock -= item.Quantity;
                    item.Variant.UpdatedAt = DateTime.UtcNow;

                    _context.InventoryLogs.Add(new InventoryLog
                    {
                        VariantId = item.Variant.Id,
                        ChangeType = InventoryChangeType.Sold,
                        QuantityChanged = -item.Quantity,
                        Reason = $"Order {order.OrderNumber} Paid Confirmation",
                        UserId = order.UserId
                    });
                }

                // Clear user's shopping cart
                var cart = await _context.Carts
                    .Include(c => c.CartItems)
                    .FirstOrDefaultAsync(c => c.UserId == order.UserId);
                if (cart != null)
                {
                    _context.CartItems.RemoveRange(cart.CartItems);
                    _context.Carts.Remove(cart);
                }

                // Create or update payment transaction record
                var payTx = await _context.PaymentTransactions.FirstOrDefaultAsync(t => t.OrderId == order.Id);
                if (payTx == null)
                {
                    payTx = new PaymentTransaction
                    {
                        OrderId = order.Id,
                        Gateway = order.PaymentMethod,
                        Amount = order.TotalAmount,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.PaymentTransactions.Add(payTx);
                }

                payTx.Status = "Paid";
                payTx.TransactionCode = request.TransactionCode ?? $"TX-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}";
                payTx.PaidAt = DateTime.UtcNow;
                payTx.RawResponse = request.Note ?? "Confirmed by Admin";
                payTx.UpdatedAt = DateTime.UtcNow;

                // Create database notification for the customer
                var notification = new Notification
                {
                    UserId = order.UserId,
                    Message = $"Thanh toán đơn hàng #{order.Id} thành công",
                    Type = "Success",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Notifications.Add(notification);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("ConfirmPayment Success: OrderId={OrderId}, PaymentStatus={PaymentStatus}, OrderStatus={OrderStatus}", 
                    order.Id, order.PaymentStatus, order.Status);

                // Trigger SignalR realtime notifications to the customer
                try
                {
                    // Emit ReceivePaymentSuccess
                    await _hubContext.Clients.User(order.UserId.ToString())
                        .SendAsync("ReceivePaymentSuccess", order.Id, $"Thanh toán đơn hàng #{order.Id} thành công");

                    // Emit ReceiveStatusUpdate
                    await _hubContext.Clients.User(order.UserId.ToString())
                        .SendAsync("ReceiveStatusUpdate", order.Id, "Processing");

                    // Emit ReceiveOrderStatusUpdate
                    await _hubContext.Clients.User(order.UserId.ToString())
                        .SendAsync("ReceiveOrderStatusUpdate", order.Id, "Processing");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("ConfirmPayment SignalR Error: {Msg}", ex.Message);
                }

                return Ok(new { message = "Xác nhận thanh toán thành công.", orderId = order.Id });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "ConfirmPayment Exception for OrderId: {OrderId}. Message: {Msg}", request.OrderId, ex.Message);
                return StatusCode(500, new { message = "Lỗi khi lưu xác nhận thanh toán.", error = ex.Message });
            }
        }

        // POST: api/payment/cancel/{orderId}
        [HttpPost("cancel/{orderId}")]
        public async Task<ActionResult<object>> CancelPayment(int orderId)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId.Value);

            if (order == null)
                return NotFound(new { message = "Không tìm thấy đơn hàng." });

            if (order.PaymentStatus == "Paid")
                return BadRequest(new { message = "Đơn hàng đã thanh toán, không thể hủy thanh toán." });

            if (order.Status == OrderStatus.Cancelled)
                return Ok(new { message = "Đơn hàng đã được hủy.", orderId = order.Id });

            if (order.Status != OrderStatus.PendingPayment)
                return BadRequest(new { message = "Chỉ có thể hủy đơn đang chờ thanh toán." });

            var now = DateTime.UtcNow;
            order.Status = OrderStatus.Cancelled;
            order.PaymentStatus = "Cancelled";
            order.UpdatedAt = now;

            var payTx = await _context.PaymentTransactions.FirstOrDefaultAsync(t => t.OrderId == order.Id);
            if (payTx != null)
            {
                payTx.Status = "Cancelled";
                payTx.FailureReason = "Cancelled by customer or payment timeout";
                payTx.UpdatedAt = now;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã hủy thanh toán.", orderId = order.Id });
        }

        // GET: api/payment/history
        [HttpGet("history")]
        public async Task<ActionResult<object>> GetPaymentHistory()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            try
            {
                var query = _context.PaymentTransactions
                    .Include(p => p.Order)
                    .AsQueryable();

                if (!IsCurrentUserAdmin())
                {
                    query = query.Where(p => p.Order.UserId == userId);
                }

                var history = await query
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => new
                    {
                        p.Id,
                        p.OrderId,
                        OrderNumber = p.Order.OrderNumber,
                        p.Gateway,
                        p.TransactionCode,
                        p.Amount,
                        p.Status,
                        p.PaidAt,
                        p.CreatedAt
                    })
                    .ToListAsync();

                return Ok(history);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetPaymentHistory Exception for User: {UserId}. Message: {Msg}", userId, ex.Message);
                return StatusCode(500, new { message = "Lỗi khi tải lịch sử thanh toán.", error = ex.Message });
            }
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

        private async Task AutoCancelExpiredOrdersAsync()
        {
            var expiryTime = DateTime.UtcNow.AddMinutes(-15);
            var expiredOrders = await _context.Orders
                .Where(o => o.Status == OrderStatus.PendingPayment && o.CreatedAt < expiryTime)
                .ToListAsync();

            if (expiredOrders.Any())
            {
                foreach (var order in expiredOrders)
                {
                    order.Status = OrderStatus.Cancelled;
                    order.PaymentStatus = "Expired";
                    order.UpdatedAt = DateTime.UtcNow;
                }
                await _context.SaveChangesAsync();
                _logger.LogInformation("AutoCancelExpiredOrdersAsync: Cancelled {Count} expired PendingPayment orders.", expiredOrders.Count);
            }
        }
    }

    public class CreateQrPaymentRequest
    {
        public decimal Amount { get; set; }
        public string OrderInfo { get; set; } = string.Empty;
    }

    public class ConfirmPaymentRequest
    {
        public int OrderId { get; set; }
        public string? TransactionCode { get; set; }
        public string? Note { get; set; }
    }
}
