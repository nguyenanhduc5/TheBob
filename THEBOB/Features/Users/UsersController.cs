using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
        }

        // GET: api/users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            var users = await _userService.GetUsersAsync();
            return Ok(new { success = true, data = users });
        }

        // GET: api/users/by-email?email=user@example.com
        [HttpGet("by-email")]
        public async Task<ActionResult> GetUserByEmail([FromQuery] string email)
        {
            var result = await _userService.GetUserByEmailAsync(email);
            if (!result.Success)
            {
                if (result.ErrorMessage != null && result.ErrorMessage.Contains("Không tìm thấy"))
                    return NotFound(new { success = false, message = result.ErrorMessage });

                return BadRequest(new { success = false, message = result.ErrorMessage });
            }

            return Ok(result.UserData);
        }

        // PUT: api/users/{id}/role
        [HttpPut("{id}/role")]
        public async Task<ActionResult> UpdateUserRole(int id, [FromBody] UpdateRoleRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Role))
                return BadRequest(new { success = false, message = "Invalid role" });

            var currentUserId = GetCurrentUserId();
            var result = await _userService.UpdateUserRoleAsync(id, req.Role, currentUserId);

            return StatusCode(result.StatusCode, new { success = result.Success, message = result.Message });
        }

        // PUT: api/users/{id}/activate
        [HttpPut("{id}/activate")]
        public async Task<ActionResult> SetUserActive(int id, [FromBody] SetActiveRequest req)
        {
            var currentUserId = GetCurrentUserId();
            var result = await _userService.SetUserActiveAsync(id, req.IsActive, currentUserId);

            return StatusCode(result.StatusCode, new { success = result.Success, message = result.Message });
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
