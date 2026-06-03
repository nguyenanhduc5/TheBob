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
                .ThenInclude(oi => oi.Product)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return Ok(orders);
        }

        // GET: api/orders/{orderId}
        [HttpGet("{orderId}")]
        public async Task<ActionResult<Order>> GetOrder(int orderId)
        {
            var userId = GetCurrentUserId();
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

            if (order == null)
                return NotFound();

            return Ok(order);
        }

        // POST: api/orders (checkout from cart)
        [HttpPost]
        public async Task<ActionResult<Order>> CreateOrder([FromBody] CreateOrderRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            var cart = await _context.Carts
                .Include(c => c.CartItems)
                .ThenInclude(ci => ci.Product)
                .FirstOrDefaultAsync(c => c.UserId == userId);

            if (cart == null || !cart.CartItems.Any())
                return BadRequest("Cart is empty");

            // Validate stock availability
            foreach (var item in cart.CartItems)
            {
                if (item.Product.Stock < item.Quantity)
                    return BadRequest($"Insufficient stock for {item.Product.Name}");
            }

            // Generate unique order number
            var orderNumber = GenerateOrderNumber();

            // Calculate total
            var totalAmount = cart.CartItems.Sum(ci => ci.Product.Price * ci.Quantity);

            // Create order
            var order = new Order
            {
                OrderNumber = orderNumber,
                UserId = userId.Value,
                Status = OrderStatus.Paid, // Assuming payment succeeds
                TotalAmount = totalAmount,
                ShippingAddress = request.ShippingAddress,
                PaymentMethod = request.PaymentMethod
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            // Create order items and reduce stock
            foreach (var cartItem in cart.CartItems)
            {
                var orderItem = new OrderItem
                {
                    OrderId = order.Id,
                    ProductId = cartItem.ProductId,
                    Quantity = cartItem.Quantity,
                    PriceAtTime = cartItem.Product.Price
                };

                _context.OrderItems.Add(orderItem);

                // Reduce stock
                cartItem.Product.Stock -= cartItem.Quantity;

                // Log inventory change
                await LogInventoryChange(cartItem.ProductId, InventoryChangeType.Sold,
                    -cartItem.Quantity, $"Order {orderNumber}", userId);
            }

            // Clear cart
            _context.CartItems.RemoveRange(cart.CartItems);
            _context.Carts.Remove(cart);

            await _context.SaveChangesAsync();

            // Return order with items
            order = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
                .FirstAsync(o => o.Id == order.Id);

            return CreatedAtAction(nameof(GetOrder), new { orderId = order.Id }, order);
        }

        // GET: api/orders/admin/all (admin only)
        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<Order>>> GetAllOrders()
        {
            var orders = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
                .Include(o => o.User)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return Ok(orders);
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

        private async Task LogInventoryChange(int productId, InventoryChangeType changeType, int quantityChanged, string reason, int? userId)
        {
            var log = new InventoryLog
            {
                ProductId = productId,
                ChangeType = changeType,
                QuantityChanged = quantityChanged,
                Reason = reason,
                UserId = userId
            };

            _context.InventoryLogs.Add(log);
            await _context.SaveChangesAsync();
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
    }

    public class UpdateOrderStatusRequest
    {
        public OrderStatus Status { get; set; }
    }
}