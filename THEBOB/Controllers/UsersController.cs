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
    [Authorize(Roles = "Admin")]
    public class UsersController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public UsersController(ThebobDbContext context)
        {
            _context = context;
        }

        // GET: api/users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            var users = await _context.Users
                .Select(u => new {
                    u.Id,
                    u.Username,
                    u.Email,
                    u.Name,
                    u.Phone,
                    u.Address,
                    Role = u.Role.ToString(),
                    u.CreatedAt,
                    u.IsActive
                })
                .ToListAsync();

            return Ok(new { success = true, data = users });
        }

        // PUT: api/users/{id}/role
        [HttpPut("{id}/role")]
        public async Task<ActionResult> UpdateUserRole(int id, [FromBody] UpdateRoleRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Role))
                return BadRequest(new { success = false, message = "Invalid role" });

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { success = false, message = "User not found" });

            var currentUserId = GetCurrentUserId();
            if (currentUserId == id)
            {
                return BadRequest(new { success = false, message = "You cannot change your own role" });
            }

            if (!Enum.TryParse<UserRole>(req.Role, true, out var parsedRole))
                return BadRequest(new { success = false, message = "Unknown role" });

            user.Role = parsedRole;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "User role updated" });
        }

        // PUT: api/users/{id}/activate
        [HttpPut("{id}/activate")]
        public async Task<ActionResult> SetUserActive(int id, [FromBody] SetActiveRequest req)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { success = false, message = "User not found" });

            var currentUserId = GetCurrentUserId();
            if (currentUserId == id && req.IsActive == false)
            {
                return BadRequest(new { success = false, message = "You cannot deactivate your own account" });
            }

            user.IsActive = req.IsActive;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "User status updated" });
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

    public class UpdateRoleRequest
    {
        public string Role { get; set; } = string.Empty;
    }

    public class SetActiveRequest
    {
        public bool IsActive { get; set; }
    }
}
