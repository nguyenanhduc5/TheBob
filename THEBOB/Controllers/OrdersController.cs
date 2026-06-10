using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using System.Security.Claims;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // All order operations require authentication
    public class OrdersController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public OrdersController(ThebobDbContext context)
        {
            _context = context;
        }

        // GET: api/orders (user's orders)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
        {
            var userId = GetCurrentUserId();
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
                .ToListAsync();

            return Ok(orders.Select(ToOrderDto));
        }

        // GET: api/orders/{orderId}
        [HttpGet("{orderId}")]
        public async Task<ActionResult<Order>> GetOrder(int orderId)
        {
            var userId = GetCurrentUserId();
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Product)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Size)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Color)
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

            if (order == null)
                return NotFound();

            return Ok(ToOrderDto(order));
        }

        // POST: api/orders (checkout from cart)
        [HttpPost]
        public async Task<ActionResult<Order>> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

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
                return BadRequest("Cart is empty");

            // Validate stock availability
            foreach (var item in cart.CartItems)
            {
                if (item.Variant?.Product == null || item.Variant.Size == null || item.Variant.Color == null)
                    return BadRequest("Invalid cart item");

                if (!item.Variant.IsAvailable)
                    return BadRequest($"Variant {item.Variant.Sku} is not available");

                if (item.Variant.Stock < item.Quantity)
                    return BadRequest($"Insufficient stock for {item.Variant.Product.Name} - {item.Variant.Sku}");
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
                PaymentStatus = request.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase) ? "Pending" : "Completed"
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

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

            // Clear cart
            _context.CartItems.RemoveRange(cart.CartItems);
            _context.Carts.Remove(cart);

            await _context.SaveChangesAsync();

            // Return order with items
            order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Product)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Size)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Variant)
                .ThenInclude(v => v.Color)
                .FirstAsync(o => o.Id == order.Id);

            return CreatedAtAction(nameof(GetOrder), new { orderId = order.Id }, ToOrderDto(order));
        }

        // GET: api/orders/admin/all (admin only)
        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<Order>>> GetAllOrders()
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
                .ToListAsync();

            return Ok(orders.Select(ToOrderDto));
        }

        // PUT: api/orders/{orderId}/status (admin only)
        [HttpPut("{orderId}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateOrderStatus(int orderId, [FromBody] UpdateOrderStatusRequest request)
        {
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null)
                return NotFound();

            order.Status = request.Status;
            order.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok();
        }

        private string GenerateOrderNumber()
        {
            return $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}";
        }

        private static object ToOrderDto(Order order)
        {
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
                Subtotal = order.OrderItems.Sum(item => item.PricePerItem * item.Quantity),
                ShippingAmount = order.OrderItems.Sum(item => item.PricePerItem * item.Quantity) > 500000 ? 0 : 30000,
                order.CreatedAt,
                order.UpdatedAt,
                Items = order.OrderItems.Select(item => new
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
                })
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

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? int.Parse(userIdClaim) : null;
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
