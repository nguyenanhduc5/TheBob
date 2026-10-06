namespace THEBOB.Services
{
    public interface IUserService
    {
        Task<List<object>> GetUsersAsync();
        Task<(bool Success, string? ErrorMessage, object? UserData)> GetUserByEmailAsync(string email);
        Task<(bool Success, string Message, int StatusCode)> UpdateUserRoleAsync(int targetUserId, string newRole, int? currentUserId);
        Task<(bool Success, string Message, int StatusCode)> SetUserActiveAsync(int targetUserId, bool isActive, int? currentUserId);
    }
}
