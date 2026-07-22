using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.DTOs.Blog;
using THEBOB.Hubs;
using THEBOB.Models.Blog;

namespace THEBOB.Services.Blog
{
    /// <summary>
    /// Xử lý gửi thông báo blog:
    /// - Nếu số user nhận ≤ 500: xử lý đồng bộ trong request.
    /// - Nếu > 500: đẩy vào Channel để BlogNotificationBackgroundService xử lý bất đồng bộ.
    /// </summary>
    public class BlogNotificationService : IBlogNotificationService
    {
        private readonly ThebobDbContext _db;
        private readonly IHubContext<ChatHub> _chatHub;
        private readonly Channel<BlogNotificationJob> _channel;
        private readonly ILogger<BlogNotificationService> _logger;

        public BlogNotificationService(
            ThebobDbContext db,
            IHubContext<ChatHub> chatHub,
            Channel<BlogNotificationJob> channel,
            ILogger<BlogNotificationService> logger)
        {
            _db = db;
            _chatHub = chatHub;
            _channel = channel;
            _logger = logger;
        }

        public async Task<int> SendAsync(int adminId, SendBlogNotificationRequest request)
        {
            // 1. Tạo BlogNotification (nội dung gốc)
            var targetType = Enum.TryParse<BlogNotificationTargetType>(request.TargetType, out var t) ? t : BlogNotificationTargetType.All;
            var notification = new BlogNotification
            {
                BlogPostId = request.BlogPostId,
                Title = request.Title.Trim(),
                Body = request.Body?.Trim(),
                TargetType = targetType,
                SegmentConfig = request.SegmentConfig,
                CreatedByAdminId = adminId,
                CreatedAt = DateTime.UtcNow,
            };
            _db.BlogNotifications.Add(notification);
            await _db.SaveChangesAsync();

            // 2. Xác định danh sách userId
            var userIds = await ResolveUserIdsAsync(request, targetType);

            // 3. Phân nhánh theo số lượng
            if (userIds.Count > 500)
            {
                // Đẩy vào background queue
                await _channel.Writer.WriteAsync(new BlogNotificationJob
                {
                    NotificationId = notification.Id,
                    UserIds = userIds,
                });
                _logger.LogInformation("BlogNotification {Id}: {Count} users → background queue", notification.Id, userIds.Count);
            }
            else
            {
                // Xử lý đồng bộ
                await DispatchToUsersAsync(notification, userIds);
            }

            return notification.Id;
        }

        private async Task<List<int>> ResolveUserIdsAsync(SendBlogNotificationRequest request, BlogNotificationTargetType targetType)
        {
            return targetType switch
            {
                BlogNotificationTargetType.Manual =>
                    request.UserIds.Distinct().ToList(),

                BlogNotificationTargetType.Segment =>
                    await BuildSegmentAsync(request.SegmentConfig),

                _ => // All
                    await _db.Users
                        .Where(u => u.IsActive)
                        .Select(u => u.Id)
                        .ToListAsync(),
            };
        }

        private async Task<List<int>> BuildSegmentAsync(string? segmentJson)
        {
            // Segment đơn giản: lấy user có đơn hàng (minOrders)
            // Mở rộng thêm logic tier/khu vực ở đây nếu cần
            if (string.IsNullOrWhiteSpace(segmentJson)) return new List<int>();

            try
            {
                var cfg = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(segmentJson);
                int minOrders = cfg != null && cfg.TryGetValue("minOrders", out var v) && int.TryParse(v?.ToString(), out var n) ? n : 0;

                var q = _db.Users.Where(u => u.IsActive).AsQueryable();
                if (minOrders > 0)
                {
                    var activeUserIds = await _db.Orders
                        .GroupBy(o => o.UserId)
                        .Where(g => g.Count() >= minOrders)
                        .Select(g => g.Key)
                        .ToListAsync();
                    q = q.Where(u => activeUserIds.Contains(u.Id));
                }

                return await q.Select(u => u.Id).ToListAsync();
            }
            catch
            {
                return new List<int>();
            }
        }

        /// <summary>Fan-out: tạo UserBlogNotification + fire SignalR nếu user online.</summary>
        public async Task DispatchToUsersAsync(BlogNotification notification, List<int> userIds)
        {
            var now = DateTime.UtcNow;
            var records = userIds.Select(uid => new UserBlogNotification
            {
                BlogNotificationId = notification.Id,
                UserId = uid,
                IsRead = false,
                SentAt = now,
            }).ToList();

            // Bulk insert
            await _db.UserBlogNotifications.AddRangeAsync(records);
            await _db.SaveChangesAsync();

            // Bắn SignalR tới những user đang online
            var payload = new
            {
                id = notification.Id,
                blogNotificationId = notification.Id,
                title = notification.Title,
                body = notification.Body,
                blogPostId = notification.BlogPostId,
                sentAt = now,
            };

            foreach (var uid in userIds)
            {
                try
                {
                    await _chatHub.Clients
                        .Group($"user-{uid}")
                        .SendAsync("ReceiveBlogNotification", payload);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "SignalR send failed for user {UserId}", uid);
                }
            }
        }

        // ── User-facing reads ──────────────────────────────────────────────────

        public async Task<List<BlogNotificationDto>> GetForUserAsync(int userId, int page, int pageSize)
        {
            return await _db.UserBlogNotifications
                .Include(u => u.BlogNotification)
                    .ThenInclude(n => n.BlogPost)
                .Where(u => u.UserId == userId)
                .OrderByDescending(u => u.SentAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new BlogNotificationDto
                {
                    Id = u.Id,
                    BlogNotificationId = u.BlogNotificationId,
                    Title = u.BlogNotification.Title,
                    Body = u.BlogNotification.Body,
                    BlogPostId = u.BlogNotification.BlogPostId,
                    BlogPostSlug = u.BlogNotification.BlogPost != null ? u.BlogNotification.BlogPost.Slug : null,
                    BlogPostThumbnail = u.BlogNotification.BlogPost != null ? u.BlogNotification.BlogPost.Thumbnail : null,
                    IsRead = u.IsRead,
                    SentAt = u.SentAt,
                })
                .ToListAsync();
        }

        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _db.UserBlogNotifications
                .CountAsync(u => u.UserId == userId && !u.IsRead);
        }

        public async Task MarkAsReadAsync(int userBlogNotificationId, int userId)
        {
            var record = await _db.UserBlogNotifications
                .FirstOrDefaultAsync(u => u.Id == userBlogNotificationId && u.UserId == userId);
            if (record == null) return;
            record.IsRead = true;
            record.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        public async Task MarkAllAsReadAsync(int userId)
        {
            var records = await _db.UserBlogNotifications
                .Where(u => u.UserId == userId && !u.IsRead)
                .ToListAsync();
            foreach (var r in records)
            {
                r.IsRead = true;
                r.ReadAt = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();
        }
    }

    /// <summary>Message truyền vào background queue.</summary>
    public class BlogNotificationJob
    {
        public int NotificationId { get; set; }
        public List<int> UserIds { get; set; } = new();
    }
}
