using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models.Promotion;

namespace THEBOB.Services.Background
{
    /// <summary>
    /// Chạy mỗi 5 phút — tự động chuyển Promotions sang Ended khi hết hạn.
    /// Cũng tự động kích hoạt Promotions Draft → Active khi đến ngày bắt đầu.
    /// </summary>
    public class PromotionExpireService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<PromotionExpireService> _logger;
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

        public PromotionExpireService(
            IServiceScopeFactory scopeFactory,
            ILogger<PromotionExpireService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("PromotionExpireService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "PromotionExpireService error");
                }

                await Task.Delay(Interval, stoppingToken);
            }
        }

        private async Task ProcessAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
            var now = DateTime.UtcNow;

            // Expire: Active → Ended khi quá EndDate
            var expired = await db.Promotions
                .Where(p => p.Status == PromotionStatus.Active && p.EndDate < now)
                .ToListAsync(ct);

            if (expired.Any())
            {
                foreach (var p in expired)
                {
                    p.Status = PromotionStatus.Ended;
                    p.UpdatedAt = now;
                }
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("Expired {Count} promotions", expired.Count);
            }
        }
    }
}
