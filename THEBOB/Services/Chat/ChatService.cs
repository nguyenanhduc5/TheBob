using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using THEBOB.Data;
using THEBOB.DTOs.Chat;
using THEBOB.Hubs;
using THEBOB.Models.LiveChat;

namespace THEBOB.Services.Chat
{
    public class ChatService : IChatService
    {
        private readonly ThebobDbContext _db;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly IPresenceService _presenceService;
        private readonly IFaqService _faqService;
        private readonly IAiChatService _aiChatService;
        private readonly ILogger<ChatService> _logger;
        private readonly Microsoft.Extensions.DependencyInjection.IServiceScopeFactory _scopeFactory;

        public ChatService(ThebobDbContext db, IHubContext<ChatHub> hubContext, IPresenceService presenceService, IFaqService faqService, IAiChatService aiChatService, ILogger<ChatService> logger, Microsoft.Extensions.DependencyInjection.IServiceScopeFactory scopeFactory)
        {
            _db = db;
            _hubContext = hubContext;
            _presenceService = presenceService;
            _faqService = faqService;
            _aiChatService = aiChatService;
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public async Task<bool> CanAccessConversationAsync(int conversationId, int userId, bool isAdmin)
        {
            if (isAdmin)
            {
                return await _db.Conversations.AnyAsync(c => c.Id == conversationId);
            }

            return await _db.Conversations.AnyAsync(c => c.Id == conversationId && c.UserId == userId);
        }

        public async Task<Conversation> GetOrCreateOpenConversationAsync(int userId)
        {
            var existing = await _db.Conversations
                .FirstOrDefaultAsync(c => c.UserId == userId && c.Status == ConversationStatus.Open);

            if (existing != null)
            {
                return existing;
            }

            var conversation = new Conversation
            {
                UserId = userId,
                ChatMode = ChatMode.Admin,
                Status = ConversationStatus.Open,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Conversations.Add(conversation);
            await _db.SaveChangesAsync();
            return conversation;
        }

        public async Task<ChatMessageDto> SendMessageAsync(int conversationId, int userId, bool isAdmin, string content, int? productId = null, int? variantId = null)
        {
            if (string.IsNullOrWhiteSpace(content))
            {
                throw new ArgumentException("Nội dung tin nhắn không được để trống.");
            }

            if (!await CanAccessConversationAsync(conversationId, userId, isAdmin))
            {
                throw new UnauthorizedAccessException("Không có quyền truy cập hội thoại này.");
            }

            var conversation = await _db.Conversations.FindAsync(conversationId)
                ?? throw new KeyNotFoundException("Không tìm thấy hội thoại.");

            if (conversation.Status == ConversationStatus.Closed)
            {
                throw new InvalidOperationException("Hội thoại đã đóng.");
            }

            var senderType = isAdmin ? SenderType.Admin : SenderType.User;
            var sender = await _db.Users.FindAsync(userId);

            var message = new Message
            {
                ConversationId = conversationId,
                SenderType = senderType,
                SenderId = userId,
                Content = content.Trim(),
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };

            _db.Messages.Add(message);
            conversation.UpdatedAt = DateTime.UtcNow;

            if (!isAdmin)
            {
                conversation.CurrentProductId = productId;
                conversation.CurrentVariantId = variantId;
            }

            if (isAdmin && conversation.AssignedAdminId == null)
            {
                conversation.AssignedAdminId = userId;
            }

            await _db.SaveChangesAsync();

            var dto = MapMessage(message, sender?.FullName);
            await _hubContext.Clients
                .Group(IChatService.ConversationGroup(conversationId))
                .SendAsync("ReceiveMessage", dto);

            // Phase 2: If User sends a message, check Admin presence
            if (!isAdmin)
            {
                bool isAdminOnline = await _presenceService.IsAnyAdminOnlineAsync();
                if (!isAdminOnline)
                {
                    // Set ChatMode = AI if no admin is online
                    if (conversation.ChatMode != ChatMode.AI)
                    {
                        conversation.ChatMode = ChatMode.AI;
                        await _db.SaveChangesAsync();
                        // Optional: broadcast ChatModeChanged to clients? Yes.
                        // Currently, the prompt doesn't explicitly ask for ChatModeChanged event when switching to AI,
                        // but it sets the conversation chat mode.
                    }

                    // Execute AI/FAQ reply in background so it doesn't block the client
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            using var scope = _scopeFactory.CreateScope();
                            var scopedFaqService = scope.ServiceProvider.GetRequiredService<IFaqService>();
                            var scopedAiChatService = scope.ServiceProvider.GetRequiredService<IAiChatService>();
                            var scopedDb = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
                            var scopedHubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();

                            // Phase 3: Try match FAQ first
                            var matchedFaq = await scopedFaqService.TryMatchFaqAsync(content);
                            string aiResponseContent;

                            if (matchedFaq != null)
                            {
                                aiResponseContent = matchedFaq.Answer;
                            }
                            else
                            {
                                // Phase 4: Call OpenAI if no FAQ matches
                                var lastMessages = await scopedDb.Messages
                                    .AsNoTracking()
                                    .Where(m => m.ConversationId == conversationId)
                                    .OrderByDescending(m => m.CreatedAt)
                                    .Take(10)
                                    .ToListAsync();

                                lastMessages.Reverse();

                                var history = lastMessages
                                    .Where(m => m.SenderType != SenderType.System)
                                    .Select(m => (
                                        role: m.SenderType == SenderType.User ? "user" : "assistant",
                                        content: m.Content
                                    ))
                                    .ToList();

                                var scopedProductService = scope.ServiceProvider.GetRequiredService<IProductContextService>();

                                // Send AI typing indicator
                                await scopedHubContext.Clients.Group(IChatService.ConversationGroup(conversationId))
                                    .SendAsync("ReceiveTyping", conversationId, true);

                                string systemPrompt = "Bạn là nhân viên tư vấn của cửa hàng thời trang THEBOB. Trả lời thân thiện, ngắn gọn, tiếng Việt. Nếu không chắc thông tin, đề nghị khách chờ nhân viên hỗ trợ.";
                                
                                if (conversation.CurrentProductId.HasValue)
                                {
                                    var productCtx = await scopedProductService.BuildContextAsync(conversation.CurrentProductId.Value);
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

                                aiResponseContent = await scopedAiChatService.GenerateReplyAsync(systemPrompt, history, content);
                            }

                            var aiMessage = new Message
                            {
                                ConversationId = conversationId,
                                SenderType = SenderType.AI,
                                Content = aiResponseContent,
                                CreatedAt = DateTime.UtcNow,
                                IsRead = false
                            };
                            scopedDb.Messages.Add(aiMessage);
                            await scopedDb.SaveChangesAsync();

                            var aiDto = MapMessage(aiMessage, "AI Assistant");
                            await scopedHubContext.Clients
                                .Group(IChatService.ConversationGroup(conversationId))
                                .SendAsync("ReceiveMessage", aiDto);

                            // Turn off typing indicator
                            await scopedHubContext.Clients.Group(IChatService.ConversationGroup(conversationId))
                                .SendAsync("ReceiveTyping", conversationId, false);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error processing background AI message");
                        }
                    });
                }
                else
                {
                    // If Admin online, keep ChatMode = Admin
                    if (conversation.ChatMode != ChatMode.Admin)
                    {
                        conversation.ChatMode = ChatMode.Admin;
                        await _db.SaveChangesAsync();
                    }
                }
            }

            return dto;
        }

        public async Task HandleAdminOnlineAsync()
        {
            // When an admin comes online, find all open conversations currently in AI mode
            var aiConversations = await _db.Conversations
                .Where(c => c.Status == ConversationStatus.Open && c.ChatMode == ChatMode.AI)
                .ToListAsync();

            foreach (var conv in aiConversations)
            {
                conv.ChatMode = ChatMode.Admin;
                
                var systemMsg = new Message
                {
                    ConversationId = conv.Id,
                    SenderType = SenderType.System,
                    Content = "Nhân viên đã tham gia cuộc trò chuyện.",
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                };
                
                _db.Messages.Add(systemMsg);
                await _db.SaveChangesAsync();

                var sysDto = MapMessage(systemMsg, "System");
                await _hubContext.Clients
                    .Group(IChatService.ConversationGroup(conv.Id))
                    .SendAsync("ReceiveMessage", sysDto);
            }
        }

        public async Task<(Conversation Conversation, ChatMessageDto Message)> SendMessageForUserAsync(
            int userId, bool isAdmin, string content, int? conversationId = null, int? productId = null, int? variantId = null)
        {
            Conversation conversation;

            if (conversationId.HasValue)
            {
                if (!await CanAccessConversationAsync(conversationId.Value, userId, isAdmin))
                {
                    throw new UnauthorizedAccessException("Không có quyền truy cập hội thoại này.");
                }

                conversation = await _db.Conversations.FindAsync(conversationId.Value)
                    ?? throw new KeyNotFoundException("Không tìm thấy hội thoại.");
            }
            else if (isAdmin)
            {
                throw new ArgumentException("Admin cần chỉ định conversationId.");
            }
            else
            {
                conversation = await GetOrCreateOpenConversationAsync(userId);
            }

            var message = await SendMessageAsync(conversation.Id, userId, isAdmin, content, productId, variantId);
            return (conversation, message);
        }

        public async Task<PagedMessagesResponse> GetMessagesAsync(
            int conversationId, int userId, bool isAdmin, int page = 1, int pageSize = 50)
        {
            if (!await CanAccessConversationAsync(conversationId, userId, isAdmin))
            {
                throw new UnauthorizedAccessException("Không có quyền truy cập hội thoại này.");
            }

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.Messages
                .AsNoTracking()
                .Where(m => m.ConversationId == conversationId);

            var totalCount = await query.CountAsync();

            var messages = await query
                .OrderByDescending(m => m.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Include(m => m.Sender)
                .ToListAsync();

            messages.Reverse();

            return new PagedMessagesResponse
            {
                Items = messages.Select(m => MapMessage(m, m.Sender?.FullName)).ToList(),
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                HasMore = page * pageSize < totalCount
            };
        }

        public async Task<List<ConversationListItemDto>> GetConversationsAsync(int userId, bool isAdmin)
        {
            var query = _db.Conversations.AsNoTracking();

            if (!isAdmin)
            {
                query = query.Where(c => c.UserId == userId);
            }

            var conversations = await query
                .OrderByDescending(c => c.UpdatedAt)
                .Include(c => c.User)
                .Include(c => c.AssignedAdmin)
                .ToListAsync();

            var conversationIds = conversations.Select(c => c.Id).ToList();

            var lastMessageIds = await _db.Messages
                .AsNoTracking()
                .Where(m => conversationIds.Contains(m.ConversationId))
                .GroupBy(m => m.ConversationId)
                .Select(g => g.Max(m => m.Id))
                .ToListAsync();

            var lastMessages = await _db.Messages
                .AsNoTracking()
                .Where(m => lastMessageIds.Contains(m.Id))
                .ToListAsync();

            var lastMessageMap = lastMessages.ToDictionary(m => m.ConversationId);

            var unreadSenderTypes = isAdmin
                ? new[] { SenderType.User }
                : new[] { SenderType.Admin, SenderType.AI, SenderType.System };

            var unreadCounts = await _db.Messages
                .AsNoTracking()
                .Where(m => conversationIds.Contains(m.ConversationId)
                    && !m.IsRead
                    && unreadSenderTypes.Contains(m.SenderType))
                .GroupBy(m => m.ConversationId)
                .Select(g => new { ConversationId = g.Key, Count = g.Count() })
                .ToListAsync();

            var unreadMap = unreadCounts.ToDictionary(x => x.ConversationId, x => x.Count);

            return conversations.Select(c =>
            {
                lastMessageMap.TryGetValue(c.Id, out var lastMessage);
                unreadMap.TryGetValue(c.Id, out var unread);

                return new ConversationListItemDto
                {
                    Id = c.Id,
                    UserId = c.UserId,
                    UserName = c.User?.FullName,
                    UserEmail = c.User?.Email,
                    AssignedAdminId = c.AssignedAdminId,
                    AssignedAdminName = c.AssignedAdmin?.FullName,
                    Status = c.Status.ToString(),
                    ChatMode = c.ChatMode.ToString(),
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    LastMessagePreview = lastMessage?.Content,
                    UnreadCount = unread
                };
            }).ToList();
        }

        public async Task<int> MarkMessagesAsSeenAsync(int conversationId, int userId, bool isAdmin)
        {
            if (!await CanAccessConversationAsync(conversationId, userId, isAdmin))
            {
                throw new UnauthorizedAccessException("Không có quyền truy cập hội thoại này.");
            }

            var senderTypesToMark = isAdmin
                ? new[] { SenderType.User }
                : new[] { SenderType.Admin, SenderType.AI, SenderType.System };

            var messages = await _db.Messages
                .Where(m => m.ConversationId == conversationId
                    && !m.IsRead
                    && senderTypesToMark.Contains(m.SenderType))
                .ToListAsync();

            if (messages.Count == 0)
            {
                return 0;
            }

            foreach (var message in messages)
            {
                message.IsRead = true;
            }

            await _db.SaveChangesAsync();

            await _hubContext.Clients
                .Group(IChatService.ConversationGroup(conversationId))
                .SendAsync("MessagesSeen", conversationId, userId);

            return messages.Count;
        }

        public async Task NotifyTypingAsync(
            int conversationId, int userId, bool isAdmin, bool isTyping, string? excludeConnectionId = null)
        {
            if (!await CanAccessConversationAsync(conversationId, userId, isAdmin))
            {
                return;
            }

            var clients = string.IsNullOrEmpty(excludeConnectionId)
                ? _hubContext.Clients.Group(IChatService.ConversationGroup(conversationId))
                : _hubContext.Clients.GroupExcept(IChatService.ConversationGroup(conversationId), excludeConnectionId);

            await clients.SendAsync("TypingIndicator", conversationId, userId, isTyping);
        }

        private static ChatMessageDto MapMessage(Message message, string? senderName)
        {
            return new ChatMessageDto
            {
                Id = message.Id,
                ConversationId = message.ConversationId,
                SenderType = message.SenderType.ToString(),
                SenderId = message.SenderId,
                SenderName = senderName,
                Content = message.Content,
                ImageUrl = message.ImageUrl,
                MessageType = message.MessageType.ToString(),
                ReferenceId = message.ReferenceId,
                Metadata = message.Metadata,
                CreatedAt = message.CreatedAt,
                IsRead = message.IsRead
            };
        }
    }
}
