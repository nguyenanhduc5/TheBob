using THEBOB.Data;
using THEBOB.Models.Blog;

namespace THEBOB.Services.Background
{
    /// <summary>
    /// Background service chuyên x? lý Blog Click Analytics Queue.
    ///
    /// Lý do tách thành class riêng (SRP):
    ///   - Trách nhi?m duy nh?t: dequeue các lu?t click blog / s?n ph?m trong bài vi?t
    ///     và luu vào database b?t d?ng b? mà không ch?n lu?ng HTTP request c?a ngu?i dùng.
    ///   - Ð?c l?p hoàn toàn v?i AI Chat: n?u AI Chat b? ngh?n token ho?c l?i service bên ngoài,
    ///     vi?c thu th?p analytics c?a Blog v?n ch?y bình thu?ng.
    /// </summary>
    public class BlogClickBackgroundService : BackgroundService
    {
        private readonly BlogClickProcessingQueue _blogQueue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BlogClickBackgroundService> _logger;

        public BlogClickBackgroundService(
            BlogClickProcessingQueue blogQueue,
            IServiceScopeFactory scopeFactory,
            ILogger<BlogClickBackgroundService> logger)
        {
            _blogQueue = blogQueue;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Yield();
            _logger.LogInformation("BlogClickBackgroundService started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var job = await _blogQueue.DequeueAsync(stoppingToken);
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();

                    var source = Enum.TryParse<BlogClickSource>(job.Source, out var s) ? s : BlogClickSource.Direct;

                    db.BlogPostClicks.Add(new BlogPostClick
                    {
                        BlogPostId = job.BlogPostId,
                        UserId = job.UserId,
                        SessionId = job.SessionId,
                        Source = source,
                        ProductId = job.ProductId,
                        ClickedAt = DateTime.UtcNow
                    });

                    await db.SaveChangesAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing Blog Click queue job.");
                }
            }

            _logger.LogInformation("BlogClickBackgroundService stopped.");
        }
    }
}
