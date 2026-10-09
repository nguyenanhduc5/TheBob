using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using THEBOB.Controllers;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models;
using THEBOB.Models.Promotion;
using THEBOB.Services.Promotion;
using THEBOB.Exceptions;
using THEBOB.Infrastructure.Messaging;

namespace THEBOB.Services
{
    public class OrderService : IOrderService
    {
        private readonly ThebobDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly IGhnService _ghnService;
        private readonly ILogger<OrderService> _logger;
        private readonly IPromotionEngine _promotionEngine;

        public OrderService(
            ThebobDbContext context,
            IHubContext<OrderHub> hubContext,
            IGhnService ghnService,
            ILogger<OrderService> logger,
            IPromotionEngine promotionEngine)
        {
            _context = context;
            _hubContext = hubContext;
            _ghnService = ghnService;
            _logger = logger;
            _promotionEngine = promotionEngine;
        }

        public async Task<List<object>> GetUserOrdersAsync(int userId)
        {
            await AutoCancelExpiredOrdersAsync();

            var orders = await _context.Orders
                .Where(o => o.UserId == userId)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Product!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Size!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Color!)
                .Include(o => o.PaymentTransactions)
                .OrderByDescending(o => o.CreatedAt)
                .AsSplitQuery()
                .ToListAsync();

            return orders.Select(ToOrderDto).ToList();
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> GetOrderByIdAsync(int orderId, int userId, bool isAdmin)
        {
            await AutoCancelExpiredOrdersAsync();

            var query = _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Product!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Size!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Color!)
                .Include(o => o.PaymentTransactions)
                .Include(o => o.User)
                .AsSplitQuery()
                .AsQueryable();

            if (!isAdmin)
            {
                query = query.Where(o => o.UserId == userId);
            }

            var order = await query.FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
                return (false, "Không tìm thấy đơn hàng", 404, null);

            return (true, string.Empty, 200, ToOrderDto(order));
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> GetOrderStatusAsync(int orderId, int userId, bool isAdmin)
        {
            var query = _context.Orders
                .Include(o => o.PaymentTransactions)
                .AsQueryable();

            if (!isAdmin)
                query = query.Where(o => o.UserId == userId);

            var order = await query.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
                return (false, "Không tìm thấy đơn hàng.", 404, null);

            var latestTransaction = order.PaymentTransactions
                .OrderByDescending(t => t.PaidAt ?? t.UpdatedAt)
                .FirstOrDefault();

            var data = new
            {
                orderId = order.Id,
                status = order.Status.ToString(),
                paymentStatus = order.PaymentStatus,
                isPaid = order.PaymentStatus == "Paid" || order.Status == OrderStatus.Paid,
                transactionCode = latestTransaction?.TransactionCode ?? string.Empty
            };

            return (true, string.Empty, 200, data);
        }
        public async Task<(bool Success, string Message, int StatusCode, object? Data)> CreateOrderAsync(int userId, CreateOrderRequest request)
        {
            await AutoCancelExpiredOrdersAsync();

            var pendingPaymentOrder = await _context.Orders
                .Where(o => o.UserId == userId
                    && o.Status == OrderStatus.PendingPayment
                    && o.PaymentStatus == "Pending")
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();

            if (pendingPaymentOrder != null)
            {
                return (false, "Bạn đang có đơn hàng chờ thanh toán", 409, new { orderId = pendingPaymentOrder.Id });
            }

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    await _context.LockUserForCartMutationAsync(userId);

                    var cart = await _context.Carts
                        .FirstOrDefaultAsync(c => c.UserId == userId);

                    if (cart != null)
                    {
                        await _context.Entry(cart)
                            .Collection(c => c.CartItems)
                            .Query()
                            .Include(ci => ci.Variant)
                            .ThenInclude(v => v!.Product)
                            .Include(ci => ci.Variant)
                            .ThenInclude(v => v!.Size)
                            .Include(ci => ci.Variant)
                            .ThenInclude(v => v!.Color)
                            .LoadAsync();
                    }

                    if (cart == null || !cart.CartItems.Any())
                        return (false, "Cart is empty", 400, (object?)null);

                    var hasStockIssue = false;
                    var stockInfoList = new List<object>();

                    foreach (var item in cart.CartItems)
                    {
                        if (item.Variant?.Product == null || item.Variant.Size == null || item.Variant.Color == null)
                        {
                            await transaction.RollbackAsync();
                            return (false, "Cấu trúc sản phẩm trong giỏ hàng không hợp lệ.", 400, (object?)null);
                        }

                        var isAvailable = item.Variant.IsAvailable && item.Variant.Stock >= item.Quantity;
                        if (!isAvailable)
                        {
                            hasStockIssue = true;
                        }

                        stockInfoList.Add(new
                        {
                            variantId = item.VariantId,
                            availableStock = item.Variant.Stock
                        });
                    }

                    if (hasStockIssue)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Một số sản phẩm trong giỏ hàng đã thay đổi tồn kho. Vui lòng cập nhật lại giỏ hàng trước khi thanh toán.", 400, (object?)new { stockInfo = stockInfoList });
                    }

                    var orderNumber = GenerateOrderNumber();
                    var subtotal = cart.CartItems.Sum(ci => ci.Variant.Price * ci.Quantity);
                    var totalWeight = cart.CartItems.Sum(ci => ci.Quantity * 500);

                    decimal shippingAmount = 30000;
                    if (request.GhnDistrictId.HasValue && !string.IsNullOrWhiteSpace(request.GhnWardCode))
                    {
                        try
                        {
                            var feeResult = await _ghnService.CalculateFeeAsync(new GhnFeeRequest
                            {
                                ToDistrictId = request.GhnDistrictId.Value,
                                ToWardCode = request.GhnWardCode,
                                Weight = totalWeight,
                                InsuranceValue = (int)subtotal,
                                ServiceTypeId = 2
                            });
                            shippingAmount = feeResult.Total;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "GHN fee calculation failed, dùng phí fallback 30000");
                        }
                    }

                    var orderCount = await _context.Orders
                        .CountAsync(o => o.UserId == userId &&
                            (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Paid));

                    var user = await _context.Users.AsNoTracking()
                        .FirstOrDefaultAsync(u => u.Id == userId);

                    var promotionContext = new PromotionContext
                    {
                        UserId = userId,
                        User = new PromotionUserInfo
                        {
                            Id = userId,
                            Email = user?.Email ?? string.Empty,
                            CustomerGroupId = user?.CustomerGroupId,
                            DateOfBirth = user?.DateOfBirth,
                            TotalSpent = user?.TotalSpent ?? 0,
                            PreviousOrderCount = orderCount
                        },
                        CartItems = cart.CartItems.Select(ci => new PromotionCartItem
                        {
                            VariantId = ci.VariantId,
                            ProductId = ci.Variant!.ProductId,
                            CategoryId = ci.Variant.Product?.CategoryId,
                            BrandId = ci.Variant.Product?.BrandId,
                            Sku = ci.Variant.Sku ?? string.Empty,
                            ProductName = ci.Variant.Product?.Name ?? string.Empty,
                            UnitPrice = ci.Variant.Price,
                            Quantity = ci.Quantity
                        }).ToList(),
                        ShippingFee = shippingAmount,
                        CouponCode = request.CouponCode,
                        UserCouponId = request.UserCouponId
                    };

                    var promotionResult = await _promotionEngine.CalculateAsync(promotionContext);
                    var finalAmount = promotionResult.FinalAmount;
                    var totalAmount = finalAmount;

                    bool isCod = request.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase);
                    var shippingAddress = BuildShippingAddress(request);

                    var order = new Order
                    {
                        OrderNumber = orderNumber,
                        UserId = userId,
                        Status = isCod ? OrderStatus.Pending : OrderStatus.PendingPayment,
                        SubtotalAmount = subtotal,
                        PromotionDiscount = promotionResult.AutomaticDiscount,
                        CouponDiscount = promotionResult.CouponDiscount,
                        ShippingDiscount = promotionResult.ShippingDiscount,
                        TotalDiscount = promotionResult.TotalDiscount,
                        FinalAmount = promotionResult.FinalAmount,
                        TotalAmount = promotionResult.FinalAmount,
                        ShippingFee = promotionResult.FinalShipping,
                        DiscountAmount = promotionResult.TotalDiscount,
                        AppliedCouponCode = promotionResult.AppliedCouponCode,
                        CouponCode = promotionResult.AppliedCouponCode,
                        PromotionSnapshot = JsonSerializer.Serialize(promotionResult.AppliedPromotions),
                        ShippingAddress = shippingAddress,
                        PaymentMethod = request.PaymentMethod,
                        PaymentStatus = "Pending",
                        GhnProvinceId = request.GhnProvinceId,
                        GhnDistrictId = request.GhnDistrictId,
                        GhnWardCode = request.GhnWardCode,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _context.Orders.Add(order);
                    await _context.SaveChangesAsync();

                    if (order.Id <= 0)
                        throw new BadRequestException("Mã đơn hàng không hợp lệ (OrderId <= 0).");
                    if (totalAmount <= 0)
                        throw new BadRequestException("Số tiền thanh toán phải lớn hơn 0.");
                    if (string.IsNullOrWhiteSpace(request.PaymentMethod))
                        throw new BadRequestException("Phương thức thanh toán (Gateway) không được để trống.");

                    var paymentTx = new PaymentTransaction
                    {
                        OrderId = order.Id,
                        Gateway = isCod ? "COD" : "SePay",
                        PaymentProvider = isCod ? "COD" : "SePay",
                        TransactionCode = request.TransactionCode ?? string.Empty,
                        Amount = totalAmount,
                        Status = "Pending",
                        RawResponse = request.RawPaymentResponse ?? string.Empty,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.PaymentTransactions.Add(paymentTx);

                    foreach (var cartItem in cart.CartItems)
                    {
                        var orderItem = new OrderItem
                        {
                            OrderId = order.Id,
                            VariantId = cartItem.VariantId,
                            Quantity = cartItem.Quantity,
                            PricePerItem = cartItem.Variant!.Price,
                            ProductName = cartItem.Variant.Product!.Name,
                            Sku = cartItem.Variant.Sku,
                            Size = cartItem.Variant.Size!.Name,
                            Color = cartItem.Variant.Color!.Name,
                            ProductImage = cartItem.Variant.Product.MainImageUrl
                        };

                        _context.OrderItems.Add(orderItem);

                        if (isCod)
                        {
                            cartItem.Variant.Stock -= cartItem.Quantity;
                            LogInventoryChange(cartItem.VariantId, InventoryChangeType.Sold,
                                -cartItem.Quantity, $"Order {orderNumber} (COD)", userId);
                        }
                    }

                    if (isCod)
                    {
                        CartMutationExtensions.DetachTrackedCartItems(_context, cart.Id);
                        await _context.CartItems
                            .Where(ci => ci.CartId == cart.Id)
                            .ExecuteDeleteAsync();
                        _context.Carts.Remove(cart);
                    }

                    await _promotionEngine.CommitUsageAsync(order.Id, userId, promotionResult);

                    await _context.Users
                        .Where(u => u.Id == userId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(u => u.TotalSpent, u => u.TotalSpent + promotionResult.FinalAmount)
                            .SetProperty(u => u.UpdatedAt, DateTime.UtcNow));

                    // Transactional outbox: this event commits atomically with the order.
                    // A separate worker publishes it to Kafka only after the transaction commits.
                    _context.OutboxMessages.Add(new OutboxMessage
                    {
                        Type = "OrderCreated",
                        AggregateId = order.Id.ToString(),
                        Payload = JsonSerializer.Serialize(new OrderCreatedEvent(
                            order.Id,
                            string.IsNullOrWhiteSpace(request.FullName) ? request.Email : request.FullName.Trim(),
                            request.Phone,
                            request.SpecificAddress)),
                        OccurredAt = DateTime.UtcNow
                    });

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    var completeOrder = await _context.Orders
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Product!)
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Size!)
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Color!)
                        .Include(o => o.PaymentTransactions)
                        .AsSplitQuery()
                        .FirstAsync(o => o.Id == order.Id);

                    return (true, string.Empty, 201, ToOrderDto(completeOrder));
                }
                catch (Exception ex)
                {
                    try { await transaction.RollbackAsync(); } catch { }
                    _logger.LogError(ex, "CreateOrder failed for user {UserId}", userId);
                    return (false, ex.Message, 500, (object?)null);
                }
            });
        }
        public async Task<List<object>> GetAllOrdersAsync()
        {
            await AutoCancelExpiredOrdersAsync();

            var orders = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Product!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Size!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Color!)
                .Include(o => o.PaymentTransactions)
                .Include(o => o.User)
                .OrderByDescending(o => o.CreatedAt)
                .AsSplitQuery()
                .ToListAsync();

            return orders.Select(ToOrderDto).ToList();
        }

        public async Task<object> GetAdminOrdersPaginatedAsync(string? search, string? status, int page, int pageSize)
        {
            await AutoCancelExpiredOrdersAsync();

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var baseQuery = _context.Orders.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.Trim().ToLower();
                baseQuery = baseQuery.Where(o =>
                    o.OrderNumber.ToLower().Contains(searchLower) ||
                    (o.User != null && o.User.FullName != null && o.User.FullName.ToLower().Contains(searchLower)) ||
                    (o.User != null && o.User.Email != null && o.User.Email.ToLower().Contains(searchLower))
                );
            }

            var counts = await baseQuery
                .GroupBy(o => 1)
                .Select(g => new
                {
                    All = g.Count(),
                    Pending = g.Count(o => o.PaymentStatus != "Paid" && o.PaymentStatus != "Expired" && o.PaymentStatus != "Cancelled" && o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Delivered),
                    Paid = g.Count(o => o.PaymentStatus == "Paid" || o.Status == OrderStatus.Paid || o.Status == OrderStatus.Processing || o.Status == OrderStatus.Shipped || o.Status == OrderStatus.Delivered),
                    Cancelled = g.Count(o => (o.PaymentStatus == "Cancelled" || o.Status == OrderStatus.Cancelled) && o.PaymentStatus != "Expired"),
                    Expired = g.Count(o => o.PaymentStatus == "Expired")
                })
                .FirstOrDefaultAsync();

            int allCount = counts?.All ?? 0;
            int pendingCount = counts?.Pending ?? 0;
            int paidCount = counts?.Paid ?? 0;
            int cancelledCount = counts?.Cancelled ?? 0;
            int expiredCount = counts?.Expired ?? 0;

            var filteredQuery = baseQuery;
            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                if (status.Equals("pending", StringComparison.OrdinalIgnoreCase))
                {
                    filteredQuery = filteredQuery.Where(o => o.PaymentStatus != "Paid" && o.PaymentStatus != "Expired" && o.PaymentStatus != "Cancelled" && o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Delivered);
                }
                else if (status.Equals("paid", StringComparison.OrdinalIgnoreCase))
                {
                    filteredQuery = filteredQuery.Where(o => o.PaymentStatus == "Paid" || o.Status == OrderStatus.Paid || o.Status == OrderStatus.Processing || o.Status == OrderStatus.Shipped || o.Status == OrderStatus.Delivered);
                }
                else if (status.Equals("cancelled", StringComparison.OrdinalIgnoreCase))
                {
                    filteredQuery = filteredQuery.Where(o => (o.PaymentStatus == "Cancelled" || o.Status == OrderStatus.Cancelled) && o.PaymentStatus != "Expired");
                }
                else if (status.Equals("expired", StringComparison.OrdinalIgnoreCase))
                {
                    filteredQuery = filteredQuery.Where(o => o.PaymentStatus == "Expired");
                }
            }

            int totalItems = await filteredQuery.CountAsync();

            var orders = await filteredQuery
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Product!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Size!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Color!)
                .Include(o => o.PaymentTransactions)
                .Include(o => o.User)
                .OrderByDescending(o => o.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsSplitQuery()
                .ToListAsync();

            return new
            {
                items = orders.Select(ToOrderDto),
                total = totalItems,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalItems / pageSize),
                counts = new
                {
                    all = allCount,
                    pending = pendingCount,
                    paid = paidCount,
                    cancelled = cancelledCount,
                    expired = expiredCount
                }
            };
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> UpdateOrderStatusAsync(int orderId, OrderStatus newStatus, int? currentUserId)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
                return (false, "Không tìm thấy đơn hàng", 404, null);

            var currentStatus = order.Status;

            if (currentStatus == newStatus)
            {
                return (true, string.Empty, 200, ToOrderDto(order));
            }

            if (currentStatus == OrderStatus.Delivered || currentStatus == OrderStatus.Cancelled)
            {
                return (false, $"Không thể cập nhật trạng thái cho đơn hàng đã {GetStatusString(currentStatus)}", 400, null);
            }

            if (newStatus is OrderStatus.Shipped or OrderStatus.Delivered)
            {
                return (false, "Trạng thái giao hàng phải được xác nhận từ GHN bằng cách tạo vận đơn hoặc đồng bộ tracking.", 400, null);
            }

            if (newStatus == OrderStatus.Cancelled && !string.IsNullOrWhiteSpace(order.GhnOrderCode))
            {
                return (false, "Vui lòng hủy vận đơn GHN trước khi hủy đơn hàng.", 400, null);
            }

            bool isValid = false;

            if (newStatus == OrderStatus.Cancelled)
            {
                isValid = true;
            }
            else if (currentStatus == OrderStatus.PendingPayment && (newStatus == OrderStatus.Pending || newStatus == OrderStatus.Processing))
            {
                isValid = true;
            }
            else if (currentStatus == OrderStatus.Pending && newStatus == OrderStatus.Processing)
            {
                isValid = true;
            }
            else if (currentStatus == OrderStatus.Paid && newStatus == OrderStatus.Processing)
            {
                isValid = true;
            }
            else if (currentStatus == OrderStatus.Processing && newStatus == OrderStatus.Shipped)
            {
                isValid = true;
            }
            else if (currentStatus == OrderStatus.Shipped && newStatus == OrderStatus.Delivered)
            {
                isValid = true;
            }

            if (!isValid)
            {
                return (false, $"Chuyển đổi trạng thái không hợp lệ từ [{GetStatusString(currentStatus)}] sang [{GetStatusString(newStatus)}]", 400, null);
            }

            if (newStatus == OrderStatus.Cancelled)
            {
                RestoreOrderStock(order, $"Cancelled order {order.OrderNumber}", currentUserId);
                order.PaymentStatus = order.PaymentStatus == "Completed" ? "Refunded" : "Cancelled";
            }
            else if (currentStatus == OrderStatus.PendingPayment && (newStatus == OrderStatus.Pending || newStatus == OrderStatus.Processing))
            {
                return (false, "Vui lòng dùng nút Xác nhận thanh toán để chuyển đơn chờ thanh toán sang xử lý.", 400, null);
            }
            else if (newStatus == OrderStatus.Delivered && order.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase))
            {
                order.PaymentStatus = "Completed";
            }

            order.Status = newStatus;
            order.UpdatedAt = DateTime.UtcNow;

            string statusVietnamese = newStatus switch
            {
                OrderStatus.Pending => "Chờ xử lý",
                OrderStatus.Processing => "Đang xử lý",
                OrderStatus.Paid => "Đã thanh toán",
                OrderStatus.Shipped => "Đang giao hàng",
                OrderStatus.Delivered => "Đã giao hàng",
                OrderStatus.Cancelled => "Đã hủy",
                OrderStatus.PendingPayment => "Chờ thanh toán",
                _ => newStatus.ToString()
            };

            _context.Notifications.Add(new Notification
            {
                UserId = order.UserId,
                Message = $"Đơn hàng #{order.Id} của bạn đã chuyển sang trạng thái: [{statusVietnamese}]",
                Type = "Info",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            try
            {
                await _hubContext.Clients.User(order.UserId.ToString())
                    .SendAsync("ReceiveStatusUpdate", order.Id, order.Status.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to notify user {UserId}: {Message}", order.UserId, ex.Message);
            }

            return (true, string.Empty, 200, ToOrderDto(order));
        }
        public async Task<(bool Success, string Message, int StatusCode, object? Data)> CancelOrderAsync(int orderId, int userId)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Product!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Size!)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .ThenInclude(v => v.Color!)
                .Include(o => o.User)
                .AsSplitQuery()
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

            if (order == null)
                return (false, "Không tìm thấy đơn hàng", 404, null);

            if (order.Status == OrderStatus.Cancelled)
                return (false, "Đơn hàng đã được hủy trước đó", 400, null);

            if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Processing && order.Status != OrderStatus.PendingPayment)
                return (false, "Không thể hủy đơn hàng ở trạng thái này", 400, null);

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    RestoreOrderStock(order, $"Customer cancelled order {order.OrderNumber}", userId);
                    order.Status = OrderStatus.Cancelled;
                    order.PaymentStatus = order.PaymentStatus == "Completed" ? "Refunded" : "Cancelled";
                    order.UpdatedAt = DateTime.UtcNow;

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return (true, string.Empty, 200, (object?)ToOrderDto(order));
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return (false, "Lỗi khi hủy đơn hàng: " + ex.Message, 500, (object?)null);
                }
            });
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> ConfirmOrderManualAsync(int orderId, int? currentUserId)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var now = DateTime.UtcNow;

                    var order = await _context.Orders
                        .FromSqlRaw("SELECT * FROM Orders WHERE Id = {0} FOR UPDATE", orderId)
                        .AsTracking()
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant)
                        .FirstOrDefaultAsync();

                    if (order == null)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Không tìm thấy đơn hàng", 404, (object?)null);
                    }

                    if (order.Status != OrderStatus.PendingPayment && order.Status != OrderStatus.Pending)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Chỉ đơn hàng chờ thanh toán hoặc chờ xử lý mới được xác nhận thanh toán.", 400, (object?)null);
                    }

                    if (order.PaymentStatus == "Paid")
                    {
                        await transaction.RollbackAsync();
                        return (false, "Đơn hàng đã được thanh toán trước đó.", 400, (object?)null);
                    }

                    if (order.Status == OrderStatus.PendingPayment)
                    {
                        var orderItems = await _context.OrderItems
                            .FromSqlRaw("SELECT * FROM OrderItems WHERE OrderId = {0} FOR UPDATE", orderId)
                            .AsTracking()
                            .ToListAsync();

                        foreach (var item in orderItems)
                        {
                            if (!item.VariantId.HasValue)
                                throw new BadRequestException($"Sản phẩm đơn hàng {item.Id} thiếu VariantId.");

                            var variant = await _context.ProductVariants
                                .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", item.VariantId.Value)
                                .AsTracking()
                                .FirstOrDefaultAsync();

                            if (variant == null)
                                throw new NotFoundException($"Không tìm thấy thuộc tính sản phẩm {item.VariantId.Value}.");

                            if (variant.Stock < item.Quantity)
                                throw new ConflictException($"Số lượng tồn kho không đủ cho sản phẩm {item.ProductName} - {item.Sku}.");

                            variant.Stock -= item.Quantity;
                            variant.UpdatedAt = now;
                            _context.InventoryLogs.Add(new InventoryLog
                            {
                                VariantId = variant.Id,
                                ChangeType = InventoryChangeType.Sold,
                                QuantityChanged = -item.Quantity,
                                Reason = $"Order {order.OrderNumber} paid (Manually Confirmed by Admin)",
                                UserId = order.UserId
                            });
                        }
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

                    paymentTx.Status = "Paid";
                    paymentTx.PaidAt = now;
                    paymentTx.Gateway = paymentTx.Gateway ?? order.PaymentMethod;
                    paymentTx.PaymentProvider = paymentTx.PaymentProvider ?? paymentTx.Gateway ?? order.PaymentMethod;
                    paymentTx.TransactionCode = paymentTx.TransactionCode ?? $"MANUAL_{order.Id}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                    paymentTx.UpdatedAt = now;

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    try
                    {
                        await _hubContext.Clients.User(order.UserId.ToString())
                            .SendAsync("ReceiveOrderUpdate", order.Id, order.Status.ToString());
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Failed to notify user {UserId}: {Message}", order.UserId, ex.Message);
                    }

                    var completeOrder = await _context.Orders
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Product!)
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Size!)
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Color!)
                        .Include(o => o.PaymentTransactions)
                        .Include(o => o.User)
                        .AsSplitQuery()
                        .FirstAsync(o => o.Id == order.Id);

                    return (true, string.Empty, 200, ToOrderDto(completeOrder));
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return (false, "Lỗi khi xác nhận thanh toán đơn hàng: " + ex.Message, 500, (object?)null);
                }
            });
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> CancelOrderManualAsync(int orderId, int? currentUserId)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var order = await _context.Orders
                        .FromSqlRaw("SELECT * FROM Orders WHERE Id = {0} FOR UPDATE", orderId)
                        .AsTracking()
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant)
                        .FirstOrDefaultAsync();

                    if (order == null)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Không tìm thấy đơn hàng", 404, (object?)null);
                    }

                    bool isPending = order.Status == OrderStatus.PendingPayment || order.Status == OrderStatus.Pending;
                    bool isExpired = order.PaymentStatus == "Expired";

                    if (!isPending && !isExpired)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Chỉ đơn hàng chờ thanh toán, chờ xử lý hoặc đã hết hạn mới được phép hủy.", 400, (object?)null);
                    }

                    if (order.Status == OrderStatus.Cancelled && !isExpired)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Đơn hàng đã được hủy trước đó.", 400, (object?)null);
                    }

                    if (order.PaymentStatus != "Expired")
                    {
                        RestoreOrderStock(order, $"Admin cancelled order {order.OrderNumber}", currentUserId);
                    }

                    order.Status = OrderStatus.Cancelled;
                    order.PaymentStatus = "Cancelled";
                    order.UpdatedAt = DateTime.UtcNow;

                    var paymentTx = await _context.PaymentTransactions
                        .FirstOrDefaultAsync(t => t.OrderId == order.Id && t.Status == "Pending");
                    if (paymentTx != null)
                    {
                        paymentTx.Status = "Cancelled";
                        paymentTx.FailureReason = "Cancelled by Admin";
                        paymentTx.UpdatedAt = DateTime.UtcNow;
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    try
                    {
                        await _hubContext.Clients.User(order.UserId.ToString())
                            .SendAsync("ReceiveOrderUpdate", order.Id, order.Status.ToString());
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Failed to notify user {UserId}: {Message}", order.UserId, ex.Message);
                    }

                    var completeOrder = await _context.Orders
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Product!)
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Size!)
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant!)
                        .ThenInclude(v => v.Color!)
                        .Include(o => o.PaymentTransactions)
                        .Include(o => o.User)
                        .AsSplitQuery()
                        .FirstAsync(o => o.Id == order.Id);

                    return (true, string.Empty, 200, ToOrderDto(completeOrder));
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return (false, "Lỗi khi hủy đơn hàng: " + ex.Message, 500, (object?)null);
                }
            });
        }
        public async Task AutoCancelExpiredOrdersAsync()
        {
            var expiryTime = DateTime.UtcNow.AddMinutes(-15);
            var expiredOrders = await _context.Orders
                .Include(o => o.PaymentTransactions)
                .Where(o => o.Status == OrderStatus.PendingPayment && o.CreatedAt < expiryTime)
                .ToListAsync();

            if (expiredOrders.Any())
            {
                foreach (var order in expiredOrders)
                {
                    order.Status = OrderStatus.Cancelled;
                    order.PaymentStatus = "Expired";
                    order.UpdatedAt = DateTime.UtcNow;

                    foreach (var tx in order.PaymentTransactions.Where(t => t.Status == "Pending"))
                    {
                        tx.Status = "Expired";
                        tx.FailureReason = "Payment expired";
                        tx.UpdatedAt = DateTime.UtcNow;
                    }

                    try { await _promotionEngine.RollbackUsageAsync(order.Id); } catch { }
                }
                await _context.SaveChangesAsync();
            }
        }

        private string GenerateOrderNumber()
        {
            return $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}";
        }

        private static string GetStatusString(OrderStatus status)
        {
            return status switch
            {
                OrderStatus.PendingPayment => "Chờ thanh toán",
                OrderStatus.Pending => "Chờ xử lý",
                OrderStatus.Processing => "Đang xử lý",
                OrderStatus.Paid => "Đã thanh toán",
                OrderStatus.Shipped => "Đang giao",
                OrderStatus.Delivered => "Đã giao",
                OrderStatus.Cancelled => "Đã hủy",
                _ => status.ToString()
            };
        }

        private static object ToOrderDto(Order order)
        {
            var subtotal = order.OrderItems != null
                ? order.OrderItems.Sum(item => item.PricePerItem * item.Quantity)
                : 0;

            var shippingAmount = order.ShippingFee;

            var latestTransaction = order.PaymentTransactions?
                .OrderByDescending(t => t.PaidAt ?? t.UpdatedAt)
                .FirstOrDefault();

            return new
            {
                order.Id,
                order.OrderNumber,
                order.UserId,

                CustomerName = order.User?.FullName ?? order.User?.Email,
                CustomerEmail = order.User?.Email ?? string.Empty,
                CustomerPhone = order.User?.Phone ?? string.Empty,

                Status = order.Status.ToString(),
                order.TotalAmount,

                order.ShippingAddress,
                order.PaymentMethod,
                order.PaymentStatus,
                order.CouponId,

                Subtotal = subtotal,
                ShippingAmount = shippingAmount,

                GhnOrderCode = order.GhnOrderCode,
                ShippingStatus = order.ShippingStatus,

                TransactionCode = latestTransaction?.TransactionCode ?? string.Empty,
                TransactionId = latestTransaction?.TransactionId ?? string.Empty,
                VaNumber = latestTransaction?.VaNumber ?? string.Empty,
                PaymentGateway = latestTransaction?.Gateway ?? order.PaymentMethod,
                PaymentProvider = latestTransaction?.PaymentProvider
                                  ?? latestTransaction?.Gateway
                                  ?? order.PaymentMethod,
                PaidAt = latestTransaction?.PaidAt,
                WebhookTime = latestTransaction?.UpdatedAt,
                FailureReason = latestTransaction?.FailureReason ?? string.Empty,

                order.CreatedAt,
                order.UpdatedAt,

                Items = order.OrderItems != null
                    ? order.OrderItems.Select(item => new
                    {
                        item.Id,
                        item.VariantId,

                        ProductId = item.Variant?.ProductId,

                        ProductName = string.IsNullOrWhiteSpace(item.ProductName)
                            ? item.Variant?.Product?.Name ?? string.Empty
                            : item.ProductName,

                        Sku = string.IsNullOrWhiteSpace(item.Sku)
                            ? item.Variant?.Sku ?? string.Empty
                            : item.Sku,

                        Size = string.IsNullOrWhiteSpace(item.Size)
                            ? item.Variant?.Size?.Name ?? string.Empty
                            : item.Size,

                        Color = string.IsNullOrWhiteSpace(item.Color)
                            ? item.Variant?.Color?.Name ?? string.Empty
                            : item.Color,

                        Price = item.PricePerItem,
                        item.Quantity,

                        ImageUrl = string.IsNullOrWhiteSpace(item.ProductImage)
                            ? item.Variant?.Product?.MainImageUrl ?? string.Empty
                            : item.ProductImage
                    })
                    : Enumerable.Empty<object>()
            };
        }

        private static string BuildShippingAddress(CreateOrderRequest request)
        {
            return string.Join(", ", new[]
            {
                request.SpecificAddress?.Trim(),
                request.Ward?.Trim(),
                request.District?.Trim(),
                request.ProvinceCity?.Trim(),
                request.Phone?.Trim(),
                request.Email?.Trim()
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
        }

        private void LogInventoryChange(int variantId, InventoryChangeType changeType, int quantityChanged, string reason, int? userId)
        {
            var log = new InventoryLog
            {
                VariantId = variantId,
                ChangeType = changeType,
                QuantityChanged = quantityChanged,
                Reason = reason,
                UserId = userId
            };

            _context.InventoryLogs.Add(log);
        }

        private void RestoreOrderStock(Order order, string reason, int? userId)
        {
            if (order.Status == OrderStatus.PendingPayment)
            {
                return;
            }

            foreach (var item in order.OrderItems)
            {
                if (item.Variant == null)
                {
                    continue;
                }

                item.Variant.Stock += item.Quantity;
                item.Variant.UpdatedAt = DateTime.UtcNow;
                LogInventoryChange(item.Variant.Id, InventoryChangeType.Returned, item.Quantity, reason, userId);
            }
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
    }
}
