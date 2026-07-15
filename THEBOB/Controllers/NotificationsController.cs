using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public NotificationsController(ThebobDbContext context)
        {
            _context = context;
        }

        // GET: api/notifications
        [HttpGet]
        public async Task<ActionResult<object>> GetNotifications()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId.Value)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new
                {
                    n.Id,
                    n.Message,
                    n.Type,
                    n.IsRead,
                    n.CreatedAt
                })
                .ToListAsync();

            return Ok(new { success = true, data = notifications });
        }

        // PUT: api/notifications/{id}/read
        [HttpPut("{id}/read")]
        public async Task<ActionResult<object>> MarkAsRead(int id)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);

            if (notification == null)
            {
                return NotFound(new { success = false, message = "Notification not found" });
            }

            notification.IsRead = true;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Notification marked as read" });
        }

        // PUT: api/notifications/read-all
        [HttpPut("read-all")]
        public async Task<ActionResult<object>> MarkAllAsRead()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var unreadNotifications = await _context.Notifications
                .Where(n => n.UserId == userId.Value && !n.IsRead)
                .ToListAsync();

            foreach (var n in unreadNotifications)
            {
                n.IsRead = true;
            }

            await _context.SaveChangesAsync();

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
