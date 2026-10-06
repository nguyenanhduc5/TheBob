using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _notificationService;

        public NotificationsController(INotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        [HttpGet]
        public async Task<ActionResult<object>> GetNotifications()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var notifications = await _notificationService.GetNotificationsAsync(userId.Value);
            return Ok(new { success = true, data = notifications });
        }

        [HttpPut("{id}/read")]
        public async Task<ActionResult<object>> MarkAsRead(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var success = await _notificationService.MarkAsReadAsync(id, userId.Value);
            if (!success)
            {
                return NotFound(new { success = false, message = "Notification not found" });
            }

            return Ok(new { success = true, message = "Notification marked as read" });
        }

        [HttpPut("read-all")]
        public async Task<ActionResult<object>> MarkAllAsRead()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            await _notificationService.MarkAllAsReadAsync(userId.Value);
            return Ok(new { success = true, message = "All notifications marked as read" });
        }

        private int? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value;
            if (int.TryParse(sub, out var id)) return id;

            var nameId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(nameId, out id)) return id;

            return null;
        }
    }
}
