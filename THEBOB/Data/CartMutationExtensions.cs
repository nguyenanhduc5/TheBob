using Microsoft.EntityFrameworkCore;
using THEBOB.Models;

namespace THEBOB.Data
{
    /// <summary>
    /// Serializes cart mutations per user and avoids change-tracker delete conflicts.
    /// </summary>
    public static class CartMutationExtensions
    {
        public static async Task ExecuteCartMutationAsync(
            this ThebobDbContext context,
            int userId,
            Func<ThebobDbContext, Cart, Task> mutate,
            CancellationToken cancellationToken = default)
        {
            var strategy = context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

                try
                {
                    await context.LockUserForCartMutationAsync(userId, cancellationToken);
                    var cart = await context.GetOrCreateCartAsync(userId, cancellationToken);
                    await mutate(context, cart);
                    await context.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }
                catch
                {
                    await transaction.RollbackAsync(cancellationToken);
                    throw;
                }
            });
        }

        /// <summary>
        /// Locks the user row so concurrent cart APIs for the same user run one at a time.
        /// </summary>
        public static async Task LockUserForCartMutationAsync(
            this ThebobDbContext context,
            int userId,
            CancellationToken cancellationToken = default)
        {
            var lockedUserId = await context.Database
                .SqlQueryRaw<int>("SELECT Id AS Value FROM Users WHERE Id = {0} FOR UPDATE", userId)
                .SingleOrDefaultAsync(cancellationToken);

            if (lockedUserId != userId)
                throw new InvalidOperationException("Không tìm thấy người dùng.");
        }

        public static async Task<Cart> GetOrCreateCartAsync(
            this ThebobDbContext context,
            int userId,
            CancellationToken cancellationToken = default)
        {
            var cart = await context.Carts
                .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

            if (cart != null)
                return cart;

            cart = new Cart
            {
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Carts.Add(cart);
            await context.SaveChangesAsync(cancellationToken);
            return cart;
        }

        public static async Task ReplaceCartItemsAsync(
            this ThebobDbContext context,
            int cartId,
            IEnumerable<(int VariantId, int Quantity)> items,
            CancellationToken cancellationToken = default)
        {
            DetachTrackedCartItems(context, cartId);

            await context.CartItems
                .Where(ci => ci.CartId == cartId)
                .ExecuteDeleteAsync(cancellationToken);

            var now = DateTime.UtcNow;
            foreach (var (variantId, quantity) in items)
            {
                context.CartItems.Add(new CartItem
                {
                    CartId = cartId,
                    VariantId = variantId,
                    Quantity = quantity,
                    AddedAt = now
                });
            }
        }

        public static async Task LoadCartItemsAsync(
            this ThebobDbContext context,
            Cart cart,
            CancellationToken cancellationToken = default)
        {
            await context.Entry(cart)
                .Collection(c => c.CartItems)
                .LoadAsync(cancellationToken);
        }

        public static void DetachTrackedCartItems(ThebobDbContext context, int cartId)
        {
            foreach (var entry in context.ChangeTracker.Entries<CartItem>()
                         .Where(e => e.Entity.CartId == cartId)
                         .ToList())
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
