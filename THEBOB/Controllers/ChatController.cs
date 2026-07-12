using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.DTOs.Chat;
using THEBOB.Models;
using THEBOB.Services.Chat;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/chat")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;

        public ChatController(IChatService chatService)
        {
            _chatService = chatService;
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

            try
            {
                var result = await _chatService.GetMessagesAsync(
                    conversationId, userId.Value, isAdmin, page, pageSize);
                return Ok(ApiResponse<PagedMessagesResponse>.Ok(result));
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
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

            try
            {
                var (_, message) = await _chatService.SendMessageForUserAsync(
                    userId.Value, isAdmin, request.Content, request.ConversationId);

                return Ok(ApiResponse<ChatMessageDto>.Ok(message));
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message));
            }
        }

        private (int? UserId, bool IsAdmin) GetCallerContext()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userId = int.TryParse(userIdClaim, out var id) ? id : (int?)null;
            var isAdmin = User.IsInRole("Admin");
            return (userId, isAdmin);
        }
    }
}
