using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.DTOs.Chat;
using THEBOB.Models;
using THEBOB.Services.Chat;
using Microsoft.EntityFrameworkCore;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/chat")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IPresenceService _presenceService;
        private readonly THEBOB.Data.ThebobDbContext _db;

        public ChatController(IChatService chatService, IPresenceService presenceService, THEBOB.Data.ThebobDbContext db)
        {
            _chatService = chatService;
            _presenceService = presenceService;
            _db = db;
        }

        [HttpGet("search-product")]
        public async Task<IActionResult> SearchProduct([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return Ok(ApiResponse<List<object>>.Ok(new List<object>()));
            }

            var query = q.Trim().ToLower();
            var products = await _db.Products
                .Include(p => p.ProductVariants)
                .Where(p => !p.IsDeleted && p.IsAvailable && p.Name.ToLower().Contains(query))
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    thumbnail = p.MainImageUrl,
                    price = p.ProductVariants.Any() ? p.ProductVariants.Min(v => v.Price) : 0
                })
                .Take(5)
                .ToListAsync();

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
                    userId.Value, isAdmin, request.Content, request.ConversationId, request.ProductId, request.VariantId);

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
