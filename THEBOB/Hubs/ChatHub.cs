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
        private readonly IPresenceService _presenceService;

        public ChatHub(IChatService chatService, IPresenceService presenceService)
        {
            _chatService = chatService;
            _presenceService = presenceService;
        }

        public override async Task OnConnectedAsync()
        {
            var (userId, isAdmin) = GetCallerContext();
            if (userId.HasValue && isAdmin)
            {
                await _presenceService.SetAdminOnlineAsync(userId.Value, Context.ConnectionId);
                
                await Clients.All.SendAsync("AdminStatusChanged", true);
                
                // Switch AI conversations to Admin
                await _chatService.HandleAdminOnlineAsync();
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (userId.HasValue && isAdmin)
            {
                await _presenceService.SetAdminOfflineAsync(Context.ConnectionId);
                
                bool anyAdminLeft = await _presenceService.IsAnyAdminOnlineAsync();
                if (!anyAdminLeft)
                {
                    await Clients.All.SendAsync("AdminStatusChanged", false);
                }
            }
            await base.OnDisconnectedAsync(exception);
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

        public async Task SendMessage(int conversationId, string content, int? productId = null, int? variantId = null)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                throw new HubException("Unauthorized");
            }

            await _chatService.SendMessageAsync(conversationId, userId.Value, isAdmin, content, productId, variantId);
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
