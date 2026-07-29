using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models.Blog;
using THEBOB.Models.LiveChat;
using THEBOB.Services.Blog;
using THEBOB.Services.Chat;

namespace THEBOB.Services.Background
{
    public class AiChatProcessingQueue
    {
        private readonly Channel<AiChatJob> _channel = Channel.CreateUnbounded<AiChatJob>(new UnboundedChannelOptions
        {
            SingleReader = true
        });

        public ValueTask EnqueueAsync(AiChatJob job) => _channel.Writer.WriteAsync(job);
        public ValueTask<AiChatJob> DequeueAsync(CancellationToken ct) => _channel.Reader.ReadAsync(ct);
    }

    public class BlogClickProcessingQueue
    {
        private readonly Channel<BlogClickJob> _channel = Channel.CreateUnbounded<BlogClickJob>(new UnboundedChannelOptions
        {
            SingleReader = true
        });

        public ValueTask EnqueueAsync(BlogClickJob job) => _channel.Writer.WriteAsync(job);
        public ValueTask<BlogClickJob> DequeueAsync(CancellationToken ct) => _channel.Reader.ReadAsync(ct);
    }

    public class BackgroundQueueProcessingService : BackgroundService
    {
        private readonly AiChatProcessingQueue _aiQueue;
        private readonly BlogClickProcessingQueue _blogQueue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BackgroundQueueProcessingService> _logger;

        public BackgroundQueueProcessingService(
            AiChatProcessingQueue aiQueue,
            BlogClickProcessingQueue blogQueue,
            IServiceScopeFactory scopeFactory,
            ILogger<BackgroundQueueProcessingService> logger)
        {
            _aiQueue = aiQueue;
            _blogQueue = blogQueue;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Background Queue Processing Service is starting.");

            var aiWorker = ProcessAiQueueAsync(stoppingToken);
            var blogWorker = ProcessBlogQueueAsync(stoppingToken);

            await Task.WhenAll(aiWorker, blogWorker);
        }

        private async Task ProcessAiQueueAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var job = await _aiQueue.DequeueAsync(stoppingToken);
                    using var scope = _scopeFactory.CreateScope();

                    var faqService = scope.ServiceProvider.GetRequiredService<IFaqService>();
                    var aiChatService = scope.ServiceProvider.GetRequiredService<IAiChatService>();
                    var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
                    var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();
                    var productService = scope.ServiceProvider.GetRequiredService<IProductContextService>();

                    var conversation = await db.Conversations.FindAsync(job.ConversationId);
                    if (conversation == null || conversation.Status == ConversationStatus.Closed)
                        continue;

                    // Try match FAQ
                    var matchedFaq = await faqService.TryMatchFaqAsync(job.Content);
                    string aiResponseContent;

                    if (matchedFaq != null)
                    {
                        aiResponseContent = matchedFaq.Answer;
                    }
                    else
                    {
                        var lastMessages = await db.Messages
                            .AsNoTracking()
                            .Where(m => m.ConversationId == job.ConversationId)
                            .OrderByDescending(m => m.CreatedAt)
                            .Take(10)
                            .ToListAsync(stoppingToken);

                        lastMessages.Reverse();

                        var history = lastMessages
                            .Where(m => m.SenderType != SenderType.System)
                            .Select(m => (
                                role: m.SenderType == SenderType.User ? "user" : "assistant",
                                content: m.Content
                            ))
                            .ToList();

                        await hubContext.Clients.Group(IChatService.ConversationGroup(job.ConversationId))
                            .SendAsync("ReceiveTyping", job.ConversationId, true, cancellationToken: stoppingToken);

                        string systemPrompt = "Bạn là nhân viên tư vấn của cửa hàng thời trang THEBOB. Trả lời thân thiện, ngắn gọn, tiếng Việt. Nếu không chắc thông tin, đề nghị khách chờ nhân viên hỗ trợ.";

                        if (conversation.CurrentProductId.HasValue)
                        {
                            var productCtx = await productService.BuildContextAsync(conversation.CurrentProductId.Value);
                            if (productCtx != null)
                            {
                                systemPrompt += $"\n\nTHÔNG TIN SẢN PHẨM KHÁCH ĐANG XEM:\n" +
                                                $"- Tên: {productCtx.Name}\n" +
                                                $"- Phân loại: {productCtx.CategoryName} - Thương hiệu: {productCtx.BrandName}\n" +
                                                $"- Chất liệu: {productCtx.Material}\n" +
                                                $"- Đánh giá: {productCtx.Rating}/5 ({productCtx.ReviewCount} lượt)\n" +
                                                $"- Khoảng giá: {productCtx.MinPrice:N0} - {productCtx.MaxPrice:N0} đ\n";

                                if (productCtx.PromotionPercent > 0)
                                {
                                    systemPrompt += $"- KHUYẾN MÃI: Đang giảm {productCtx.PromotionPercent}%\n";
                                }

                                systemPrompt += "\nDANH SÁCH MÀU VÀ SIZE ĐANG BÁN:\n";
                                foreach (var v in productCtx.Variants)
                                {
                                    systemPrompt += $" + Size {v.Size}, Màu {v.Color}: {v.Price:N0} đ (Còn {v.Stock} chiếc)\n";
                                }
                                systemPrompt += "\nMô tả sản phẩm: " + productCtx.Description;
                            }
                        }
                        else
                        {
                            systemPrompt += "\n\nKhách hàng hiện chưa chọn sản phẩm nào. Nếu khách hỏi về sản phẩm, hãy hỏi khách muốn tư vấn sản phẩm nào và gợi ý dùng thanh tìm kiếm sản phẩm. Không tự bịa ra tên sản phẩm.";
                        }

                        aiResponseContent = await aiChatService.GenerateReplyAsync(systemPrompt, history, job.Content);
                    }

                    var aiMessage = new Message
                    {
                        ConversationId = job.ConversationId,
                        SenderType = SenderType.AI,
                        Content = aiResponseContent,
                        CreatedAt = DateTime.UtcNow,
                        IsRead = false
                    };

                    db.Messages.Add(aiMessage);
                    await db.SaveChangesAsync(stoppingToken);

                    var aiDto = new DTOs.Chat.ChatMessageDto
                    {
                        Id = aiMessage.Id,
                        ConversationId = aiMessage.ConversationId,
                        SenderType = aiMessage.SenderType.ToString(),
                        SenderId = aiMessage.SenderId,
                        SenderName = "AI Assistant",
                        Content = aiMessage.Content,
                        CreatedAt = aiMessage.CreatedAt,
                        IsRead = aiMessage.IsRead
                    };

                    await hubContext.Clients.Group(IChatService.ConversationGroup(job.ConversationId))
                        .SendAsync("ReceiveMessage", aiDto, cancellationToken: stoppingToken);

                    await hubContext.Clients.Group(IChatService.ConversationGroup(job.ConversationId))
                        .SendAsync("ReceiveTyping", job.ConversationId, false, cancellationToken: stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing AI Chat queue job.");
                }
            }
        }

        private async Task ProcessBlogQueueAsync(CancellationToken stoppingToken)
        {
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
        }
    }
}
