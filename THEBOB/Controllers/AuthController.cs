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
        private readonly IEmailService _emailService;

        public AuthController(ThebobDbContext context, IAuthService authService, IEmailService emailService)
        {
            _context = context;
            _authService = authService;
            _emailService = emailService;
        }

        [HttpPost("send-otp")]
        public async Task<ActionResult<object>> SendOtp([FromBody] SendOtpRequest request)
        {
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();

            if (string.IsNullOrEmpty(email))
                return BadRequest(new { success = false, message = "Email là bắt buộc" });

            if (!new EmailAddressAttribute().IsValid(email))
                return BadRequest(new { success = false, message = "Định dạng email không hợp lệ" });

            var existingUser = await _context.Users.AnyAsync(u => u.Email.ToLower() == email);
            if (existingUser)
                return BadRequest(new { success = false, message = "Email đã được sử dụng" });

            var otpCode = Random.Shared.Next(100000, 999999).ToString();

            var otpVerification = new OtpVerification
            {
                Email = email,
                OtpCode = otpCode,
                ExpiredAt = DateTime.UtcNow.AddMinutes(5),
                IsUsed = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.OtpVerifications.Add(otpVerification);
            await _context.SaveChangesAsync();

            var subject = "Mã OTP xác thực tài khoản THEBOB";
            var content = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
                    <h2 style='color: #333; text-align: center;'>Xác thực đăng ký tài khoản THEBOB</h2>
                    <p>Xin chào,</p>
                    <p>Bạn đang đăng ký tài khoản tại <strong>THEBOB Store</strong>. Dưới đây là mã OTP xác thực của bạn:</p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <span style='font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; background-color: #F3F4F6; padding: 10px 20px; border-radius: 5px;'>{otpCode}</span>
                    </div>
                    <p style='color: #666;'>Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
                    <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;' />
                    <p style='font-size: 12px; color: #999; text-align: center;'>Đây là email tự động, vui lòng không phản hồi email này.</p>
                </div>";

            var emailSent = await _emailService.SendEmailAsync(email, subject, content);
            if (!emailSent)
            {
                return BadRequest(new { success = false, message = "Không thể gửi OTP đến email này. Vui lòng kiểm tra lại." });
            }

            return Ok(new { success = true, message = "Mã OTP đã được gửi đến email của bạn" });
        }

        [HttpPost("register")]
        public async Task<ActionResult<object>> Register([FromBody] RegisterRequest request)
        {
            var username = (request.Username ?? string.Empty).Trim();
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var name = (request.Name ?? string.Empty).Trim();
            var phone = (request.Phone ?? string.Empty).Trim();
            var address = request.Address?.Trim() ?? string.Empty;
            var otpCode = (request.OtpCode ?? string.Empty).Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(request.Password) || string.IsNullOrEmpty(phone))
                return BadRequest(new { success = false, message = "Username, email, password và số điện thoại là bắt buộc" });

            if (string.IsNullOrEmpty(otpCode))
                return BadRequest(new { success = false, message = "Mã xác thực OTP là bắt buộc" });

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

            var latestOtp = await _context.OtpVerifications
                .Where(o => o.Email.ToLower() == email && !o.IsUsed && o.ExpiredAt > DateTime.UtcNow)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();

            if (latestOtp == null || latestOtp.OtpCode != otpCode)
            {
                return BadRequest(new { success = false, message = "Mã OTP không chính xác hoặc đã hết hạn" });
            }

            latestOtp.IsUsed = true;
            _context.OtpVerifications.Update(latestOtp);

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
        public string OtpCode { get; set; } = string.Empty;
    }

    public class SendOtpRequest
    {
        public string Email { get; set; } = string.Empty;
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
