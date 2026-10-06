using System;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using THEBOB.Controllers;
using THEBOB.Data;
using THEBOB.DTOs.Auth;
using THEBOB.Models;

namespace THEBOB.Services
{
    public interface IAuthService
    {
        string HashPassword(string password);
        bool VerifyPassword(string password, string hash);
        string GenerateJwtToken(User user, out string jti);
        Task<RefreshToken> GenerateRefreshTokenAsync(int userId, string jti);
        Task<TokenResponseDto?> RefreshTokenAsync(string token, string refreshTokenStr);
        Task<bool> RevokeRefreshTokenAsync(string refreshTokenStr);

        Task<(bool Success, string Message, int StatusCode)> SendOtpAsync(string email);
        Task<(bool Success, string Message, int StatusCode, object? Data)> RegisterAsync(RegisterRequest request);
        Task<(bool Success, string Message, int StatusCode, object? Data)> LoginAsync(string email, string password);
        Task<(bool Success, string Message, int StatusCode, object? Data)> GetProfileAsync(int userId);
        Task<(bool Success, string Message, int StatusCode, object? Data)> UpdateProfileAsync(int userId, UpdateProfileRequest request);
    }

    public class AuthService : IAuthService
    {
        private readonly IConfiguration _configuration;
        private readonly ThebobDbContext _db;
        private readonly IEmailService _emailService;

        public AuthService(IConfiguration configuration, ThebobDbContext db, IEmailService emailService)
        {
            _configuration = configuration;
            _db = db;
            _emailService = emailService;
        }

        public string HashPassword(string password)
        {
            const int iterations = 100_000;
            var salt = RandomNumberGenerator.GetBytes(16);
            var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, 32);
            return $"PBKDF2${iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(key)}";
        }

        public bool VerifyPassword(string password, string hash)
        {
            if (hash.StartsWith("PBKDF2$", StringComparison.Ordinal))
            {
                var parts = hash.Split('$');
                if (parts.Length != 4 || !int.TryParse(parts[1], out var iterations))
                {
                    return false;
                }

                var salt = Convert.FromBase64String(parts[2]);
                var expectedKey = Convert.FromBase64String(parts[3]);
                var actualKey = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expectedKey.Length);
                return CryptographicOperations.FixedTimeEquals(actualKey, expectedKey);
            }

            using var sha256 = SHA256.Create();
            var legacyHash = Convert.ToBase64String(sha256.ComputeHash(Encoding.UTF8.GetBytes(password)));
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(legacyHash),
                Encoding.UTF8.GetBytes(hash));
        }

        public string GenerateJwtToken(User user, out string jti)
        {
            jti = Guid.NewGuid().ToString();
            var jwtKey = _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException("Jwt:Key is missing from configuration.");
            var issuer = _configuration["Jwt:Issuer"] ?? "THEBOB";
            var audience = _configuration["Jwt:Audience"] ?? "THEBOB_API";
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
            var role = user.RoleEntity?.RoleName ?? user.Role.ToString();

            var claims = new[]
            {
                new Claim("sub", user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, jti),
                new Claim("username", user.Username),
                new Claim("email", user.Email),
                new Claim("role", role),
                new Claim(ClaimTypes.Role, role)
            };

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(30),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<RefreshToken> GenerateRefreshTokenAsync(int userId, string jti)
        {
            var randomNumber = new byte[64];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomNumber);
            var tokenStr = Convert.ToBase64String(randomNumber);

            var refreshToken = new RefreshToken
            {
                UserId = userId,
                JwtId = jti,
                Token = tokenStr,
                IsRevoked = false,
                CreatedAt = DateTime.UtcNow,
                ExpiredAt = DateTime.UtcNow.AddDays(7)
            };

            _db.RefreshTokens.Add(refreshToken);
            await _db.SaveChangesAsync();
            return refreshToken;
        }

        public async Task<TokenResponseDto?> RefreshTokenAsync(string token, string refreshTokenStr)
        {
            var storedToken = await _db.RefreshTokens
                .Include(r => r.User).ThenInclude(u => u!.RoleEntity)
                .FirstOrDefaultAsync(r => r.Token == refreshTokenStr);

            if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiredAt < DateTime.UtcNow)
            {
                return null;
            }

            var user = storedToken.User;
            if (user == null || !user.IsActive)
            {
                return null;
            }

            storedToken.IsRevoked = true;
            _db.RefreshTokens.Update(storedToken);

            var newJwt = GenerateJwtToken(user, out var newJti);
            var newRefreshToken = await GenerateRefreshTokenAsync(user.Id, newJti);

            return new TokenResponseDto
            {
                Success = true,
                Message = "Token refreshed successfully",
                Token = newJwt,
                RefreshToken = newRefreshToken.Token,
                JwtExpiresAt = DateTime.UtcNow.AddMinutes(30),
                User = new
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
            };
        }

        public async Task<bool> RevokeRefreshTokenAsync(string refreshTokenStr)
        {
            var storedToken = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.Token == refreshTokenStr);
            if (storedToken == null) return false;

            storedToken.IsRevoked = true;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<(bool Success, string Message, int StatusCode)> SendOtpAsync(string email)
        {
            var trimmedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();

            if (string.IsNullOrEmpty(trimmedEmail))
                return (false, "Email là bắt buộc", 400);

            if (!new EmailAddressAttribute().IsValid(trimmedEmail))
                return (false, "Định dạng email không hợp lệ", 400);

            var existingUser = await _db.Users.AnyAsync(u => u.Email.ToLower() == trimmedEmail);
            if (existingUser)
                return (false, "Email đã được sử dụng", 400);

            var otpCode = Random.Shared.Next(100000, 999999).ToString();

            var otpVerification = new OtpVerification
            {
                Email = trimmedEmail,
                OtpCode = otpCode,
                ExpiredAt = DateTime.UtcNow.AddMinutes(5),
                IsUsed = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.OtpVerifications.Add(otpVerification);
            await _db.SaveChangesAsync();

            var subject = "Mã OTP xác thực tài khoản THEBOB";
            var content = $@"
                <div style=''font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;''>
                    <h2 style=''color: #333; text-align: center;''>Xác thực đăng ký tài khoản THEBOB</h2>
                    <p>Xin chào,</p>
                    <p>Bạn đang đăng ký tài khoản tại <strong>THEBOB Store</strong>. Dưới đây là mã OTP xác thực của bạn:</p>
                    <div style=''text-align: center; margin: 30px 0;''>
                        <span style=''font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; background-color: #F3F4F6; padding: 10px 20px; border-radius: 5px;''>{otpCode}</span>
                    </div>
                    <p style=''color: #666;''>Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
                    <hr style=''border: none; border-top: 1px solid #eee; margin: 20px 0;'' />
                    <p style=''font-size: 12px; color: #999; text-align: center;''>Đây là email tự động, vui lòng không phản hồi email này.</p>
                </div>";

            var emailSent = await _emailService.SendEmailAsync(trimmedEmail, subject, content);
            if (!emailSent)
            {
                return (false, "Không thể gửi OTP đến email này. Vui lòng kiểm tra lại.", 400);
            }

            return (true, "Mã OTP đã được gửi đến email của bạn", 200);
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> RegisterAsync(RegisterRequest request)
        {
            var username = (request.Username ?? string.Empty).Trim();
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var name = (request.Name ?? string.Empty).Trim();
            var phone = (request.Phone ?? string.Empty).Trim();
            var address = request.Address?.Trim() ?? string.Empty;
            var otpCode = (request.OtpCode ?? string.Empty).Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(request.Password) || string.IsNullOrEmpty(phone))
                return (false, "Username, email, password và số điện thoại là bắt buộc", 400, null);

            if (string.IsNullOrEmpty(otpCode))
                return (false, "Mã xác thực OTP là bắt buộc", 400, null);

            if (username.Length < 3)
                return (false, "Tên đăng nhập phải có ít nhất 3 ký tự", 400, null);

            if (!new EmailAddressAttribute().IsValid(email))
                return (false, "Định dạng email không hợp lệ", 400, null);

            if (request.Password.Length < 6)
                return (false, "Password must be at least 6 characters", 400, null);

            if (string.IsNullOrWhiteSpace(name))
                return (false, "Họ tên là bắt buộc", 400, null);

            var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            if (existingUser != null)
                return (false, "Email đã được sử dụng", 400, null);

            var latestOtp = await _db.OtpVerifications
                .Where(o => o.Email.ToLower() == email && !o.IsUsed && o.ExpiredAt > DateTime.UtcNow)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();

            if (latestOtp == null || latestOtp.OtpCode != otpCode)
            {
                return (false, "Mã OTP không chính xác hoặc đã hết hạn", 400, null);
            }

            latestOtp.IsUsed = true;
            _db.OtpVerifications.Update(latestOtp);

            var userRole = await _db.Roles.FirstOrDefaultAsync(r => r.RoleName == "User");
            if (userRole == null)
            {
                userRole = new Role { RoleName = "User" };
                _db.Roles.Add(userRole);
                await _db.SaveChangesAsync();
            }

            var user = new User
            {
                Email = email,
                FullName = name,
                Phone = phone,
                Address = address,
                PasswordHash = HashPassword(request.Password),
                RoleId = userRole.Id,
                RoleEntity = userRole
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var token = GenerateJwtToken(user, out var jti);
            var refreshToken = await GenerateRefreshTokenAsync(user.Id, jti);

            var data = new
            {
                token,
                refreshToken = refreshToken.Token,
                id = user.Id,
                userId = user.Id,
                username = user.Username,
                email = user.Email,
                name = user.Name,
                phone = user.Phone,
                address = user.Address,
                role = user.RoleEntity?.RoleName ?? user.Role.ToString()
            };

            return (true, "Registration successful", 200, data);
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> LoginAsync(string email, string password)
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                return (false, "Email và mật khẩu là bắt buộc", 400, null);

            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _db.Users.Include(u => u.RoleEntity).FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

            if (user == null || !VerifyPassword(password, user.PasswordHash))
                return (false, "Email hoặc mật khẩu không hợp lệ", 401, null);

            if (!user.IsActive)
                return (false, "User account is inactive", 401, null);

            var token = GenerateJwtToken(user, out var jti);
            var refreshToken = await GenerateRefreshTokenAsync(user.Id, jti);

            var data = new
            {
                token,
                refreshToken = refreshToken.Token,
                id = user.Id,
                userId = user.Id,
                username = user.Username,
                email = user.Email,
                name = user.Name,
                phone = user.Phone,
                address = user.Address,
                role = user.RoleEntity?.RoleName ?? user.Role.ToString()
            };

            return (true, "Login successful", 200, data);
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> GetProfileAsync(int userId)
        {
            var user = await _db.Users
                .Include(u => u.RoleEntity)
                .Include(u => u.Addresses)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return (false, "User not found", 404, null);

            var defaultAddress = user.Addresses.FirstOrDefault(a => a.IsDefault)
                                  ?? user.Addresses.FirstOrDefault();

            var data = new
            {
                id              = user.Id,
                userId          = user.Id,
                username        = user.Username,
                email           = user.Email,
                name            = user.Name,
                phone           = user.Phone,
                specificAddress = defaultAddress?.SpecificAddress ?? string.Empty,
                provinceCity    = defaultAddress?.ProvinceCity ?? string.Empty,
                district        = defaultAddress?.District ?? string.Empty,
                ward            = defaultAddress?.Ward ?? string.Empty,
                ghnProvinceId   = defaultAddress?.GhnProvinceId,
                ghnDistrictId   = defaultAddress?.GhnDistrictId,
                ghnWardCode     = defaultAddress?.GhnWardCode,
                role            = user.RoleEntity?.RoleName ?? user.Role.ToString()
            };

            return (true, string.Empty, 200, data);
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> UpdateProfileAsync(int userId, UpdateProfileRequest request)
        {
            var user = await _db.Users
                .Include(u => u.RoleEntity)
                .Include(u => u.Addresses)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return (false, "User not found", 404, null);

            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
                return (false, "Tên và số điện thoại là bắt buộc", 400, null);

            user.Name = request.Name.Trim();
            user.Phone = request.Phone.Trim();

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var email = request.Email.Trim().ToLowerInvariant();
                var emailExists = await _db.Users.AnyAsync(u => u.Id != user.Id && u.Email.ToLower() == email);
                if (emailExists)
                    return (false, "Email da duoc su dung", 400, null);

                user.Email = email;
            }

            var defaultAddress = user.Addresses.FirstOrDefault(a => a.IsDefault)
                                  ?? user.Addresses.FirstOrDefault();

            if (defaultAddress == null)
            {
                defaultAddress = new Address { UserId = user.Id, IsDefault = true };
                _db.Addresses.Add(defaultAddress);
                user.Addresses.Add(defaultAddress);
            }

            defaultAddress.RecipientName   = user.Name;
            defaultAddress.RecipientPhone  = user.Phone;
            defaultAddress.SpecificAddress = request.SpecificAddress?.Trim() ?? string.Empty;
            defaultAddress.ProvinceCity    = request.ProvinceCity?.Trim() ?? string.Empty;
            defaultAddress.District        = request.District?.Trim() ?? string.Empty;
            defaultAddress.Ward            = request.Ward?.Trim() ?? string.Empty;
            defaultAddress.GhnProvinceId   = request.GhnProvinceId;
            defaultAddress.GhnDistrictId   = request.GhnDistrictId;
            defaultAddress.GhnWardCode     = request.GhnWardCode;
            defaultAddress.UpdatedAt       = DateTime.UtcNow;

            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var data = new
            {
                userId          = user.Id,
                username        = user.Username,
                email           = user.Email,
                name            = user.Name,
                phone           = user.Phone,
                specificAddress = defaultAddress.SpecificAddress,
                provinceCity    = defaultAddress.ProvinceCity,
                district        = defaultAddress.District,
                ward            = defaultAddress.Ward,
                ghnProvinceId   = defaultAddress.GhnProvinceId,
                ghnDistrictId   = defaultAddress.GhnDistrictId,
                ghnWardCode     = defaultAddress.GhnWardCode,
                role            = user.RoleEntity?.RoleName ?? user.Role.ToString()
            };

            return (true, "Thông tin tài khoản đã được cập nhật", 200, data);
        }
    }
}
