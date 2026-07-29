using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
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
    }

    public class AuthService : IAuthService
    {
        private readonly IConfiguration _configuration;
        private readonly ThebobDbContext _db;

        public AuthService(IConfiguration configuration, ThebobDbContext db)
        {
            _configuration = configuration;
            _db = db;
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
            var jwtKey = _configuration["Jwt:Key"] ?? "THEBOB_JWT_SECRET_KEY_2026_SUPER_SECRET";
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
                expires: DateTime.UtcNow.AddMinutes(30), // Short-lived 30 mins JWT + Refresh Token
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
                ExpiredAt = DateTime.UtcNow.AddDays(7) // 7 days Refresh Token
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

            // Revoke old refresh token (Token Rotation for Security)
            storedToken.IsRevoked = true;
            _db.RefreshTokens.Update(storedToken);

            // Generate new Jwt + Refresh Token pair
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
    }
}
