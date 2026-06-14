using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
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
            var username = (request.Username ?? string.Empty).Trim();
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var name = (request.Name ?? string.Empty).Trim();
            var phone = (request.Phone ?? string.Empty).Trim();
            var address = request.Address?.Trim() ?? string.Empty;

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(request.Password) || string.IsNullOrEmpty(phone))
                return BadRequest(new { success = false, message = "Username, email, password và số điện thoại là bắt buộc" });

            if (username.Length < 3)
                return BadRequest(new { success = false, message = "Tên đăng nhập phải có ít nhất 3 ký tự" });

            if (!new EmailAddressAttribute().IsValid(email))
                return BadRequest(new { success = false, message = "Định dạng email không hợp lệ" });

            if (request.Password.Length < 6)
                return BadRequest(new { success = false, message = "Password must be at least 6 characters" });

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { success = false, message = "Họ tên là bắt buộc" });

            var existingUser = _context.Users.FirstOrDefault(u => u.Email.ToLower() == email);
            if (existingUser != null)
                return BadRequest(new { success = false, message = "Email đã được sử dụng" });

            var userRole = _context.Roles.FirstOrDefault(r => r.RoleName == "User");
            if (userRole == null)
            {
                userRole = new Role { RoleName = "User" };
                _context.Roles.Add(userRole);
                await _context.SaveChangesAsync();
            }

            var user = new User
            {
                Email = email,
                FullName = name,
                Phone = phone,
                Address = address,
                PasswordHash = _authService.HashPassword(request.Password),
                RoleId = userRole.Id,
                RoleEntity = userRole
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
                    role = user.RoleEntity?.RoleName ?? user.Role.ToString()
                }
            });
        }

        [HttpPost("login")]
        public ActionResult<object> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { success = false, message = "Email và mật khẩu là bắt buộc" });

            var normalizedEmail = request.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalizedEmail))
                return BadRequest(new { success = false, message = "Email và mật khẩu là bắt buộc" });

            var user = _context.Users.Include(u => u.RoleEntity).FirstOrDefault(u => u.Email.ToLower() == normalizedEmail);
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
                    role = user.RoleEntity?.RoleName ?? user.Role.ToString()
                }
            });
        }

        [Authorize]
        [HttpGet("profile")]
        public ActionResult<object> GetProfile()
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { success = false, message = "Invalid token" });

            var user = _context.Users
                .Include(u => u.RoleEntity)
                .Include(u => u.Addresses)
                .FirstOrDefault(u => u.Id == userId.Value);
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
                    role = user.RoleEntity?.RoleName ?? user.Role.ToString()
                }
            });
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<ActionResult<object>> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { success = false, message = "Invalid token" });

            var user = _context.Users
                .Include(u => u.RoleEntity)
                .Include(u => u.Addresses)
                .FirstOrDefault(u => u.Id == userId.Value);
            if (user == null)
                return NotFound(new { success = false, message = "User not found" });

            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
                return BadRequest(new { success = false, message = "Tên và số điện thoại là bắt buộc" });

            user.Name = request.Name.Trim();
            user.Phone = request.Phone.Trim();
            user.Address = request.Address?.Trim() ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var email = request.Email.Trim().ToLowerInvariant();
                var emailExists = await _context.Users.AnyAsync(u => u.Id != user.Id && u.Email.ToLower() == email);
                if (emailExists)
                    return BadRequest(new { success = false, message = "Email da duoc su dung" });

                user.Email = email;
            }
            user.UpdatedAt = DateTime.UtcNow;

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
                    role = user.RoleEntity?.RoleName ?? user.Role.ToString()
                }
            });
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
