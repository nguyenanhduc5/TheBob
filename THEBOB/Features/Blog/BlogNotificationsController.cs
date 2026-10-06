using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.DTOs.Blog;
using THEBOB.Models;
using THEBOB.Services.Blog;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/blog-notifications")]
    [Authorize]
    public class BlogNotificationsController : ControllerBase
    {
        private readonly IBlogNotificationService _notifService;

        public BlogNotificationsController(IBlogNotificationService notifService)
        {
            _notifService = notifService;
        }

        /// <summary>Admin: gửi thông báo bài viết tới user.</summary>
        [HttpPost("send")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Send([FromBody] SendBlogNotificationRequest request)
        {
            var adminId = GetCurrentUserId();
            if (!adminId.HasValue) return Unauthorized();

            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest(ApiResponse<object>.Fail("Tiêu đề thông báo không được để trống."));

            var notifId = await _notifService.SendAsync(adminId.Value, request);
            return Ok(ApiResponse<object>.Ok(new { notificationId = notifId, message = "Đã xếp hàng gửi thông báo." }));
        }

        /// <summary>User: lấy danh sách thông báo blog của mình.</summary>
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var items = await _notifService.GetForUserAsync(userId.Value, page, pageSize);
            return Ok(ApiResponse<List<BlogNotificationDto>>.Ok(items));
        }

        /// <summary>User: số thông báo chưa đọc.</summary>
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();
            var count = await _notifService.GetUnreadCountAsync(userId.Value);
            return Ok(ApiResponse<int>.Ok(count));
        }

        /// <summary>User: đánh dấu 1 thông báo đã đọc.</summary>
        [HttpPut("{id:int}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();
            await _notifService.MarkAsReadAsync(id, userId.Value);
            return Ok(ApiResponse<bool>.Ok(true));
        }

        /// <summary>User: đánh dấu tất cả đã đọc.</summary>
        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();
            await _notifService.MarkAllAsReadAsync(userId.Value);
            return Ok(ApiResponse<bool>.Ok(true));
        }

        private int? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value
                   ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(sub, out var id) ? id : null;
        }
    }
}
