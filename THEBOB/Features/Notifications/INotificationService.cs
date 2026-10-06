using System.Collections.Generic;
using System.Threading.Tasks;

namespace THEBOB.Services
{
    public interface INotificationService
    {
        Task<List<object>> GetNotificationsAsync(int userId);
        Task<bool> MarkAsReadAsync(int id, int userId);
        Task<bool> MarkAllAsReadAsync(int userId);
    }
}
