using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentController : ControllerBase
    {
        private const int PaymentWindowSeconds = 15 * 60;

        private readonly ThebobDbContext _context;
        private readonly SepayService _sepayService;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly ILogger<PaymentController> _logger;

      public PaymentController(
    ThebobDbContext context,
    SepayService sepayService,
    IHubContext<OrderHub> hubContext,
    IGhnService ghnService,        // ← mới
    ILogger<PaymentController> logger)
{
    _context = context;
    _sepayService = sepayService;
    _hubContext = hubContext;
    _ghnService = ghnService;       // ← mới
    _logger = logger;
}

        [HttpPost("create")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<CreatePaymentResponse>>> Create([FromBody] CreatePaymentRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse<CreatePaymentResponse>.Fail("Invalid payment request.", ModelState));

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(ApiResponse<CreatePaymentResponse>.Fail("Unauthorized."));

            try
            {
                var order = await _context.Orders
                    .FirstOrDefaultAsync(o => o.Id == request.OrderId && o.UserId == userId.Value);

                if (order == null)
                    return NotFound(ApiResponse<CreatePaymentResponse>.Fail("Order not found."));

                if (order.PaymentStatus == "Paid")
                    return BadRequest(ApiResponse<CreatePaymentResponse>.Fail("Order already paid."));

                if (order.Status == OrderStatus.Cancelled || order.PaymentStatus is "Cancelled" or "Expired")
                    return BadRequest(ApiResponse<CreatePaymentResponse>.Fail("Order has been cancelled or expired."));

                var remainingSeconds = GetRemainingSeconds(order);
                if (remainingSeconds <= 0)
                {
                    await ExpireOrderAsync(order);
                    return BadRequest(ApiResponse<CreatePaymentResponse>.Fail("Payment expired."));
                }

                var amount = order.TotalAmount;
                if (request.Amount.HasValue && Math.Abs(request.Amount.Value - amount) > 0.01m)
                    return BadRequest(ApiResponse<CreatePaymentResponse>.Fail("Payment amount does not match order total."));

                var existingTx = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.OrderId == order.Id && t.Status == "Pending" && t.PaymentProvider == "SePay");

                if (existingTx != null && !string.IsNullOrWhiteSpace(existingTx.VaNumber))
                {
                    return Ok(ApiResponse<CreatePaymentResponse>.Ok(BuildCreatePaymentResponse(order, existingTx, remainingSeconds)));
                }

                var sepayResult = await _sepayService.CreateVirtualAccount(order.Id, amount);
                var now = DateTime.UtcNow;
                var paymentTx = existingTx ?? new PaymentTransaction
                {
                    OrderId = order.Id,
                    CreatedAt = now
                };

                paymentTx.Gateway = "SePay";
                paymentTx.PaymentProvider = "SePay";
                paymentTx.Amount = amount;
                paymentTx.Status = "Pending";
                paymentTx.VaNumber = sepayResult.VaNumber;
                paymentTx.TransactionCode = sepayResult.TransferContent;
                paymentTx.RawResponse = sepayResult.RawResponse;
                paymentTx.UpdatedAt = now;

                if (existingTx == null)
                    _context.PaymentTransactions.Add(paymentTx);

                await _context.SaveChangesAsync();

                return Ok(ApiResponse<CreatePaymentResponse>.Ok(new CreatePaymentResponse
                {
                    Success = true,
                    VaNumber = sepayResult.VaNumber,
                    Amount = amount,
                    BankName = sepayResult.BankName,
                    BankAccount = sepayResult.BankAccount,
                    AccountName = sepayResult.AccountName,
                    TransferContent = sepayResult.TransferContent,
                    QrCode = sepayResult.QrCode,
                    ExpiredAt = order.CreatedAt.AddSeconds(PaymentWindowSeconds)
                }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create SePay payment failed for OrderId={OrderId}", request.OrderId);
                return StatusCode(500, ApiResponse<CreatePaymentResponse>.Fail("Could not create SePay payment.", ex.Message));
            }
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
            return Create(new CreatePaymentRequest
            {
                OrderId = request.OrderId > 0 ? request.OrderId : ExtractOrderId(request.OrderInfo),
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

            try
            {
                var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null)
                    return NotFound(ApiResponse<PaymentStatusResponse>.Fail("Order not found."));

                if (order.UserId != userId.Value && !User.IsInRole("Admin"))
                    return Forbid();

                var remainingSeconds = GetRemainingSeconds(order);
                if (remainingSeconds <= 0 && order.PaymentStatus == "Pending" && order.Status == OrderStatus.PendingPayment)
                {
                    await ExpireOrderAsync(order);
                    await _hubContext.Clients.User(order.UserId.ToString()).SendAsync("ReceivePaymentExpired", order.Id);
                }

                var tx = await _context.PaymentTransactions
                    .OrderByDescending(t => t.CreatedAt)
                    .FirstOrDefaultAsync(t => t.OrderId == order.Id);

                var response = new PaymentStatusResponse
                {
                    Status = order.PaymentStatus,
                    PaymentStatus = order.PaymentStatus,
                    OrderStatus = order.Status.ToString(),
                    RemainingSeconds = Math.Max(0, remainingSeconds),
                    IsExpired = order.PaymentStatus == "Expired" || (order.Status == OrderStatus.Cancelled && remainingSeconds <= 0),
                    VaNumber = tx?.VaNumber,
                    TransactionId = tx?.TransactionId
                };

                return Ok(ApiResponse<PaymentStatusResponse>.Ok(response));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetPaymentStatus failed for OrderId={OrderId}", orderId);
                return StatusCode(500, ApiResponse<PaymentStatusResponse>.Fail("Could not get payment status.", ex.Message));
            }
        }

        [HttpPost("cancel/{orderId}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<object>>> CancelPayment(int orderId)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(ApiResponse<object>.Fail("Unauthorized."));

            try
            {
                var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId.Value);
                if (order == null)
                    return NotFound(ApiResponse<object>.Fail("Order not found."));

                if (order.PaymentStatus != "Pending")
                    return BadRequest(ApiResponse<object>.Fail("Only pending payments can be cancelled."));

                order.Status = OrderStatus.Cancelled;
                order.PaymentStatus = "Cancelled";
                order.UpdatedAt = DateTime.UtcNow;

                var tx = await _context.PaymentTransactions.FirstOrDefaultAsync(t => t.OrderId == order.Id && t.Status == "Pending");
                if (tx != null)
                {
                    tx.Status = "Cancelled";
                    tx.FailureReason = "Cancelled by customer";
                    tx.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                await _hubContext.Clients.User(order.UserId.ToString()).SendAsync("ReceivePaymentFailed", order.Id);

                return Ok(ApiResponse<object>.Ok(new { orderId = order.Id }, "Payment cancelled."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CancelPayment failed for OrderId={OrderId}", orderId);
                return StatusCode(500, ApiResponse<object>.Fail("Could not cancel payment.", ex.Message));
            }
        }

        [HttpPost("webhook")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<object>>> Webhook([FromBody] JsonElement payload)
        {
           
    _logger.LogInformation("SePay webhook received: {Payload}", payload.GetRawText());
    
            if (!_sepayService.VerifyWebhook(Request, out var verifyError))
            {
                _logger.LogWarning("Rejected SePay webhook: {Reason}", verifyError);
                return Unauthorized(ApiResponse<object>.Fail(verifyError));
            }

            try
            {
                var rawPayload = payload.GetRawText();
                var webhook = _sepayService.ParseWebhook(payload);

                if (string.IsNullOrWhiteSpace(webhook.TransactionId))
                    return BadRequest(ApiResponse<object>.Fail("Webhook missing transaction id."));

                if (!string.Equals(webhook.Status, "Paid", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(webhook.Status, "Success", StringComparison.OrdinalIgnoreCase))
                {
                    await MarkPaymentFailedAsync(webhook, rawPayload);
                    return Ok(ApiResponse<object>.Ok(new { webhook.TransactionId }, "Webhook marked as failed."));
                }

                var order = await FindOrderFromWebhookAsync(webhook);
                if (order == null)
                    return NotFound(ApiResponse<object>.Fail("Order not found for SePay webhook."));

                var result = await FinalizePaidOrderAsync(order.Id, webhook, rawPayload);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SePay webhook processing failed.");
                return StatusCode(500, ApiResponse<object>.Fail("Could not process SePay webhook.", ex.Message));
            }
        }

        [HttpGet("admin/transactions")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ApiResponse<PagedPaymentTransactionsResponse>>> GetTransactions(
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            try
            {
                var query = _context.PaymentTransactions
                    .Include(t => t.Order)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
                    query = query.Where(t => t.Status == status);

                var total = await query.CountAsync();
                var items = await query
                    .OrderByDescending(t => t.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(t => new PaymentTransactionDto
                    {
                        Id = t.Id,
                        OrderId = t.OrderId,
                        Amount = t.Amount,
                        Status = t.Status,
                        VaNumber = t.VaNumber,
                        TransactionId = t.TransactionId,
                        PaymentProvider = t.PaymentProvider,
                        PaidAt = t.PaidAt,
                        FailureReason = t.FailureReason,
                        CreatedAt = t.CreatedAt,
                        UpdatedAt = t.UpdatedAt
                    })
                    .ToListAsync();

                return Ok(ApiResponse<PagedPaymentTransactionsResponse>.Ok(new PagedPaymentTransactionsResponse
                {
                    Items = items,
                    Page = page,
                    PageSize = pageSize,
                    Total = total
                }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTransactions failed.");
                return StatusCode(500, ApiResponse<PagedPaymentTransactionsResponse>.Fail("Could not load transactions.", ex.Message));
            }
        }

        [HttpPost("confirm")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ApiResponse<object>>> ConfirmPayment([FromBody] ConfirmPaymentRequest request)
        {
            var webhook = new SepayWebhookPayload
            {
                TransactionId = request.TransactionCode ?? $"ADMIN_{request.OrderId}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}",
                Amount = 0,
                Status = "Paid",
                PaidAt = DateTime.UtcNow
            };
            return await FinalizePaidOrderAsync(request.OrderId, webhook, request.Note ?? "Confirmed by Admin");
        }

        private async Task<ActionResult<ApiResponse<object>>> FinalizePaidOrderAsync(int orderId, SepayWebhookPayload webhook, string rawPayload)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                var duplicated = await _context.PaymentTransactions.AnyAsync(t =>
                    t.TransactionId == webhook.TransactionId && t.Status == "Paid");

                if (duplicated)
                {
                    await transaction.RollbackAsync();
                    return Ok(ApiResponse<object>.Ok(new { orderId }, "Transaction already processed."));
                }

                var order = await _context.Orders
                    .FromSqlRaw("SELECT * FROM Orders WHERE Id = {0} FOR UPDATE", orderId)
                    .AsTracking()
                    .FirstOrDefaultAsync();

                if (order == null)
                {
                    await transaction.RollbackAsync();
                    return NotFound(ApiResponse<object>.Fail("Order not found."));
                }

                if (order.PaymentStatus == "Paid")
                {
                    await transaction.RollbackAsync();
                    return Ok(ApiResponse<object>.Ok(new { orderId }, "Order already paid."));
                }

                if (order.PaymentStatus is "Cancelled" or "Expired")
                {
                    await transaction.RollbackAsync();
                    return BadRequest(ApiResponse<object>.Fail("Order is cancelled or expired."));
                }

                if (webhook.Amount > 0 && Math.Abs(order.TotalAmount - webhook.Amount) > 0.01m)
                    throw new InvalidOperationException("Webhook amount does not match order total.");

                var orderItems = await _context.OrderItems
                    .FromSqlRaw("SELECT * FROM OrderItems WHERE OrderId = {0} FOR UPDATE", orderId)
                    .AsTracking()
                    .ToListAsync();

                foreach (var item in orderItems)
                {
                    if (!item.VariantId.HasValue)
                        throw new InvalidOperationException($"Order item {item.Id} missing VariantId.");

                    var variant = await _context.ProductVariants
                        .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", item.VariantId.Value)
                        .AsTracking()
                        .FirstOrDefaultAsync();

                    if (variant == null)
                        throw new InvalidOperationException($"Variant {item.VariantId.Value} not found.");

                    if (variant.Stock < item.Quantity)
                        throw new InvalidOperationException($"Insufficient stock for {item.ProductName} - {item.Sku}.");

                    variant.Stock -= item.Quantity;
                    variant.UpdatedAt = now;
                    _context.InventoryLogs.Add(new InventoryLog
                    {
                        VariantId = variant.Id,
                        ChangeType = InventoryChangeType.Sold,
                        QuantityChanged = -item.Quantity,
                        Reason = $"Order {order.OrderNumber} paid via SePay",
                        UserId = order.UserId
                    });
                }

                order.PaymentStatus = "Paid";
                order.Status = OrderStatus.Processing;
                order.UpdatedAt = now;
                await _context.SaveChangesAsync();
await transaction.CommitAsync();

// ─── Tạo đơn GHN thật sau khi thanh toán SePay thành công ───
if (order.GhnDistrictId.HasValue && !string.IsNullOrWhiteSpace(order.GhnWardCode)
    && string.IsNullOrWhiteSpace(order.GhnOrderCode)) // tránh tạo trùng nếu webhook gọi lại
{
    try
    {
        var orderItemsForGhn = await _context.OrderItems
            .Include(oi => oi.Variant).ThenInclude(v => v!.Product)
            .Where(oi => oi.OrderId == order.Id)
            .ToListAsync();

        var ghnResult = await _ghnService.CreateShippingOrderAsync(new GhnCreateOrderRequest
        {
            PaymentTypeId = "1", // 1 = shop trả ship vì khách đã thanh toán online rồi
            Note = $"Đơn hàng {order.OrderNumber}",
            RequiredNote = "KHONGCHOXEMHANG",
            ToPhone = order.User?.Phone ?? "",
            ToAddress = order.ShippingAddress,
            ToWardCode = order.GhnWardCode,
            ToDistrictId = order.GhnDistrictId.Value,
            Weight = orderItemsForGhn.Sum(i => i.Quantity * 500),
            Length = 20, Width = 20, Height = 10,
            InsuranceValue = order.TotalAmount,
            ServiceTypeId = 2,
            Items = orderItemsForGhn.Select(i => new GhnOrderItem
            {
                Name = i.ProductName, Code = i.Sku, Quantity = i.Quantity,
                Price = (int)i.PricePerItem, Length = 20, Width = 20, Height = 10, Weight = 500
            }).ToList()
        });

        order.GhnOrderCode = ghnResult.OrderCode;
        order.ShippingStatus = "ready_to_pick";
        await _context.SaveChangesAsync();
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Tạo đơn GHN thất bại sau thanh toán cho order #{OrderId}", order.Id);
        // Không fail cả webhook — admin có thể tạo tay qua ShippingController.CreateShipment
    }
}

await _hubContext.Clients.User(order.UserId.ToString())
    .SendAsync("ReceivePaymentSuccess", order.Id, "Thanh toan thanh cong");

// Báo Admin
await NotifyAdminNewOrder(order, _hubContext);

return Ok(ApiResponse<object>.Ok(new { orderId = order.Id }, "Payment confirmed."));
                var paymentTx = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.OrderId == order.Id && t.Status == "Pending");

                if (paymentTx == null)
                {
                    paymentTx = new PaymentTransaction
                    {
                        OrderId = order.Id,
                        Amount = order.TotalAmount,
                        CreatedAt = now
                    };
                    _context.PaymentTransactions.Add(paymentTx);
                }

                paymentTx.Gateway = "SePay";
                paymentTx.PaymentProvider = "SePay";
                paymentTx.TransactionCode = webhook.TransactionId ?? paymentTx.TransactionCode;
                paymentTx.TransactionId = webhook.TransactionId;
                paymentTx.VaNumber = webhook.VaNumber ?? paymentTx.VaNumber;
                paymentTx.Status = "Paid";
                paymentTx.PaidAt = webhook.PaidAt;
                paymentTx.Amount = order.TotalAmount;
                paymentTx.WebhookPayload = rawPayload;
                paymentTx.UpdatedAt = now;

                if (order.CouponId.HasValue)
                {
                    var alreadyUsed = await _context.CouponUsages
                        .AnyAsync(cu => cu.CouponId == order.CouponId.Value && cu.UserId == order.UserId);
                    if (!alreadyUsed)
                    {
                        _context.CouponUsages.Add(new CouponUsage
                        {
                            CouponId = order.CouponId.Value,
                            UserId = order.UserId,
                            UsedAt = now
                        });

                        var coupon = await _context.Coupons.FindAsync(order.CouponId.Value);
                        if (coupon != null)
                        {
                            coupon.UsedCount += 1;
                            coupon.UpdatedAt = now;
                        }
                    }
                }

                var cart = await _context.Carts
                    .Include(c => c.CartItems)
                    .FirstOrDefaultAsync(c => c.UserId == order.UserId);
                if (cart != null)
                {
                    _context.CartItems.RemoveRange(cart.CartItems);
                    _context.Carts.Remove(cart);
                }

                _context.Notifications.Add(new Notification
                {
                    UserId = order.UserId,
                    Message = $"Thanh toan don hang #{order.Id} thanh cong",
                    Type = "Success",
                    IsRead = false,
                    CreatedAt = now
                });

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                await _hubContext.Clients.User(order.UserId.ToString())
                    .SendAsync("ReceivePaymentSuccess", order.Id, "Thanh toan thanh cong");

                return Ok(ApiResponse<object>.Ok(new { orderId = order.Id }, "Payment confirmed."));
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "FinalizePaidOrderAsync failed for OrderId={OrderId}", orderId);
                return StatusCode(500, ApiResponse<object>.Fail("Could not finalize payment.", ex.Message));
            }
            });
        }

        private async Task MarkPaymentFailedAsync(SepayWebhookPayload webhook, string rawPayload)
        {
            var tx = await _context.PaymentTransactions
                .FirstOrDefaultAsync(t =>
                    (!string.IsNullOrWhiteSpace(webhook.VaNumber) && t.VaNumber == webhook.VaNumber) ||
                    (!string.IsNullOrWhiteSpace(webhook.TransactionId) && t.TransactionId == webhook.TransactionId));

            if (tx == null)
                return;

            tx.Status = "Failed";
            tx.TransactionId = webhook.TransactionId;
            tx.FailureReason = webhook.Status;
            tx.WebhookPayload = rawPayload;
            tx.UpdatedAt = DateTime.UtcNow;

            var order = await _context.Orders.FindAsync(tx.OrderId);
            if (order != null && order.PaymentStatus == "Pending")
            {
                order.PaymentStatus = "Failed";
                order.UpdatedAt = DateTime.UtcNow;
                await _hubContext.Clients.User(order.UserId.ToString()).SendAsync("ReceivePaymentFailed", order.Id);
            }

            await _context.SaveChangesAsync();
        }

        private async Task<Order?> FindOrderFromWebhookAsync(SepayWebhookPayload webhook)
        {
            if (!string.IsNullOrWhiteSpace(webhook.VaNumber))
            {
                var tx = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.VaNumber == webhook.VaNumber && t.Status == "Pending");
                if (tx != null)
                    return await _context.Orders.FirstOrDefaultAsync(o => o.Id == tx.OrderId);
            }

            var orderId = ExtractOrderId(webhook.TransferContent ?? string.Empty);
            return orderId > 0
                ? await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId)
                : null;
        }

        private CreatePaymentResponse BuildCreatePaymentResponse(Order order, PaymentTransaction tx, int remainingSeconds)
        {
            var content = string.IsNullOrWhiteSpace(tx.TransactionCode) ? $"THEBOB_{order.Id}" : tx.TransactionCode;
            return new CreatePaymentResponse
            {
                Success = true,
                VaNumber = tx.VaNumber ?? string.Empty,
                Amount = tx.Amount,
                BankName = "SePay",
                BankAccount = tx.VaNumber ?? string.Empty,
                AccountName = "THEBOB",
                TransferContent = content,
                QrCode = $"https://img.vietqr.io/image/{_sepayService.GetBankBin()}-{Uri.EscapeDataString(tx.VaNumber ?? string.Empty)}-compact.png?amount={decimal.ToInt64(tx.Amount)}&addInfo={Uri.EscapeDataString(content)}&accountName=THEBOB",
                ExpiredAt = DateTime.UtcNow.AddSeconds(Math.Max(0, remainingSeconds))
            };
        }

        private async Task ExpireOrderAsync(Order order)
        {
            order.Status = OrderStatus.Cancelled;
            order.PaymentStatus = "Expired";
            order.UpdatedAt = DateTime.UtcNow;

            var tx = await _context.PaymentTransactions.FirstOrDefaultAsync(t => t.OrderId == order.Id && t.Status == "Pending");
            if (tx != null)
            {
                tx.Status = "Expired";
                tx.FailureReason = "Payment expired";
                tx.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        private static int GetRemainingSeconds(Order order)
        {
            return PaymentWindowSeconds - (int)Math.Floor((DateTime.UtcNow - order.CreatedAt).TotalSeconds);
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

            var digits = new string(orderInfo.Where(char.IsDigit).ToArray());
            return int.TryParse(digits, out var orderId) ? orderId : 0;
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
