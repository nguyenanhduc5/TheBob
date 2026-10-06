using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Services
{
    public class UserService : IUserService
    {
        private readonly ThebobDbContext _context;

        public UserService(ThebobDbContext context)
        {
            _context = context;
        }

        public async Task<List<object>> GetUsersAsync()
        {
            var users = await _context.Users
                .Include(u => u.RoleEntity)
                .Select(u => (object)new {
                    u.Id,
                    u.Username,
                    u.Email,
                    u.Name,
                    u.Phone,
                    u.Address,
                    Role = u.RoleEntity != null ? u.RoleEntity.RoleName : "User",
                    u.CreatedAt,
                    u.IsActive
                })
                .ToListAsync();

            return users;
        }

        public async Task<(bool Success, string? ErrorMessage, object? UserData)> GetUserByEmailAsync(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return (false, "Email không được để trống", null);

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email.Trim().ToLower());

            if (user == null)
                return (false, $"Không tìm thấy người dùng với email: {email}", null);

            var userData = new
            {
                success = true,
                id = user.Id,
                email = user.Email,
                name = user.FullName ?? user.Email,
                username = user.Username,
                data = new
                {
                    id = user.Id,
                    email = user.Email
                }
            };

            return (true, null, userData);
        }

        public async Task<(bool Success, string Message, int StatusCode)> UpdateUserRoleAsync(int targetUserId, string newRole, int? currentUserId)
        {
            if (string.IsNullOrWhiteSpace(newRole))
                return (false, "Invalid role", 400);

            var user = await _context.Users.FindAsync(targetUserId);
            if (user == null) return (false, "User not found", 404);

            if (currentUserId == targetUserId)
            {
                return (false, "You cannot change your own role", 400);
            }

            var requestedRole = newRole.Trim();
            if (!Enum.TryParse<UserRole>(requestedRole, true, out var parsedRole))
                return (false, "Unknown role", 400);
            requestedRole = parsedRole.ToString();

            var roleEntity = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == requestedRole);
            if (roleEntity == null)
            {
                roleEntity = new Role { RoleName = requestedRole };
                _context.Roles.Add(roleEntity);
                await _context.SaveChangesAsync();
            }

            user.RoleId = roleEntity.Id;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return (true, "User role updated", 200);
        }

        public async Task<(bool Success, string Message, int StatusCode)> SetUserActiveAsync(int targetUserId, bool isActive, int? currentUserId)
        {
            var user = await _context.Users.FindAsync(targetUserId);
            if (user == null) return (false, "User not found", 404);

            if (currentUserId == targetUserId && isActive == false)
            {
                return (false, "You cannot deactivate your own account", 400);
            }

            user.IsActive = isActive;
            await _context.SaveChangesAsync();

            return (true, "User status updated", 200);
        }
    }
}
