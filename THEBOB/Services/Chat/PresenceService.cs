using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models.LiveChat;

namespace THEBOB.Services.Chat
{
    public class PresenceService : IPresenceService
    {
        private readonly ThebobDbContext _context;

        public PresenceService(ThebobDbContext context)
        {
            _context = context;
        }

        public async Task SetAdminOnlineAsync(int adminId, string connectionId)
        {
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
            // Optional: Consider a timeout threshold for LastSeen to handle disconnected clients missing OnDisconnected
            return await _context.AdminPresences.AnyAsync(p => p.IsOnline);
        }
    }
}
