using THEBOB.DTOs.Chat;
using THEBOB.Models.LiveChat;

namespace THEBOB.Services.Chat
{
    public interface IChatService
    {
        static string ConversationGroup(int conversationId) => $"conversation:{conversationId}";

        Task<bool> CanAccessConversationAsync(int conversationId, int userId, bool isAdmin);

        Task<Conversation> GetOrCreateOpenConversationAsync(int userId);

        Task<ChatMessageDto> SendMessageAsync(int conversationId, int userId, bool isAdmin, string content);

        Task<(Conversation Conversation, ChatMessageDto Message)> SendMessageForUserAsync(
            int userId, bool isAdmin, string content, int? conversationId = null);

        Task<PagedMessagesResponse> GetMessagesAsync(
            int conversationId, int userId, bool isAdmin, int page = 1, int pageSize = 50);

        Task<List<ConversationListItemDto>> GetConversationsAsync(int userId, bool isAdmin);

        Task<int> MarkMessagesAsSeenAsync(int conversationId, int userId, bool isAdmin);

        Task NotifyTypingAsync(int conversationId, int userId, bool isAdmin, bool isTyping, string? excludeConnectionId = null);
    }
}
