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
    [Authorize] // All cart operations require authentication
    public class CartController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public CartController(ThebobDbContext context)
        {
            _context = context;
        }

        // GET: api/cart
        [HttpGet]
        public async Task<ActionResult<Cart>> GetCart()
        {
            var userId = GetCurrentUserId();
            var cart = await _context.Carts
                .Include(c => c.CartItems)
                .ThenInclude(ci => ci.Variant)
                .ThenInclude(v => v.Product)
                .FirstOrDefaultAsync(c => c.UserId == userId);

            if (cart == null)
            {
                // Create empty cart for user
                if (!userId.HasValue)
                    return Unauthorized();

                cart = new Cart { UserId = userId.Value };
                _context.Carts.Add(cart);
                await _context.SaveChangesAsync();
            }

            return Ok(cart);
        }

        // POST: api/cart/add
        [HttpPost("add")]
        public async Task<IActionResult> AddToCart([FromBody] AddToCartRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId.Value);

                    var variant = await _context.ProductVariants
                        .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", request.VariantId)
                        .AsTracking()
                        .FirstOrDefaultAsync();

                    if (variant == null)
                        return NotFound(new { success = false, message = "Không tìm thấy biến thể sản phẩm." });

                    if (request.Quantity <= 0)
                        return BadRequest(new { success = false, message = "Số lượng phải lớn hơn 0." });

                    var cart = await _context.GetOrCreateCartAsync(userId.Value);
                    await _context.LoadCartItemsAsync(cart);

                    var existingItem = cart.CartItems.FirstOrDefault(ci => ci.VariantId == request.VariantId);
                    int currentCartQty = existingItem?.Quantity ?? 0;

                    if (variant.Stock < currentCartQty + request.Quantity)
                    {
                        await transaction.RollbackAsync();
                        string msg = request.Quantity == 1 
                            ? "Bạn đã thêm tối đa số lượng còn trong kho." 
                            : $"Chỉ còn {variant.Stock} sản phẩm trong kho.";
                        return BadRequest(new
                        {
                            success = false,
                            message = msg,
                            availableStock = variant.Stock
                        });
                    }

                    if (existingItem != null)
                    {
                        existingItem.Quantity += request.Quantity;
                        existingItem.AddedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        _context.CartItems.Add(new CartItem
                        {
                            CartId = cart.Id,
                            VariantId = request.VariantId,
                            Quantity = request.Quantity,
                            AddedAt = DateTime.UtcNow
                        });
                    }

                    cart.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { success = true, message = "Đã thêm sản phẩm vào giỏ hàng." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { success = false, message = "Lỗi khi thêm sản phẩm vào giỏ hàng.", detail = ex.Message });
                }
            });
        }

     // POST: api/cart/sync
[HttpPost("sync")]
public async Task<IActionResult> SyncCart([FromBody] SyncCartRequest request)
{
    if (!ModelState.IsValid)
        return BadRequest(ModelState);

    var userId = GetCurrentUserId();
    if (!userId.HasValue)
        return Unauthorized();

    var requestedItems = request.Items
        .Where(item => item.VariantId > 0 && item.Quantity > 0)
        .GroupBy(item => item.VariantId)
        .Select(group => new SyncCartItemRequest
        {
            VariantId = group.Key,
            Quantity = group.Sum(item => item.Quantity)
        })
        .ToList();

    if (!requestedItems.Any())
        return BadRequest(new { message = "Cart is empty" });

    var variantIds = requestedItems.Select(item => item.VariantId).ToList();
    var variants = await _context.ProductVariants
        .Include(v => v.Product)
        .Where(v => variantIds.Contains(v.Id))
        .ToDictionaryAsync(v => v.Id);

    // ✅ THAY ĐỔI: Không return 400 nữa
    // Gom tất cả cảnh báo lại
    var warnings = new List<object>();

    foreach (var item in requestedItems)
    {
        if (!variants.TryGetValue(item.VariantId, out var variant))
        {
            // Variant không tồn tại → bỏ qua item này
            warnings.Add(new
            {
                variantId = item.VariantId,
                type = "NOT_FOUND",
                message = $"Sản phẩm không còn tồn tại"
            });
            continue;
        }

        if (!variant.IsAvailable || variant.Stock == 0)
        {
            // Hết hàng → cảnh báo nhưng vẫn lưu giỏ
            warnings.Add(new
            {
                variantId = variant.Id,
                sku = variant.Sku,
                productName = variant.Product?.Name,
                type = "OUT_OF_STOCK",
                message = $"{variant.Product?.Name} - {variant.Sku} đã hết hàng",
                availableStock = 0,
                requestedQuantity = item.Quantity
            });
        }
        else if (variant.Stock < item.Quantity)
        {
            // Không đủ số lượng → cảnh báo + tự điều chỉnh
            warnings.Add(new
            {
                variantId = variant.Id,
                sku = variant.Sku,
                productName = variant.Product?.Name,
                type = "INSUFFICIENT_STOCK",
                message = $"{variant.Product?.Name} chỉ còn {variant.Stock} sản phẩm",
                availableStock = variant.Stock,
                requestedQuantity = item.Quantity
            });

            // ✅ Tự giảm quantity về đúng stock
            item.Quantity = variant.Stock;
        }
    }

    // ✅ Lọc bỏ các item không tìm thấy variant
    var validItems = requestedItems
        .Where(item => variants.ContainsKey(item.VariantId))
        .ToList();

    var syncItems = validItems
        .Select(item => (item.VariantId, item.Quantity))
        .ToList();

    await _context.ExecuteCartMutationAsync(userId.Value, async (context, cart) =>
    {
        await context.ReplaceCartItemsAsync(cart.Id, syncItems);
        cart.UpdatedAt = DateTime.UtcNow;
    });

    // ✅ Trả về 200 kèm warnings thay vì 400
    return Ok(new
    {
        message = "Cart synced",
        hasWarnings = warnings.Any(),
        warnings,
        // Trả về stock hiện tại để FE cập nhật UI
        stockInfo = variants.Values.Select(v => new
        {
            variantId = v.Id,
            availableStock = v.Stock,
            isOutOfStock = v.Stock == 0 || !v.IsAvailable
        })
    });
}
        // PUT: api/cart/items/{itemId}
        [HttpPut("items/{itemId}")]
        public async Task<IActionResult> UpdateCartItem(int itemId, [FromBody] UpdateCartItemRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId.Value);

                    var cart = await _context.GetOrCreateCartAsync(userId.Value);
                    await _context.LoadCartItemsAsync(cart);

                    var cartItem = cart.CartItems.FirstOrDefault(ci => ci.Id == itemId);
                    if (cartItem == null)
                        return NotFound(new { success = false, message = "Không tìm thấy sản phẩm trong giỏ." });

                    if (request.Quantity <= 0)
                    {
                        _context.CartItems.Remove(cartItem);
                        cart.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return Ok(new { success = true, message = "Đã xóa sản phẩm khỏi giỏ hàng." });
                    }

                    var variant = await _context.ProductVariants
                        .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", cartItem.VariantId)
                        .AsTracking()
                        .FirstOrDefaultAsync();

                    if (variant == null)
                        return NotFound(new { success = false, message = "Biến thể sản phẩm không tồn tại." });

                    if (variant.Stock < request.Quantity)
                    {
                        await transaction.RollbackAsync();
                        string msg = request.Quantity == cartItem.Quantity + 1
                            ? "Bạn đã thêm tối đa số lượng còn trong kho."
                            : $"Chỉ còn {variant.Stock} sản phẩm trong kho.";
                        
                        return BadRequest(new
                        {
                            success = false,
                            message = msg,
                            availableStock = variant.Stock
                        });
                    }

                    cartItem.Quantity = request.Quantity;
                    cart.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new { success = true, message = "Đã cập nhật số lượng thành công." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { success = false, message = "Lỗi khi cập nhật giỏ hàng.", detail = ex.Message });
                }
            });
        }

        // DELETE: api/cart/items/{itemId}
        [HttpDelete("items/{itemId}")]
        public async Task<IActionResult> RemoveCartItem(int itemId)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            IActionResult? actionResult = null;
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId.Value);

                    var cart = await _context.Carts
                        .FirstOrDefaultAsync(c => c.UserId == userId.Value);

                    if (cart == null)
                    {
                        actionResult = NotFound();
                        await transaction.RollbackAsync();
                        return;
                    }

                    await _context.LoadCartItemsAsync(cart);

                    var cartItem = cart.CartItems.FirstOrDefault(ci => ci.Id == itemId);
                    if (cartItem == null)
                    {
                        actionResult = NotFound();
                        await transaction.RollbackAsync();
                        return;
                    }

                    _context.CartItems.Remove(cartItem);
                    cart.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    actionResult = Ok();
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    actionResult = StatusCode(500, new { message = "Lỗi khi xóa sản phẩm khỏi giỏ hàng.", detail = ex.Message });
                }
            });

            return actionResult ?? StatusCode(500, new { message = "Lỗi khi xóa sản phẩm khỏi giỏ hàng." });
        }

        // DELETE: api/cart
        [HttpDelete]
        public async Task<IActionResult> ClearCart()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId.Value);

                    var cart = await _context.Carts
                        .FirstOrDefaultAsync(c => c.UserId == userId.Value);

                    if (cart == null)
                    {
                        await transaction.CommitAsync();
                        return;
                    }

                    CartMutationExtensions.DetachTrackedCartItems(_context, cart.Id);
                    await _context.CartItems
                        .Where(ci => ci.CartId == cart.Id)
                        .ExecuteDeleteAsync();
                    _context.Carts.Remove(cart);
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });

            return Ok();
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? int.Parse(userIdClaim) : null;
        }
    }

    public class AddToCartRequest
    {
        public int VariantId { get; set; }
        public int Quantity { get; set; } = 1;
    }

    public class UpdateCartItemRequest
    {
        public int Quantity { get; set; }
    }

    public class SyncCartRequest
    {
        public List<SyncCartItemRequest> Items { get; set; } = new();
    }

    public class SyncCartItemRequest
    {
        public int VariantId { get; set; }
        public int Quantity { get; set; }
    }
}
