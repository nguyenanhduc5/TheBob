using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models;
using THEBOB.Models.Promotion;

namespace THEBOB.Services.Background
{
    /// <summary>
    /// Chạy mỗi 1 phút — gửi thông báo SignalR + DB Notification khi Flash Sale sắp bắt đầu (15 phút trước).
    /// </summary>
    public class FlashSaleNotificationService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly ILogger<FlashSaleNotificationService> _logger;
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);
        private readonly HashSet<int> _notifiedIds = new(); // Tránh spam

        public FlashSaleNotificationService(
            IServiceScopeFactory scopeFactory,
            IHubContext<OrderHub> hubContext,
            ILogger<FlashSaleNotificationService> logger)
        {
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("FlashSaleNotificationService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try { await ProcessAsync(stoppingToken); }
                catch (Exception ex) { _logger.LogError(ex, "FlashSaleNotificationService error"); }

                await Task.Delay(Interval, stoppingToken);
            }
        }

        private async Task ProcessAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();

            var now = DateTime.UtcNow;
            var threshold = now.AddMinutes(15);

            // Flash Sales bắt đầu trong 15 phút
            var upcoming = await db.Promotions
                .Where(p => p.Type == PromotionType.FlashSale
                    && p.Status == PromotionStatus.Active
                    && p.StartDate > now
                    && p.StartDate <= threshold
                    && !_notifiedIds.Contains(p.Id))
                .ToListAsync(ct);

            foreach (var flashSale in upcoming)
            {
                // Broadcast qua SignalR
                await _hubContext.Clients.All.SendAsync("FlashSaleStartingSoon", new
                {
                    promotionId = flashSale.Id,
                    name = flashSale.Name,
                    startDate = flashSale.StartDate,
                    discountType = flashSale.DiscountType.ToString(),
                    discountValue = flashSale.DiscountValue
                }, ct);

                // Gửi notification cho tất cả users (hoặc có thể filter)
                var userIds = await db.Users
                    .Where(u => u.IsActive)
                    .Select(u => u.Id)
                    .ToListAsync(ct);

                foreach (var uid in userIds)
                {
                    db.Notifications.Add(new Notification
                    {
                        UserId = uid,
                        Message = $"⚡ Flash Sale sắp bắt đầu: {flashSale.Name} — Bắt đầu lúc {flashSale.StartDate:HH:mm}!",
                        Type = "FlashSale",
                        IsRead = false,
                        CreatedAt = now
                    });
                }

                _notifiedIds.Add(flashSale.Id);
                _logger.LogInformation("FlashSale notification sent: {Name} (Id={Id})", flashSale.Name, flashSale.Id);
            }

            if (upcoming.Any())
                await db.SaveChangesAsync(ct);
        }
    }
}
