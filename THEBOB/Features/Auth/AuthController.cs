using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using THEBOB.Infrastructure.RateLimiting;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        // Rate limit 3 lần / 2 phút / IP: Bảo vệ tài khoản SendGrid tránh spam email OTP
        [HttpPost("send-otp")]
        [HttpPost("otp")]
        [EnableRateLimiting(RateLimitingExtensions.PolicyOtp)]
        public async Task<ActionResult<object>> SendOtp([FromBody] SendOtpRequest request)
        {
            var result = await _authService.SendOtpAsync(request.Email);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { success = false, message = result.Message });
            }

            return Ok(new { success = true, message = result.Message });
        }

        // Rate limit 10 lần / 1 phút / IP: Chống bot đăng ký hàng loạt
        [HttpPost("register")]
        [EnableRateLimiting(RateLimitingExtensions.PolicyAuth)]
        public async Task<ActionResult<object>> Register([FromBody] RegisterRequest request)
        {
            var result = await _authService.RegisterAsync(request);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { success = false, message = result.Message });
            }

            return Ok(new
            {
                success = true,
                message = result.Message,
                data = result.Data
            });
        }

        // Rate limit 10 lần / 1 phút / IP: Chống Brute-force dò mật khẩu
        [HttpPost("login")]
        [EnableRateLimiting(RateLimitingExtensions.PolicyAuth)]
        public async Task<ActionResult<object>> Login([FromBody] LoginRequest request)
        {
            var email = !string.IsNullOrWhiteSpace(request.Email) ? request.Email : request.Username;
            var result = await _authService.LoginAsync(email, request.Password);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new { success = false, message = result.Message });
            }

            return Ok(new
            {
                success = true,
                message = result.Message,
                data = result.Data
            });
        }

        [HttpPost("refresh-token")]
        public async Task<ActionResult<object>> RefreshToken([FromBody] THEBOB.DTOs.Auth.RefreshTokenRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
                return BadRequest(new { success = false, message = "Refresh token là bắt buộc" });

            var result = await _authService.RefreshTokenAsync(request.Token, request.RefreshToken);
            if (result == null)
                return Unauthorized(new { success = false, message = "Refresh token không hợp lệ hoặc đã hết hạn" });

            return Ok(new { success = true, data = result });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<ActionResult<object>> Logout([FromBody] THEBOB.DTOs.Auth.RefreshTokenRequestDto request)
        {
            if (!string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                await _authService.RevokeRefreshTokenAsync(request.RefreshToken);
            }
            return Ok(new { success = true, message = "Đã đăng xuất thành công và vô hiệu hóa token." });
        }

        [Authorize]
        [HttpGet("profile")]
        public async Task<ActionResult<object>> GetProfile()
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { success = false, message = "Invalid token" });

            var result = await _authService.GetProfileAsync(userId.Value);
            if (!result.Success)
            {
                if (result.StatusCode == 404)
                    return NotFound(new { success = false, message = result.Message });

                return StatusCode(result.StatusCode, new { success = false, message = result.Message });
            }

            return Ok(new
            {
                success = true,
                data = result.Data
            });
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<ActionResult<object>> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized(new { success = false, message = "Invalid token" });

            var result = await _authService.UpdateProfileAsync(userId.Value, request);
            if (!result.Success)
            {
                if (result.StatusCode == 404)
                    return NotFound(new { success = false, message = result.Message });

                return StatusCode(result.StatusCode, new { success = false, message = result.Message });
            }

            return Ok(new
            {
                success = true,
                message = result.Message,
                data = result.Data
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
        public string? SpecificAddress { get; set; }
        public string? ProvinceCity { get; set; }
        public string? District { get; set; }
        public string? Ward { get; set; }
        public int? GhnProvinceId { get; set; }
        public int? GhnDistrictId { get; set; }
        public string? GhnWardCode { get; set; }
    }
}
