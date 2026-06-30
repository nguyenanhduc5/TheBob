using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Hubs;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // All order operations require authentication
    public class OrdersController : ControllerBase
    {
        private readonly ThebobDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        private readonly IGhnService _ghnService;
private readonly ILogger<OrdersController> _logger;

public OrdersController(
    ThebobDbContext context,
    IHubContext<OrderHub> hubContext,
    IGhnService ghnService,
    ILogger<OrdersController> logger)
{
    _context = context;
    _hubContext = hubContext;
    _ghnService = ghnService;
    _logger = logger;
}

        // GET: api/orders (user's orders)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetOrders()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

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
                .AsSplitQuery() // Prevent cartesian explosion
                .ToListAsync();

            return Ok(orders.Select(ToOrderDto));
        }

        // GET: api/orders/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetOrder(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

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

            if (!IsCurrentUserAdmin())
            {
                query = query.Where(o => o.UserId == userId);
            }

            var order = await query.FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
                return NotFound();

            return Ok(ToOrderDto(order));
        }

        // GET: api/orders/status/{id}
        // Fallback nhẹ cho PaymentPage: dùng khi vừa render/F5 hoặc SignalR vừa reconnect.
        [HttpGet("status/{id}")]
        public async Task<ActionResult<object>> GetOrderStatus(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var query = _context.Orders
                .Include(o => o.PaymentTransactions)
                .AsQueryable();

            if (!IsCurrentUserAdmin())
                query = query.Where(o => o.UserId == userId.Value);

            var order = await query.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null)
                return NotFound(new { message = "Không tìm thấy đơn hàng." });

            var latestTransaction = order.PaymentTransactions
                .OrderByDescending(t => t.PaidAt ?? t.UpdatedAt)
                .FirstOrDefault();

            return Ok(new
            {
                orderId = order.Id,
                status = order.Status.ToString(),
                paymentStatus = order.PaymentStatus,
                isPaid = order.PaymentStatus == "Paid" || order.Status == OrderStatus.Paid,
                transactionCode = latestTransaction?.TransactionCode ?? string.Empty
            });
        }

        // POST: api/orders OR api/orders/checkout (checkout from cart)
        [HttpPost]
        [HttpPost("checkout")]
        public async Task<ActionResult<object>> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            await AutoCancelExpiredOrdersAsync();

            var pendingPaymentOrder = await _context.Orders
                .Where(o => o.UserId == userId.Value
                    && o.Status == OrderStatus.PendingPayment
                    && o.PaymentStatus == "Pending")
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();

            if (pendingPaymentOrder != null)
            {
                return Conflict(new
                {
                    message = "Bạn đang có đơn hàng chờ thanh toán",
                    orderId = pendingPaymentOrder.Id
                });
            }

            // Run database updates inside an atomic transaction
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await _context.LockUserForCartMutationAsync(userId.Value);

                var cart = await _context.Carts
                    .FirstOrDefaultAsync(c => c.UserId == userId.Value);

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
                    return BadRequest(new { message = "Cart is empty" });

                // Validate stock availability
                var hasStockIssue = false;
                var stockInfoList = new List<object>();

                foreach (var item in cart.CartItems)
                {
                    if (item.Variant?.Product == null || item.Variant.Size == null || item.Variant.Color == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { success = false, message = "Cấu trúc sản phẩm trong giỏ hàng không hợp lệ." });
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
                    return BadRequest(new
                    {
                        success = false,
                        message = "Một số sản phẩm trong giỏ hàng đã thay đổi tồn kho. Vui lòng cập nhật lại giỏ hàng trước khi thanh toán.",
                        stockInfo = stockInfoList
                    });
                }

                // Generate unique order number
                var orderNumber = GenerateOrderNumber();

                // Calculate total
                // THAY DÒNG NÀY:
// var subtotal = cart.CartItems.Sum(ci => ci.Variant.Price * ci.Quantity);
// var shippingAmount = subtotal > 500000 ? 0 : 30000;

// BẰNG:
var subtotal = cart.CartItems.Sum(ci => ci.Variant.Price * ci.Quantity);
var totalWeight = cart.CartItems.Sum(ci => ci.Quantity * 500); // 500g/sp mặc định

decimal shippingAmount = 30000; // fallback nếu GHN lỗi (sandbox đôi khi down)
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

var totalAmount = subtotal + shippingAmount;

                bool isCod = request.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase);

                // Create order
                var shippingAddress = BuildShippingAddress(request);

                var order = new Order
{
    OrderNumber = orderNumber,
    UserId = userId.Value,
    Status = isCod ? OrderStatus.Pending : OrderStatus.PendingPayment,
    TotalAmount = totalAmount,
    ShippingFee = shippingAmount,          // ← mới
    ShippingAddress = shippingAddress,
    PaymentMethod = request.PaymentMethod,
    PaymentStatus = "Pending",
    GhnProvinceId = request.GhnProvinceId, // ← mới
    GhnDistrictId = request.GhnDistrictId, // ← mới
    GhnWardCode = request.GhnWardCode,     // ← mới
    CreatedAt = DateTime.UtcNow,
    UpdatedAt = DateTime.UtcNow
};

                _context.Orders.Add(order);
                await _context.SaveChangesAsync();

                // Validate payment transaction fields before insertion
                if (order.Id <= 0)
                    throw new InvalidOperationException("Mã đơn hàng không hợp lệ (OrderId <= 0).");
                if (totalAmount <= 0)
                    throw new InvalidOperationException("Số tiền thanh toán phải lớn hơn 0.");
                if (string.IsNullOrWhiteSpace(request.PaymentMethod))
                    throw new InvalidOperationException("Phương thức thanh toán (Gateway) không được để trống.");

                // Create payment transaction
                var paymentTx = new PaymentTransaction
                {
                    OrderId = order.Id,
                    Gateway = isCod ? "COD" : "SePay",
                    PaymentProvider = isCod ? "COD" : "SePay",
                    TransactionCode = request.TransactionCode ?? string.Empty,
                    Amount = totalAmount,
                    Status = "Pending", // Default status is Pending
                    RawResponse = request.RawPaymentResponse ?? string.Empty,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.PaymentTransactions.Add(paymentTx);

                // Create order items and reduce stock only if COD
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
                        // Reduce stock
                        cartItem.Variant.Stock -= cartItem.Quantity;

                        // Log inventory change
                        LogInventoryChange(cartItem.VariantId, InventoryChangeType.Sold,
                            -cartItem.Quantity, $"Order {orderNumber} (COD)", userId);
                    }
                }


              if (isCod)
{
    _context.CartItems.RemoveRange(cart.CartItems);
    _context.Carts.Remove(cart);
}
_context.Orders.Add(order);
await _context.SaveChangesAsync();
// ── SNAPSHOT trước khi xóa cart ──
var cartItemsSnapshot = cart.CartItems.ToList();


await transaction.CommitAsync();

// ─── Tạo đơn GHN thật ngay cho COD (sau khi commit để đơn đã chắc chắn lưu) ───
if (isCod && order.GhnDistrictId.HasValue && !string.IsNullOrWhiteSpace(order.GhnWardCode))
{
    try
    {
        
        // ── Tạo đơn GHN cho COD ──
var ghnResult = await _ghnService.CreateShippingOrderAsync(new GhnCreateOrderRequest
{
    PaymentTypeId = "2",                        // ✅ string — đúng rồi, giữ nguyên
    Note = $"Đơn hàng {order.OrderNumber}",
    RequiredNote = "KHONGCHOXEMHANG",
    ToName = request.Email,
    ToPhone = request.Phone,
    ToAddress = request.SpecificAddress,
    ToWardCode = order.GhnWardCode,
    ToDistrictId = order.GhnDistrictId.Value,
    Weight = totalWeight,
    Length = 20, Width = 20, Height = 10,
    InsuranceValue = (long)totalAmount,         // ✅ cast decimal → long
    ServiceTypeId = 2,
    Items = cart.CartItems.Select(ci => new GhnOrderItem
    {
        Name = ci.Variant.Product!.Name,
        Code = ci.Variant.Id, // GhnOrderItem.Code là int, dùng VariantId thay cho Sku (string)                       // ✅ int — Sku là string nên dùng 0 hoặc hash
        Quantity = ci.Quantity,
        Price = (int)ci.Variant.Price,
        Length = 20, Width = 20, Height = 10, Weight = 500
    }).ToList()
});


// ── Tính phí GHN ──
var feeResult = await _ghnService.CalculateFeeAsync(new GhnFeeRequest
{
    ToDistrictId = request.GhnDistrictId.Value,
    ToWardCode = request.GhnWardCode,
    Weight = totalWeight,
    InsuranceValue = (long)subtotal,            // ✅ cast decimal → long
    ServiceTypeId = 2
});
shippingAmount = feeResult.Total;
        order.GhnOrderCode = ghnResult.OrderCode;
        order.ShippingStatus = "ready_to_pick";
        await _context.SaveChangesAsync();

        _logger.LogInformation("Đã tạo đơn GHN {Code} cho order COD #{OrderId}", ghnResult.OrderCode, order.Id);
    }
    catch (Exception ex)
    {
        // Không rollback đơn hàng nếu GHN lỗi — chỉ log để admin tạo tay sau (đã có UI sẵn ở ShippingController)
        _logger.LogError(ex, "Tạo đơn GHN thất bại cho order COD #{OrderId}, admin cần tạo tay", order.Id);
    }
}

// Báo Admin (xem Bước 7)
await NotifyAdminNewOrder(order, _hubContext);

                // Fetch complete order payload to return
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

                return CreatedAtAction(nameof(GetOrder), new { id = completeOrder.Id }, ToOrderDto(completeOrder));
            }
            catch (Exception ex)
            {
                try
                {
                    await transaction.RollbackAsync();
                }
                catch
                {
                    // Ignore rollback errors
                }
                return StatusCode(500, new { message = ex.Message, stack = ex.StackTrace });
            }
            });
        }

        // GET: api/orders/admin/all (admin only)
        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetAllOrders()
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

            return Ok(orders.Select(ToOrderDto));
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
            await AutoCancelExpiredOrdersAsync();

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var baseQuery = _context.Orders.AsQueryable();

            // Apply search filter if present
            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.Trim().ToLower();
                baseQuery = baseQuery.Where(o =>
                    o.OrderNumber.ToLower().Contains(searchLower) ||
                    (o.User != null && o.User.FullName != null && o.User.FullName.ToLower().Contains(searchLower)) ||
                    (o.User != null && o.User.Email != null && o.User.Email.ToLower().Contains(searchLower))
                );
            }

            // Get counts based on search query before pagination
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

            // Apply status filter if present
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

            return Ok(new
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
            });
        }

        // PUT: api/orders/{id}/status (admin only)
        [HttpPut("{id}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusRequest request)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant!)
                .FirstOrDefaultAsync(o => o.Id == id);
            if (order == null)
                return NotFound(new { message = "Không tìm thấy đơn hàng" });

            var currentStatus = order.Status;
            var newStatus = request.Status;

            // If same status, do nothing
            if (currentStatus == newStatus)
            {
                return Ok(ToOrderDto(order));
            }

            // Cannot transition out of terminal statuses
            if (currentStatus == OrderStatus.Delivered || currentStatus == OrderStatus.Cancelled)
            {
                return BadRequest(new { message = $"Không thể cập nhật trạng thái cho đơn hàng đã {GetStatusString(currentStatus)}" });
            }

            bool isValid = false;

            // Allow cancellation from any state prior to Delivery
            if (newStatus == OrderStatus.Cancelled)
            {
                isValid = true;
            }
            // Allow transitions from PendingPayment
            else if (currentStatus == OrderStatus.PendingPayment && (newStatus == OrderStatus.Pending || newStatus == OrderStatus.Processing))
            {
                isValid = true;
            }
            // Strict forward progression: Pending -> Processing -> Shipped -> Delivered
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
                return BadRequest(new { message = $"Chuyển đổi trạng thái không hợp lệ từ [{GetStatusString(currentStatus)}] sang [{GetStatusString(newStatus)}]" });
            }

            if (newStatus == OrderStatus.Cancelled)
            {
                RestoreOrderStock(order, $"Cancelled order {order.OrderNumber}", GetCurrentUserId());
                order.PaymentStatus = order.PaymentStatus == "Completed" ? "Refunded" : "Cancelled";
            }
            else if (currentStatus == OrderStatus.PendingPayment && (newStatus == OrderStatus.Pending || newStatus == OrderStatus.Processing))
            {
                return BadRequest(new { message = "Vui lòng dùng nút Xác nhận thanh toán để chuyển đơn chờ thanh toán sang xử lý." });
            }
            else if (newStatus == OrderStatus.Delivered && order.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase))
            {
                order.PaymentStatus = "Completed";
            }

            order.Status = newStatus;
            order.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Notify customer in real-time via SignalR
            try
            {
                await _hubContext.Clients.User(order.UserId.ToString())
                    .SendAsync("ReceiveStatusUpdate", order.Id, order.Status.ToString());
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SignalR Notification Warning] Failed to notify user {order.UserId}: {ex.Message}");
            }

            return Ok(ToOrderDto(order));
        }

        // PUT: api/orders/{id}/cancel (customer can cancel own order before shipping)
        [HttpPut("{id}/cancel")]
        public async Task<ActionResult<object>> CancelOrder(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

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
                .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId);

            if (order == null)
                return NotFound(new { message = "Không tìm thấy đơn hàng" });

            if (order.Status == OrderStatus.Cancelled)
                return BadRequest(new { message = "Đơn hàng đã được hủy trước đó" });

            if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Processing && order.Status != OrderStatus.PendingPayment)
                return BadRequest(new { message = "Không thể hủy đơn hàng ở trạng thái này" });

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

                return Ok(ToOrderDto(order));
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Lỗi khi hủy đơn hàng", error = ex.Message });
            }
            });
        }

        // PATCH: /api/admin/orders/{id}/confirm (admin only)
        [HttpPatch("/api/admin/orders/{id}/confirm")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ConfirmOrderManual(int id)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var now = DateTime.UtcNow;

                    var order = await _context.Orders
                        .FromSqlRaw("SELECT * FROM Orders WHERE Id = {0} FOR UPDATE", id)
                        .AsTracking()
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant)
                        .FirstOrDefaultAsync();

                    if (order == null)
                    {
                        await transaction.RollbackAsync();
                        return NotFound(new { message = "Không tìm thấy đơn hàng" });
                    }

                    // Validate: only Pending (PendingPayment or Pending) can be confirmed
                    if (order.Status != OrderStatus.PendingPayment && order.Status != OrderStatus.Pending)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "Chỉ đơn hàng chờ thanh toán hoặc chờ xử lý mới được xác nhận thanh toán." });
                    }

                    if (order.PaymentStatus == "Paid")
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "Đơn hàng đã được thanh toán trước đó." });
                    }

                    // Deduct stock if it was online payment (PendingPayment) since stock was not reduced at checkout
                    if (order.Status == OrderStatus.PendingPayment)
                    {
                        var orderItems = await _context.OrderItems
                            .FromSqlRaw("SELECT * FROM OrderItems WHERE OrderId = {0} FOR UPDATE", id)
                            .AsTracking()
                            .ToListAsync();

                        foreach (var item in orderItems)
                        {
                            if (!item.VariantId.HasValue)
                                throw new InvalidOperationException($"Sản phẩm đơn hàng {item.Id} thiếu VariantId.");

                            var variant = await _context.ProductVariants
                                .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", item.VariantId.Value)
                                .AsTracking()
                                .FirstOrDefaultAsync();

                            if (variant == null)
                                throw new InvalidOperationException($"Không tìm thấy thuộc tính sản phẩm {item.VariantId.Value}.");

                            if (variant.Stock < item.Quantity)
                                throw new InvalidOperationException($"Số lượng tồn kho không đủ cho sản phẩm {item.ProductName} - {item.Sku}.");

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

                    // Notify customer via SignalR
                    try
                    {
                        await _hubContext.Clients.User(order.UserId.ToString())
                            .SendAsync("ReceiveOrderUpdate", order.Id, order.Status.ToString());
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[SignalR Notification Warning] Failed to notify user {order.UserId}: {ex.Message}");
                    }

                    // Reload complete order payload to return correct DTO
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

                    return Ok(ToOrderDto(completeOrder));
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { message = "Lỗi khi xác nhận thanh toán đơn hàng", error = ex.Message });
                }
            });
        }

        // PATCH: /api/admin/orders/{id}/cancel (admin only)
        [HttpPatch("/api/admin/orders/{id}/cancel")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CancelOrderManual(int id)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var order = await _context.Orders
                        .FromSqlRaw("SELECT * FROM Orders WHERE Id = {0} FOR UPDATE", id)
                        .AsTracking()
                        .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Variant)
                        .FirstOrDefaultAsync();

                    if (order == null)
                    {
                        await transaction.RollbackAsync();
                        return NotFound(new { message = "Không tìm thấy đơn hàng" });
                    }

                    // Validate: only Pending (PendingPayment, Pending) or Expired can be cancelled
                    bool isPending = order.Status == OrderStatus.PendingPayment || order.Status == OrderStatus.Pending;
                    bool isExpired = order.PaymentStatus == "Expired";

                    if (!isPending && !isExpired)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "Chỉ đơn hàng chờ thanh toán, chờ xử lý hoặc đã hết hạn mới được phép hủy." });
                    }

                    if (order.Status == OrderStatus.Cancelled && !isExpired)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "Đơn hàng đã được hủy trước đó." });
                    }

                    // Restore stock if it was COD or Paid (and not Expired or PendingPayment)
                    if (order.PaymentStatus != "Expired")
                    {
                        RestoreOrderStock(order, $"Admin cancelled order {order.OrderNumber}", GetCurrentUserId());
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

                    // Notify customer via SignalR
                    try
                    {
                        await _hubContext.Clients.User(order.UserId.ToString())
                            .SendAsync("ReceiveOrderUpdate", order.Id, order.Status.ToString());
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[SignalR Notification Warning] Failed to notify user {order.UserId}: {ex.Message}");
                    }

                    // Reload complete order payload
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

                    return Ok(ToOrderDto(completeOrder));
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { message = "Lỗi khi hủy đơn hàng", error = ex.Message });
                }
            });
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

    // Dùng phí ship thực tế đã lưu trong Order
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

        // Thông tin GHN
        GhnOrderCode = order.GhnOrderCode,
        ShippingStatus = order.ShippingStatus,

        // Thông tin thanh toán
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

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? int.Parse(userIdClaim) : null;
        }

        private bool IsCurrentUserAdmin()
        {
            return User.IsInRole("Admin");
        }
// Thêm vào cuối class OrdersController và PaymentController
private async Task NotifyAdminNewOrder(Order order, IHubContext<OrderHub> hubContext)
{
    try
    {
        await hubContext.Clients.Group("Admins")
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
        private async Task AutoCancelExpiredOrdersAsync()
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
                }
                await _context.SaveChangesAsync();
            }
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
    }

    public class UpdateOrderStatusRequest
    {
        public OrderStatus Status { get; set; }
    }
    
}
