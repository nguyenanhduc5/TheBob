using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using THEBOB.Data;
using THEBOB.Models.LiveChat;

namespace THEBOB.Services.Chat
{
    public class PresenceService : IPresenceService
    {
        private readonly ThebobDbContext _context;
        private readonly IMemoryCache _cache;

        // In-Memory store cho kết nối SignalR realtime (tốc độ nanosecond, không làm tải đĩa RDBMS MySQL)
        private static readonly ConcurrentDictionary<string, int> OnlineAdminConnections = new();
        private const string AdminOnlineCountCacheKey = "presence:admin:online_count";

        public PresenceService(ThebobDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        public async Task SetAdminOnlineAsync(int adminId, string connectionId)
        {
            // 1. Cập nhật In-Memory Cache tức thì cho SignalR Connection
            OnlineAdminConnections[connectionId] = adminId;
            _cache.Remove(AdminOnlineCountCacheKey);

            // 2. Đồng bộ đệm xuống DB để audit lịch sử LastSeen
            var presence = await _context.AdminPresences
                .FirstOrDefaultAsync(p => p.AdminId == adminId);

            if (presence == null)
            {
                presence = new AdminPresence
                {
                    AdminId = adminId,
                    ConnectionId = connectionId,
                    IsOnline = true,
                    LastSeen = DateTime.UtcNow
                };
                _context.AdminPresences.Add(presence);
            }
            else
            {
                presence.ConnectionId = connectionId;
                presence.IsOnline = true;
                presence.LastSeen = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        public async Task SetAdminOfflineAsync(string connectionId)
        {
            // 1. Xóa khỏi In-Memory Cache lập tức
            OnlineAdminConnections.TryRemove(connectionId, out _);
            _cache.Remove(AdminOnlineCountCacheKey);

            // 2. Cập nhật trạng thái trong DB
            var presences = await _context.AdminPresences
                .Where(p => p.ConnectionId == connectionId && p.IsOnline)
                .ToListAsync();

            foreach (var presence in presences)
            {
                presence.IsOnline = false;
                presence.ConnectionId = null;
                presence.LastSeen = DateTime.UtcNow;
            }

            if (presences.Any())
            {
                await _context.SaveChangesAsync();
            }
        }

        public async Task<bool> IsAnyAdminOnlineAsync()
        {
            // Kiểm tra In-Memory Cache trước — cực nhanh, không truy vấn đĩa đè nén MySQL DB
            if (!OnlineAdminConnections.IsEmpty)
            {
                return true;
            }

            return await _cache.GetOrCreateAsync(AdminOnlineCountCacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(3);
                return await _context.AdminPresences.AnyAsync(p => p.IsOnline);
            });
        }
    }
}
