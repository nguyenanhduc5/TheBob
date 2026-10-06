using Microsoft.EntityFrameworkCore;

namespace THEBOB.Data
{
    public static class DbContextTransactionExtensions
    {
        public static async Task ExecuteInTransactionAsync(
            this DbContext context,
            Func<Task> operation,
            CancellationToken cancellationToken = default)
        {
            var strategy = context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
                await operation();
                await transaction.CommitAsync(cancellationToken);
            });
        }

        public static async Task<T> ExecuteInTransactionAsync<T>(
            this DbContext context,
            Func<Task<T>> operation,
            CancellationToken cancellationToken = default)
        {
            var strategy = context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
                var result = await operation();
                await transaction.CommitAsync(cancellationToken);
                return result;
            });
        }
    }
}
