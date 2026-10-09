using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using THEBOB.Controllers;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models;
using THEBOB.Exceptions;

namespace THEBOB.Services
{
    public class PaymentService : IPaymentService
    {
        private const int PaymentWindowSeconds = 15 * 60;

        private sealed record PaymentOrderMatch(int OrderId, string OrderNumber, string PaymentStatus, decimal TotalAmount);

        private readonly ThebobDbContext _context;
        private readonly SepayService _sepayService;
        private readonly IGhnService _ghnService;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly ILogger<PaymentService> _logger;

        public PaymentService(
            ThebobDbContext context,
            SepayService sepayService,
            IHubContext<OrderHub> hubContext,
            IGhnService ghnService,
            ILogger<PaymentService> logger)
        {
            _context = context;
            _sepayService = sepayService;
            _hubContext = hubContext;
            _ghnService = ghnService;
            _logger = logger;
        }

        public async Task<(bool Success, string Message, int StatusCode, CreatePaymentResponse? Data)> CreatePaymentAsync(int orderId, int userId, decimal? customAmount = null)
        {
            try
            {
                var order = await _context.Orders
                    .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

                if (order == null)
                    return (false, "Order not found.", 404, null);

                if (order.PaymentStatus == "Paid")
                    return (false, "Order already paid.", 400, null);

                if (order.Status == OrderStatus.Cancelled || order.PaymentStatus is "Cancelled" or "Expired")
                    return (false, "Order has been cancelled or expired.", 400, null);

                var remainingSeconds = GetRemainingSeconds(order);
                if (remainingSeconds <= 0)
                {
                    await ExpireOrderAsync(order);
                    return (false, "Payment expired.", 400, null);
                }

                var amount = order.TotalAmount;

                var existingTx = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.OrderId == order.Id && t.Status == "Pending" && t.PaymentProvider == "SePay");

                if (existingTx != null && !string.IsNullOrWhiteSpace(existingTx.VaNumber))
                {
                    return (true, string.Empty, 200, BuildCreatePaymentResponse(order, existingTx, remainingSeconds));
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

                var response = new CreatePaymentResponse
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
                };

                return (true, string.Empty, 200, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create SePay payment failed for OrderId={OrderId}", orderId);
                return (false, ex.Message, 500, null);
            }
        }

        public async Task<(bool Success, string Message, int StatusCode, PaymentStatusResponse? Data)> GetPaymentStatusAsync(int orderId, int userId, bool isAdmin)
        {
            try
            {
                var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null)
                    return (false, "Order not found.", 404, null);

                if (order.UserId != userId && !isAdmin)
                    return (false, "Forbidden.", 403, null);

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

                return (true, string.Empty, 200, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetPaymentStatus failed for OrderId={OrderId}", orderId);
                return (false, ex.Message, 500, null);
            }
        }

        public async Task<(bool Success, string Message, int StatusCode)> CancelPaymentAsync(int orderId, int userId)
        {
            try
            {
                var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);
                if (order == null)
                    return (false, "Order not found.", 404);

                if (order.PaymentStatus != "Pending")
                    return (false, "Only pending payments can be cancelled.", 400);

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

                return (true, "Payment cancelled.", 200);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CancelPayment failed for OrderId={OrderId}", orderId);
                return (false, ex.Message, 500);
            }
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> ProcessWebhookAsync(JsonElement payload, HttpRequest request)
        {
            _logger.LogInformation("SePay webhook received: {Payload}", payload.GetRawText());

            if (!_sepayService.VerifyWebhook(request, out var verifyError))
            {
                _logger.LogWarning("Rejected SePay webhook: {Reason}", verifyError);
                return (false, verifyError ?? "Invalid webhook", 401, null);
            }

            try
            {
                var rawPayload = payload.GetRawText();
                var webhook = _sepayService.ParseWebhook(payload);

                if (string.IsNullOrWhiteSpace(webhook.TransactionId))
                    return (false, "Webhook missing transaction id.", 400, null);

                if (!string.Equals(webhook.Status, "Paid", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(webhook.Status, "Success", StringComparison.OrdinalIgnoreCase))
                {
                    await MarkPaymentFailedAsync(webhook, rawPayload);
                    return (true, "Webhook marked as failed.", 200, new { webhook.TransactionId });
                }

                var order = await FindOrderFromWebhookAsync(webhook);
                if (order == null)
                    return (false, "Order not found for SePay webhook.", 404, null);

                return await FinalizePaidOrderAsync(order.Id, webhook, rawPayload);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SePay webhook processing failed.");
                return (false, "Could not process SePay webhook: " + ex.Message, 500, null);
            }
        }

        public async Task<PagedPaymentTransactionsResponse> GetTransactionsAsync(string? status, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

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

            return new PagedPaymentTransactionsResponse
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                Total = total
            };
        }

        public async Task<SepayBankTransactionsResponse> GetSepayTransactionsAsync(
            int limit,
            DateTime? transactionDateMin,
            DateTime? transactionDateMax,
            string? accountNumber)
        {
            if (transactionDateMin.HasValue && transactionDateMax.HasValue
                && transactionDateMin.Value > transactionDateMax.Value)
                throw new ArgumentException("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");

            limit = Math.Clamp(limit, 1, 5000);
            var transactions = await _sepayService.GetTransactions(
                limit, transactionDateMin, transactionDateMax, accountNumber);

            var virtualAccounts = transactions
                .Select(transaction => transaction.SubAccount)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct()
                .ToList();
            var orderIdsFromContent = transactions
                .Select(transaction => ExtractOrderId(transaction.TransactionContent))
                .Where(orderId => orderId > 0)
                .Distinct()
                .ToList();

            var orderByVirtualAccount = new Dictionary<string, PaymentOrderMatch>(StringComparer.OrdinalIgnoreCase);
            if (virtualAccounts.Count > 0)
            {
                var localTransactions = await _context.PaymentTransactions
                    .Where(transaction => transaction.VaNumber != null && virtualAccounts.Contains(transaction.VaNumber))
                    .OrderByDescending(transaction => transaction.UpdatedAt)
                    .Select(transaction => new
                    {
                        transaction.VaNumber,
                        Match = new PaymentOrderMatch(
                            transaction.OrderId,
                            transaction.Order.OrderNumber,
                            transaction.Order.PaymentStatus,
                            transaction.Order.TotalAmount)
                    })
                    .ToListAsync();

                orderByVirtualAccount = localTransactions
                    .GroupBy(transaction => transaction.VaNumber!, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(group => group.Key, group => group.First().Match, StringComparer.OrdinalIgnoreCase);
            }

            var orderById = orderIdsFromContent.Count == 0
                ? new Dictionary<int, PaymentOrderMatch>()
                : await _context.Orders
                    .Where(order => orderIdsFromContent.Contains(order.Id))
                    .Select(order => new PaymentOrderMatch(order.Id, order.OrderNumber, order.PaymentStatus, order.TotalAmount))
                    .ToDictionaryAsync(order => order.OrderId);

            foreach (var transaction in transactions)
            {
                PaymentOrderMatch? match = null;
                if (!string.IsNullOrWhiteSpace(transaction.SubAccount))
                {
                    orderByVirtualAccount.TryGetValue(transaction.SubAccount, out match);
                }
                if (match == null)
                {
                    var orderId = ExtractOrderId(transaction.TransactionContent);
                    orderById.TryGetValue(orderId, out match);
                }
                if (match == null || transaction.AmountIn <= 0)
                    continue;

                transaction.MatchedOrderId = match.OrderId;
                transaction.MatchedOrderNumber = match.OrderNumber;
                transaction.OrderPaymentStatus = match.PaymentStatus;
                transaction.ExpectedAmount = match.TotalAmount;
            }

            return new SepayBankTransactionsResponse
            {
                Items = transactions,
                Limit = limit,
                RetrievedAt = DateTime.UtcNow
            };
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> ConfirmPaymentAsync(ConfirmPaymentRequest request)
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

        private async Task<(bool Success, string Message, int StatusCode, object? Data)> FinalizePaidOrderAsync(int orderId, SepayWebhookPayload webhook, string rawPayload)
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
                        return (true, "Transaction already processed.", 200, (object)new { orderId });
                    }

                    var order = await _context.Orders
                        .FromSqlRaw("SELECT * FROM Orders WHERE Id = {0} FOR UPDATE", orderId)
                        .AsTracking()
                        .FirstOrDefaultAsync();

                    if (order == null)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Order not found.", 404, (object?)null);
                    }

                    if (order.PaymentStatus == "Paid")
                    {
                        await transaction.RollbackAsync();
                        return (true, "Order already paid.", 200, (object)new { orderId });
                    }

                    if (order.PaymentStatus is "Cancelled" or "Expired")
                    {
                        await transaction.RollbackAsync();
                        return (false, "Order is cancelled or expired.", 400, (object?)null);
                    }

                    if (webhook.Amount > 0 && Math.Abs(order.TotalAmount - webhook.Amount) > 0.01m)
                        throw new BadRequestException("Webhook amount does not match order total.");

                    var orderItems = await _context.OrderItems
                        .FromSqlRaw("SELECT * FROM OrderItems WHERE OrderId = {0} FOR UPDATE", orderId)
                        .AsTracking()
                        .ToListAsync();

                    foreach (var item in orderItems)
                    {
                        if (!item.VariantId.HasValue)
                            throw new BadRequestException($"Order item {item.Id} missing VariantId.");

                        var variant = await _context.ProductVariants
                            .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", item.VariantId.Value)
                            .AsTracking()
                            .FirstOrDefaultAsync();

                        if (variant == null)
                            throw new NotFoundException($"Variant {item.VariantId.Value} not found.");

                        if (variant.Stock < item.Quantity)
                            throw new ConflictException($"Insufficient stock for {item.ProductName} - {item.Sku}.");

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

                    if (order.GhnDistrictId.HasValue && !string.IsNullOrWhiteSpace(order.GhnWardCode)
                        && string.IsNullOrWhiteSpace(order.GhnOrderCode))
                    {
                        try
                        {
                            order.User = await _context.Users.FindAsync(order.UserId) ?? order.User;

                            var orderItemsForGhn = await _context.OrderItems
                                .Include(oi => oi.Variant).ThenInclude(v => v!.Product)
                                .Where(oi => oi.OrderId == order.Id)
                                .ToListAsync();

                            var ghnRequest = GhnOrderRequestBuilder.FromOrder(order, orderItemsForGhn);
                            var ghnResult = await _ghnService.CreateShippingOrderAsync(ghnRequest);

                            order.GhnOrderCode = ghnResult.OrderCode;
                            order.ShippingStatus = "ready_to_pick";
                            await _context.SaveChangesAsync();

                            _logger.LogInformation(
                                "Đã tạo đơn GHN {Code} (PaymentTypeId=2, CodAmount=0) cho order #{OrderId}",
                                ghnResult.OrderCode, order.Id);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex,
                                "Tạo đơn GHN thất bại sau thanh toán cho order #{OrderId}. " +
                                "Admin có thể liên kết thủ công qua PATCH /api/admin/orders/{OrderId}/ghn-code",
                                order.Id, order.Id);
                        }
                    }

                    await _hubContext.Clients.User(order.UserId.ToString())
                        .SendAsync("ReceivePaymentSuccess", order.Id, "Thanh toan thanh cong");

                    await NotifyAdminNewOrder(order);
                    await NotifyAdminPaymentSuccess(order);

                    return (true, "Payment confirmed.", 200, (object)new { orderId = order.Id });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "FinalizePaidOrderAsync failed for OrderId={OrderId}", orderId);
                    return (false, "Could not finalize payment: " + ex.Message, 500, (object?)null);
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
                QrCode = $"https://img.vietqr.io/image/{_sepayService.GetBankBin()}-{Uri.EscapeDataString(tx.VaNumber ?? string.Empty)}-compact.png?amount={(long)tx.Amount}&addInfo={Uri.EscapeDataString(content)}&accountName=THEBOB",
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

        private async Task NotifyAdminNewOrder(Order order)
        {
            try
            {
                await _hubContext.Clients.Group("Admins")
                    .SendAsync("ReceiveNewOrder", new
                    {
                        orderId = order.Id,
                        orderNumber = order.OrderNumber,
                        totalAmount = order.TotalAmount,
                        paymentMethod = order.PaymentMethod,
                        createdAt = order.CreatedAt
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "NotifyAdminNewOrder failed for order #{OrderId}", order.Id);
            }
        }

        private async Task NotifyAdminPaymentSuccess(Order order)
        {
            try
            {
                await _hubContext.Clients.Group("Admins")
                    .SendAsync("ReceivePaymentSuccess", order.Id, "Thanh toán thành công");
                await _hubContext.Clients.Group("Admins")
                    .SendAsync("ReceiveStatusUpdate", order.Id, order.Status.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "NotifyAdminPaymentSuccess failed for order #{OrderId}", order.Id);
            }
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
}
