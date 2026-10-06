using System.Threading.Tasks;

namespace THEBOB.Services.Chat
{
    public interface IPresenceService
    {
        Task SetAdminOnlineAsync(int adminId, string connectionId);
        Task SetAdminOfflineAsync(string connectionId);
        Task<bool> IsAnyAdminOnlineAsync();
    }
}
