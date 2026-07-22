using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Services.Blog;

namespace THEBOB.Services.Background
{
    /// <summary>
    /// Background service xử lý queue gửi blog notification hàng loạt (> 500 users).
    /// Dùng System.Threading.Channels.Channel&lt;T&gt; — không cần Hangfire.
    /// </summary>
    public class BlogNotificationBackgroundService : BackgroundService
    {
        private readonly Channel<BlogNotificationJob> _channel;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BlogNotificationBackgroundService> _logger;

        public BlogNotificationBackgroundService(
            Channel<BlogNotificationJob> channel,
            IServiceScopeFactory scopeFactory,
            ILogger<BlogNotificationBackgroundService> logger)
        {
            _channel = channel;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("BlogNotificationBackgroundService started");

            await foreach (var job in _channel.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await ProcessJobAsync(job, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing BlogNotificationJob {Id}", job.NotificationId);
                }
            }
        }

        private async Task ProcessJobAsync(BlogNotificationJob job, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
            var notifService = scope.ServiceProvider.GetRequiredService<IBlogNotificationService>();

            var notification = await db.BlogNotifications
                .Include(n => n.BlogPost)
                .FirstOrDefaultAsync(n => n.Id == job.NotificationId, ct);

            if (notification == null)
            {
                _logger.LogWarning("BlogNotificationJob: Notification {Id} not found", job.NotificationId);
                return;
            }

            // Chia batch 200 để tránh timeout
            const int batchSize = 200;
            var batches = job.UserIds
                .Select((id, idx) => new { id, idx })
                .GroupBy(x => x.idx / batchSize)
                .Select(g => g.Select(x => x.id).ToList())
                .ToList();

            var svc = (BlogNotificationService)notifService;
            foreach (var batch in batches)
            {
                if (ct.IsCancellationRequested) break;
                await svc.DispatchToUsersAsync(notification, batch);
                _logger.LogInformation("BlogNotification {Id}: dispatched batch of {Count}", job.NotificationId, batch.Count);
            }
        }
    }
}
