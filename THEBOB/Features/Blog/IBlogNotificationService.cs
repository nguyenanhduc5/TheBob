using THEBOB.DTOs.Blog;

namespace THEBOB.Services.Blog
{
    public interface IBlogNotificationService
    {
        Task<int> SendAsync(int adminId, SendBlogNotificationRequest request);
        Task<List<BlogNotificationDto>> GetForUserAsync(int userId, int page, int pageSize);
        Task<int> GetUnreadCountAsync(int userId);
        Task MarkAsReadAsync(int userBlogNotificationId, int userId);
        Task MarkAllAsReadAsync(int userId);
    }
}
