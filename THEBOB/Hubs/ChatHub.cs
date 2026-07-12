using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using THEBOB.Services.Chat;

namespace THEBOB.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;

        public ChatHub(IChatService chatService)
        {
            _chatService = chatService;
        }

        public async Task JoinConversation(int conversationId)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                throw new HubException("Unauthorized");
            }

            if (!await _chatService.CanAccessConversationAsync(conversationId, userId.Value, isAdmin))
            {
                throw new HubException("Không có quyền tham gia hội thoại này.");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, IChatService.ConversationGroup(conversationId));
        }

        public async Task LeaveConversation(int conversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, IChatService.ConversationGroup(conversationId));
        }

        public async Task SendMessage(int conversationId, string content)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                throw new HubException("Unauthorized");
            }

            await _chatService.SendMessageAsync(conversationId, userId.Value, isAdmin, content);
        }

        public async Task Typing(int conversationId, bool isTyping)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                return;
            }

            await _chatService.NotifyTypingAsync(
                conversationId, userId.Value, isAdmin, isTyping, Context.ConnectionId);
        }

        public async Task Seen(int conversationId)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                throw new HubException("Unauthorized");
            }

            await _chatService.MarkMessagesAsSeenAsync(conversationId, userId.Value, isAdmin);
        }

        private (int? UserId, bool IsAdmin) GetCallerContext()
        {
            var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userId = int.TryParse(userIdClaim, out var id) ? id : (int?)null;
            var isAdmin = Context.User?.IsInRole("Admin") == true;
            return (userId, isAdmin);
        }
    }
}
