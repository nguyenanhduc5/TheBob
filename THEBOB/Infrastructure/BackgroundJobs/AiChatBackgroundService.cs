using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models.LiveChat;
using THEBOB.Services.Chat;

namespace THEBOB.Services.Background
{
    /// <summary>
    /// Background service chuyên x? lý AI Chat Queue.
    ///
    /// Lý do tách thành class riêng (SRP):
    ///   - Tru?c dây BackgroundQueueProcessingService ch?y 2 worker loop (AI + BlogClick)
    ///     trong cùng 1 class. N?u 1 trong 2 g?p bug unhandled exception, c? 2 loop b? d?ng.
    ///   - Tách ra 2 BackgroundService d?c l?p: ASP.NET Core host qu?n lý vòng d?i riêng bi?t,
    ///     exception ? service này không ?nh hu?ng service kia.
    ///   - D? scale: sau này có th? ch?y AI worker trên nhi?u instance riêng.
    /// </summary>
    public class AiChatBackgroundService : BackgroundService
    {
        private readonly AiChatProcessingQueue _aiQueue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AiChatBackgroundService> _logger;

        public AiChatBackgroundService(
            AiChatProcessingQueue aiQueue,
            IServiceScopeFactory scopeFactory,
            ILogger<AiChatBackgroundService> logger)
        {
            _aiQueue = aiQueue;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Yield();
            _logger.LogInformation("AiChatBackgroundService started.");

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

                    // Try match FAQ tru?c — tránh g?i AI t?n token n?u dã có câu tr? l?i s?n
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

                        string systemPrompt = "B?n là nhân viên tu v?n c?a c?a hàng th?i trang THEBOB. Tr? l?i thân thi?n, ng?n g?n, ti?ng Vi?t. N?u không ch?c thông tin, d? ngh? khách ch? nhân viên h? tr?.";

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
                                                $"- Khoảng giá: {productCtx.MinPrice:N0} - {productCtx.MaxPrice:N0}đ\n";

                                if (productCtx.PromotionPercent > 0)
                                    systemPrompt += $"- KHUYẾN MÃI: Đang giảm {productCtx.PromotionPercent}%\n";

                                // Giới hạn số lượng variant hiển thị trong prompt (tránh payload khổng lồ)
                                var variantSample = productCtx.Variants.Take(20).ToList();
                                systemPrompt += $"\nDANH SÁCH MÀU VÀ SIZE (hiển thị {variantSample.Count}/{productCtx.Variants.Count} biến thể):\n";
                                foreach (var v in variantSample)
                                    systemPrompt += $" + Size {v.Size}, Màu {v.Color}: {v.Price:N0}đ (Còn {v.Stock})\n";

                                // Giới hạn độ dài mô tả sản phẩm (tránh mô tả 2000 ký tự làm phình prompt)
                                var desc = productCtx.Description ?? string.Empty;
                                systemPrompt += "\nMô tả sản phẩm: " + (desc.Length > 400 ? desc[..400] + "..." : desc);
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

            _logger.LogInformation("AiChatBackgroundService stopped.");
        }
    }
}
