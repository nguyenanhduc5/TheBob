using Microsoft.AspNetCore.Authorization;
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
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Phone))
                return BadRequest(new { success = false, message = "Username, password và số điện thoại là bắt buộc" });

            if (request.Password.Length < 6)
                return BadRequest(new { success = false, message = "Password must be at least 6 characters" });

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { success = false, message = "Họ tên là bắt buộc" });

            var existingUser = _context.Users.FirstOrDefault(u => u.Username == request.Username);
            if (existingUser != null)
                return BadRequest(new { success = false, message = "Username already exists" });

            var user = new User
            {
                Username = request.Username,
                Email = request.Email ?? string.Empty,
                Name = request.Name.Trim(),
                Phone = request.Phone.Trim(),
                Address = request.Address?.Trim() ?? string.Empty,
                PasswordHash = _authService.HashPassword(request.Password),
                Role = UserRole.User
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var token = _authService.GenerateJwtToken(user);
            return Ok(new
            {
                success = true,
                message = "Registration successful",
                data = new
                {
                    token,
                    id = user.Id,
                    userId = user.Id,
                    username = user.Username,
                    email = user.Email,
                    name = user.Name,
                    phone = user.Phone,
                    address = user.Address,
                    role = user.Role.ToString()
                }
            });
        }

        [HttpPost("login")]
        public ActionResult<object> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { success = false, message = "Email và mật khẩu là bắt buộc" });

            var normalizedEmail = request.Email.Trim();
            var user = _context.Users.FirstOrDefault(u => u.Email == normalizedEmail);
            if (user == null || !_authService.VerifyPassword(request.Password, user.PasswordHash))
                return Unauthorized(new { success = false, message = "Email hoặc mật khẩu không hợp lệ" });

            if (!user.IsActive)
                return Unauthorized(new { success = false, message = "User account is inactive" });

            var token = _authService.GenerateJwtToken(user);
            return Ok(new
            {
                success = true,
                message = "Login successful",
                data = new
                {
                    token,
                    id = user.Id,
                    userId = user.Id,
                    username = user.Username,
                    email = user.Email,
                    name = user.Name,
                    phone = user.Phone,
                    address = user.Address,
                    role = user.Role.ToString()
                }
            });
        }

        [Authorize]
        [HttpGet("profile")]
        public ActionResult<object> GetProfile()
        {
            var userIdClaim = User.FindFirst("sub")?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { success = false, message = "Invalid token" });

            var user = _context.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                return NotFound(new { success = false, message = "User not found" });

            return Ok(new
            {
                success = true,
                data = new
                {
                    id = user.Id,
                    userId = user.Id,
                    username = user.Username,
                    email = user.Email,
                    name = user.Name,
                    phone = user.Phone,
                    address = user.Address,
                    role = user.Role.ToString()
                }
            });
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<ActionResult<object>> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            var userIdClaim = User.FindFirst("sub")?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { success = false, message = "Invalid token" });

            var user = _context.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                return NotFound(new { success = false, message = "User not found" });

            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
                return BadRequest(new { success = false, message = "Tên và số điện thoại là bắt buộc" });

            user.Name = request.Name.Trim();
            user.Phone = request.Phone.Trim();
            user.Address = request.Address?.Trim() ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                user.Email = request.Email.Trim();
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = "Thông tin tài khoản đã được cập nhật",
                data = new
                {
                    userId = user.Id,
                    username = user.Username,
                    email = user.Email,
                    name = user.Name,
                    phone = user.Phone,
                    address = user.Address,
                    role = user.Role.ToString()
                }
            });
        }
    }

    public class RegisterRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Address { get; set; }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class UpdateProfileRequest
    {
        public string? Email { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Address { get; set; }
    }
}
