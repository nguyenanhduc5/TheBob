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
    [Authorize] // All order operations require authentication
    public class OrdersController : ControllerBase
    {
        private readonly ThebobDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public OrdersController(ThebobDbContext context, IHubContext<OrderHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        // GET: api/orders (user's orders)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetOrders()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var orders = await _context.Orders
                .Where(o => o.UserId == userId)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Product)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Size)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Color)
                .OrderByDescending(o => o.CreatedAt)
                .AsSplitQuery() // Prevent cartesian explosion and MultipleCollectionIncludeWarning
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

            var query = _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Product)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Size)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Color)
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

        // POST: api/orders (checkout from cart)
        [HttpPost]
        public async Task<ActionResult<object>> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            // Run database updates inside an atomic transaction
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var cart = await _context.Carts
                    .Include(c => c.CartItems)
                    .ThenInclude(ci => ci.Variant)
                    .ThenInclude(v => v.Product)
                    .Include(c => c.CartItems)
                    .ThenInclude(ci => ci.Variant)
                    .ThenInclude(v => v.Size)
                    .Include(c => c.CartItems)
                    .ThenInclude(ci => ci.Variant)
                    .ThenInclude(v => v.Color)
                    .FirstOrDefaultAsync(c => c.UserId == userId);

                if (cart == null || !cart.CartItems.Any())
                    return BadRequest(new { message = "Cart is empty" });

                // Validate stock availability
                foreach (var item in cart.CartItems)
                {
                    if (item.Variant?.Product == null || item.Variant.Size == null || item.Variant.Color == null)
                        return BadRequest(new { message = "Invalid cart item structure" });

                    if (!item.Variant.IsAvailable)
                        return BadRequest(new { message = $"Variant {item.Variant.Sku} is not available" });

                    if (item.Variant.Stock < item.Quantity)
                        return BadRequest(new { message = $"Insufficient stock for {item.Variant.Product.Name} - {item.Variant.Sku}" });
                }

                // Generate unique order number
                var orderNumber = GenerateOrderNumber();

                // Calculate total
                var subtotal = cart.CartItems.Sum(ci => ci.Variant.Price * ci.Quantity);
                var shippingAmount = subtotal > 500000 ? 0 : 30000;
                var totalAmount = subtotal + shippingAmount;

                // Create order
                var order = new Order
                {
                    OrderNumber = orderNumber,
                    UserId = userId.Value,
                    Status = OrderStatus.Pending,
                    TotalAmount = totalAmount,
                    ShippingAddress = request.ShippingAddress,
                    PaymentMethod = request.PaymentMethod,
                    PaymentStatus = "Pending",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Orders.Add(order);
                await _context.SaveChangesAsync();

                // Create payment transaction
                _context.PaymentTransactions.Add(new PaymentTransaction
                {
                    OrderId = order.Id,
                    Gateway = request.PaymentMethod,
                    TransactionCode = request.TransactionCode ?? string.Empty,
                    Amount = totalAmount,
                    Status = request.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase) ? "Pending" : "Initialized",
                    RawResponse = request.RawPaymentResponse ?? string.Empty
                });

                // Create order items and reduce stock
                foreach (var cartItem in cart.CartItems)
                {
                    var orderItem = new OrderItem
                    {
                        OrderId = order.Id,
                        VariantId = cartItem.VariantId,
                        Quantity = cartItem.Quantity,
                        PricePerItem = cartItem.Variant.Price,
                        ProductName = cartItem.Variant.Product.Name,
                        Sku = cartItem.Variant.Sku,
                        Size = cartItem.Variant.Size?.Name ?? string.Empty,
                        Color = cartItem.Variant.Color?.Name ?? string.Empty,
                        ProductImage = cartItem.Variant.Product.MainImageUrl
                    };

                    _context.OrderItems.Add(orderItem);

                    // Reduce stock
                    cartItem.Variant.Stock -= cartItem.Quantity;

                    // Log inventory change
                    LogInventoryChange(cartItem.VariantId, InventoryChangeType.Sold,
                        -cartItem.Quantity, $"Order {orderNumber}", userId);
                }

                // Clear cart items and cart
                _context.CartItems.RemoveRange(cart.CartItems);
                _context.Carts.Remove(cart);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Fetch complete order payload to return
                var completeOrder = await _context.Orders
                    .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Variant)
                    .ThenInclude(v => v.Product)
                    .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Variant)
                    .ThenInclude(v => v.Size)
                    .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Variant)
                    .ThenInclude(v => v.Color)
                    .AsSplitQuery()
                    .FirstAsync(o => o.Id == order.Id);

                return CreatedAtAction(nameof(GetOrder), new { id = completeOrder.Id }, ToOrderDto(completeOrder));
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Lỗi khi xử lý đặt hàng", error = ex.Message });
            }
        }

        // GET: api/orders/admin/all (admin only)
        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetAllOrders()
        {
            var orders = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Product)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Size)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Color)
                .Include(o => o.User)
                .OrderByDescending(o => o.CreatedAt)
                .AsSplitQuery()
                .ToListAsync();

            return Ok(orders.Select(ToOrderDto));
        }

        // PUT: api/orders/{id}/status (admin only)
        [HttpPut("{id}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusRequest request)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
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
            // Strict forward progression: Pending -> Processing -> Shipped -> Delivered
            else if (currentStatus == OrderStatus.Pending && newStatus == OrderStatus.Processing)
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
                // Log and swallow hub broadcast failure to prevent API request failure
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
                .ThenInclude(oi => oi.Variant)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Product)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Size)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Color)
                .Include(o => o.User)
                .AsSplitQuery()
                .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId);

            if (order == null)
                return NotFound(new { message = "Không tìm thấy đơn hàng" });

            if (order.Status == OrderStatus.Cancelled)
                return BadRequest(new { message = "Đơn hàng đã được hủy trước đó" });

            if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Processing)
                return BadRequest(new { message = "Chỉ có thể hủy đơn hàng khi đang chờ xử lý hoặc đang xử lý" });

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
        }

        private string GenerateOrderNumber()
        {
            return $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}";
        }

        private static string GetStatusString(OrderStatus status)
        {
            return status switch
            {
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
            var subtotal = order.OrderItems != null ? order.OrderItems.Sum(item => item.PricePerItem * item.Quantity) : 0;
            var shippingAmount = subtotal > 500000 ? 0 : 30000;

            return new
            {
                order.Id,
                order.OrderNumber,
                order.UserId,
                CustomerName = order.User?.FullName ?? order.User?.Email,
                Status = order.Status.ToString(),
                order.TotalAmount,
                order.ShippingAddress,
                order.PaymentMethod,
                order.PaymentStatus,
                order.CouponId,
                Subtotal = subtotal,
                ShippingAmount = shippingAmount,
                order.CreatedAt,
                order.UpdatedAt,
                Items = order.OrderItems != null ? order.OrderItems.Select(item => new
                {
                    item.Id,
                    item.VariantId,
                    ProductId = item.Variant?.ProductId,
                    ProductName = string.IsNullOrWhiteSpace(item.ProductName)
                        ? item.Variant?.Product?.Name ?? string.Empty
                        : item.ProductName,
                    Sku = string.IsNullOrWhiteSpace(item.Sku) ? item.Variant?.Sku ?? string.Empty : item.Sku,
                    Size = string.IsNullOrWhiteSpace(item.Size) ? item.Variant?.Size?.Name ?? string.Empty : item.Size,
                    Color = string.IsNullOrWhiteSpace(item.Color) ? item.Variant?.Color?.Name ?? string.Empty : item.Color,
                    Price = item.PricePerItem,
                    item.Quantity,
                    ImageUrl = string.IsNullOrWhiteSpace(item.ProductImage)
                        ? item.Variant?.Product?.MainImageUrl ?? string.Empty
                        : item.ProductImage
                }) : Enumerable.Empty<object>()
            };
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
    }

    public class CreateOrderRequest
    {
        public string ShippingAddress { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public string? TransactionCode { get; set; }
        public string? RawPaymentResponse { get; set; }
    }

    public class UpdateOrderStatusRequest
    {
        public OrderStatus Status { get; set; }
    }
}
