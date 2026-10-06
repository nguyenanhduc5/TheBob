using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.Data;
using THEBOB.DTOs.Blog;
using THEBOB.DTOs.Chat;
using THEBOB.Models;
using THEBOB.Models.Blog;
using THEBOB.Models.LiveChat;
using THEBOB.Services.Chat;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/chat")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IPresenceService _presenceService;

        public ChatController(IChatService chatService, IPresenceService presenceService)
        {
            _chatService = chatService;
            _presenceService = presenceService;
        }

        [HttpGet("search-product")]          // Giữ backward compat cho FE cũ
        [HttpGet("products")]                  // RESTful alias: GET /api/chat/products?q=...
        public async Task<IActionResult> SearchProduct([FromQuery] string q)
        {
            var products = await _chatService.SearchProductsAsync(q);
            return Ok(ApiResponse<object>.Ok(products));
        }

        [HttpGet("admin-status")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAdminStatus()
        {
            var isOnline = await _presenceService.IsAnyAdminOnlineAsync();
            return Ok(ApiResponse<bool>.Ok(isOnline));
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                return Unauthorized(ApiResponse<object>.Fail("Phiên đăng nhập không hợp lệ."));
            }

            var conversations = await _chatService.GetConversationsAsync(userId.Value, isAdmin);
            return Ok(ApiResponse<List<ConversationListItemDto>>.Ok(conversations));
        }

        [HttpGet("messages/{conversationId:int}")]
        public async Task<IActionResult> GetMessages(
            int conversationId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                return Unauthorized(ApiResponse<object>.Fail("Phiên đăng nhập không hợp lệ."));
            }

            var result = await _chatService.GetMessagesAsync(
                conversationId, userId.Value, isAdmin, page, pageSize);
            return Ok(ApiResponse<PagedMessagesResponse>.Ok(result));
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendMessage([FromBody] SendChatMessageRequest request)
        {
            var (userId, isAdmin) = GetCallerContext();
            if (!userId.HasValue)
            {
                return Unauthorized(ApiResponse<object>.Fail("Phiên đăng nhập không hợp lệ."));
            }

            if (string.IsNullOrWhiteSpace(request.Content))
            {
                return BadRequest(ApiResponse<object>.Fail("Nội dung tin nhắn không được để trống."));
            }

            var senderName = User.FindFirst(ClaimTypes.Name)?.Value;
            ChatMode? requestedChatMode = Enum.TryParse<ChatMode>(request.ChatMode, true, out var parsedChatMode)
                ? parsedChatMode
                : null;
            var (_, message) = await _chatService.SendMessageForUserAsync(
                userId.Value, isAdmin, request.Content, request.ConversationId, request.ProductId, request.VariantId, senderName, requestedChatMode);

            return Ok(ApiResponse<ChatMessageDto>.Ok(message));
        }

        private (int? UserId, bool IsAdmin) GetCallerContext()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userId = int.TryParse(userIdClaim, out var id) ? id : (int?)null;
            var isAdmin = User.IsInRole("Admin");
            return (userId, isAdmin);
        }

        /// <summary>Admin: gửi bài viết blog vào một đoạn chat 1-1.</summary>
        [HttpPost("send-blog-post")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SendBlogPost([FromBody] SendBlogPostInChatRequest request)
        {
            var (userId, _) = GetCallerContext();
            if (!userId.HasValue) return Unauthorized(ApiResponse<object>.Fail("Phiên đăng nhập không hợp lệ."));

            var result = await _chatService.ShareBlogPostAsync(request.ConversationId, request.BlogPostId, userId.Value);
            if (!result.Success)
            {
                if (result.StatusCode == 404)
                    return NotFound(ApiResponse<object>.Fail(result.Message));

                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.Message));
            }

            return Ok(ApiResponse<ChatMessageDto>.Ok(result.Data!));
        }
    }
}
