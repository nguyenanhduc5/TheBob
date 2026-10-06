using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using THEBOB.Controllers;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Services
{
    public class CartService : ICartService
    {
        private readonly ThebobDbContext _context;

        public CartService(ThebobDbContext context)
        {
            _context = context;
        }

        public async Task<Cart?> GetCartAsync(int userId)
        {
            var cart = await _context.Carts
                .Include(c => c.CartItems)
                .ThenInclude(ci => ci.Variant)
                .ThenInclude(v => v.Product)
                .FirstOrDefaultAsync(c => c.UserId == userId);

            if (cart == null)
            {
                cart = new Cart { UserId = userId };
                _context.Carts.Add(cart);
                await _context.SaveChangesAsync();
            }

            return cart;
        }

        public async Task<(bool Success, string Message, int AvailableStock, int StatusCode)> AddToCartAsync(int userId, AddToCartRequest request)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId);

                    var variant = await _context.ProductVariants
                        .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", request.VariantId)
                        .AsTracking()
                        .FirstOrDefaultAsync();

                    if (variant == null)
                        return (false, "Không tìm thấy biến thể sản phẩm.", 0, 404);

                    if (request.Quantity <= 0)
                        return (false, "Số lượng phải lớn hơn 0.", 0, 400);

                    var cart = await _context.GetOrCreateCartAsync(userId);
                    await _context.LoadCartItemsAsync(cart);

                    var existingItem = cart.CartItems.FirstOrDefault(ci => ci.VariantId == request.VariantId);
                    int currentCartQty = existingItem?.Quantity ?? 0;

                    if (variant.Stock < currentCartQty + request.Quantity)
                    {
                        await transaction.RollbackAsync();
                        string msg = request.Quantity == 1 
                            ? "Bạn đã thêm tối đa số lượng còn trong kho." 
                            : $"Chỉ còn {variant.Stock} sản phẩm trong kho.";
                        return (false, msg, variant.Stock, 400);
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

                    return (true, "Đã thêm sản phẩm vào giỏ hàng.", variant.Stock, 200);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return (false, $"Lỗi khi thêm sản phẩm vào giỏ hàng: {ex.Message}", 0, 500);
                }
            });
        }

        public async Task<object> SyncCartAsync(int userId, SyncCartRequest request)
        {
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
                return new { message = "Cart is empty" };

            var variantIds = requestedItems.Select(item => item.VariantId).ToList();
            var variants = await _context.ProductVariants
                .Include(v => v.Product)
                .Where(v => variantIds.Contains(v.Id))
                .ToDictionaryAsync(v => v.Id);

            var warnings = new List<object>();

            foreach (var item in requestedItems)
            {
                if (!variants.TryGetValue(item.VariantId, out var variant))
                {
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

                    item.Quantity = variant.Stock;
                }
            }

            var validItems = requestedItems
                .Where(item => variants.ContainsKey(item.VariantId))
                .ToList();

            var syncItems = validItems
                .Select(item => (item.VariantId, item.Quantity))
                .ToList();

            await _context.ExecuteCartMutationAsync(userId, async (context, cart) =>
            {
                await context.ReplaceCartItemsAsync(cart.Id, syncItems);
                cart.UpdatedAt = DateTime.UtcNow;
            });

            return new
            {
                message = "Cart synced",
                hasWarnings = warnings.Any(),
                warnings,
                stockInfo = variants.Values.Select(v => new
                {
                    variantId = v.Id,
                    availableStock = v.Stock,
                    isOutOfStock = v.Stock == 0 || !v.IsAvailable
                })
            };
        }

        public async Task<(bool Success, string Message, int AvailableStock, int StatusCode)> UpdateCartItemAsync(int userId, int itemId, UpdateCartItemRequest request)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId);

                    var cart = await _context.GetOrCreateCartAsync(userId);
                    await _context.LoadCartItemsAsync(cart);

                    var cartItem = cart.CartItems.FirstOrDefault(ci => ci.Id == itemId);
                    if (cartItem == null)
                        return (false, "Không tìm thấy sản phẩm trong giỏ.", 0, 404);

                    if (request.Quantity <= 0)
                    {
                        _context.CartItems.Remove(cartItem);
                        cart.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        return (true, "Đã xóa sản phẩm khỏi giỏ hàng.", 0, 200);
                    }

                    var variant = await _context.ProductVariants
                        .FromSqlRaw("SELECT * FROM ProductVariants WHERE Id = {0} FOR UPDATE", cartItem.VariantId)
                        .AsTracking()
                        .FirstOrDefaultAsync();

                    if (variant == null)
                        return (false, "Biến thể sản phẩm không tồn tại.", 0, 404);

                    if (variant.Stock < request.Quantity)
                    {
                        await transaction.RollbackAsync();
                        string msg = request.Quantity == cartItem.Quantity + 1
                            ? "Bạn đã thêm tối đa số lượng còn trong kho."
                            : $"Chỉ còn {variant.Stock} sản phẩm trong kho.";
                        
                        return (false, msg, variant.Stock, 400);
                    }

                    cartItem.Quantity = request.Quantity;
                    cart.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return (true, "Đã cập nhật số lượng thành công.", variant.Stock, 200);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return (false, $"Lỗi khi cập nhật giỏ hàng: {ex.Message}", 0, 500);
                }
            });
        }

        public async Task<(bool Success, string Message, int StatusCode)> RemoveCartItemAsync(int userId, int itemId)
        {
            (bool Success, string Message, int StatusCode) result = (false, "Lỗi khi xóa sản phẩm khỏi giỏ hàng.", 500);
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId);

                    var cart = await _context.Carts
                        .FirstOrDefaultAsync(c => c.UserId == userId);

                    if (cart == null)
                    {
                        await transaction.RollbackAsync();
                        result = (false, "Không tìm thấy giỏ hàng", 404);
                        return;
                    }

                    await _context.LoadCartItemsAsync(cart);

                    var cartItem = cart.CartItems.FirstOrDefault(ci => ci.Id == itemId);
                    if (cartItem == null)
                    {
                        await transaction.RollbackAsync();
                        result = (false, "Không tìm thấy sản phẩm trong giỏ hàng", 404);
                        return;
                    }

                    _context.CartItems.Remove(cartItem);
                    cart.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    result = (true, "Đã xóa sản phẩm khỏi giỏ hàng.", 200);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    result = (false, $"Lỗi khi xóa sản phẩm khỏi giỏ hàng: {ex.Message}", 500);
                }
            });

            return result;
        }

        public async Task<bool> ClearCartAsync(int userId)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    await _context.LockUserForCartMutationAsync(userId);

                    var cart = await _context.Carts
                        .FirstOrDefaultAsync(c => c.UserId == userId);

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

            return true;
        }
    }
}
