using Microsoft.AspNetCore.Mvc;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ThebobDbContext _context;
        private readonly IAuthService _authService;

        public AuthController(ThebobDbContext context, IAuthService authService)
        {
            _context = context;
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<ActionResult<object>> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest("Username and password are required");

            var existingUser = _context.Users.FirstOrDefault(u => u.Username == request.Username);
            if (existingUser != null)
                return BadRequest("Username already exists");

            var user = new User
            {
                Username = request.Username,
                Email = request.Email ?? "",
                PasswordHash = _authService.HashPassword(request.Password),
                Role = UserRole.User
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var token = _authService.GenerateJwtToken(user);
            return Ok(new { token, userId = user.Id, username = user.Username, role = user.Role.ToString() });
        }

        [HttpPost("login")]
        public ActionResult<object> Login([FromBody] LoginRequest request)
        {
            var user = _context.Users.FirstOrDefault(u => u.Username == request.Username);
            if (user == null || !_authService.VerifyPassword(request.Password, user.PasswordHash))
                return Unauthorized("Invalid username or password");

            if (!user.IsActive)
                return Unauthorized("User account is inactive");

            var token = _authService.GenerateJwtToken(user);
            return Ok(new { token, userId = user.Id, username = user.Username, role = user.Role.ToString() });
        }
    }

    public class RegisterRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? Email { get; set; }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
