using System;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace THEBOB.Infrastructure.RateLimiting
{
    public static class RateLimitingExtensions
    {
        public const string PolicyOtp = "otp-policy";
        public const string PolicyAuth = "auth-policy";
        public const string PolicyOrderPayment = "order-payment-policy";
        public const string PolicyGeneral = "api-general";

        public static IServiceCollection AddAppRateLimiting(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

                // TẦNG 1: Global Concurrency Limiter (Chống sập server Kestrel & MySQL khi bị traffic dồn dập)
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                {
                    return RateLimitPartition.GetConcurrencyLimiter(
                        partitionKey: "global_concurrency_root",
                        factory: _ => new ConcurrencyLimiterOptions
                        {
                            PermitLimit = 200, // Tối đa 200 request đồng thời trên toàn hệ thống
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 100   // Tối đa 100 request xếp hàng đợi
                        });
                });

                // TẦNG 2 & 3: Các Named Policy phân vùng theo IP / User
                
                // 1. Policy OTP: Tối đa 3 requests / 2 phút / IP (chống spam email SendGrid)
                options.AddPolicy(PolicyOtp, httpContext =>
                {
                    var clientIp = GetClientIp(httpContext);
                    return RateLimitPartition.GetSlidingWindowLimiter(
                        partitionKey: $"otp_{clientIp}",
                        factory: _ => new SlidingWindowRateLimiterOptions
                        {
                            PermitLimit = 3,
                            Window = TimeSpan.FromMinutes(2),
                            SegmentsPerWindow = 4,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });

                // 2. Policy Auth (Login, Register): Tối đa 10 requests / 1 phút / IP (chống Brute-force mật khẩu)
                options.AddPolicy(PolicyAuth, httpContext =>
                {
                    var clientIp = GetClientIp(httpContext);
                    return RateLimitPartition.GetSlidingWindowLimiter(
                        partitionKey: $"auth_{clientIp}",
                        factory: _ => new SlidingWindowRateLimiterOptions
                        {
                            PermitLimit = 10,
                            Window = TimeSpan.FromMinutes(1),
                            SegmentsPerWindow = 2,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });

                // 3. Policy Đặt hàng & Thanh toán: Tối đa 10 requests / 1 phút / User (hoặc IP nếu chưa login)
                options.AddPolicy(PolicyOrderPayment, httpContext =>
                {
                    var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    var partitionKey = !string.IsNullOrWhiteSpace(userId)
                        ? $"order_user_{userId}"
                        : $"order_ip_{GetClientIp(httpContext)}";

                    return RateLimitPartition.GetSlidingWindowLimiter(
                        partitionKey: partitionKey,
                        factory: _ => new SlidingWindowRateLimiterOptions
                        {
                            PermitLimit = 10,
                            Window = TimeSpan.FromMinutes(1),
                            SegmentsPerWindow = 2,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });

                // 4. Policy API thông thường (xem sản phẩm, danh mục, blog): Tối đa 120 requests / 1 phút / IP
                options.AddPolicy(PolicyGeneral, httpContext =>
                {
                    var clientIp = GetClientIp(httpContext);
                    return RateLimitPartition.GetSlidingWindowLimiter(
                        partitionKey: $"gen_{clientIp}",
                        factory: _ => new SlidingWindowRateLimiterOptions
                        {
                            PermitLimit = 120,
                            Window = TimeSpan.FromMinutes(1),
                            SegmentsPerWindow = 3,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });

                // Xử lý phản hồi khi bị chặn bởi Rate Limiter
                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.HttpContext.Response.ContentType = "application/json";

                    int retryAfterSeconds = 60;
                    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    {
                        retryAfterSeconds = Math.Max(1, (int)retryAfter.TotalSeconds);
                    }
                    context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString();

                    var errorResponse = new
                    {
                        success = false,
                        message = $"Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau {retryAfterSeconds} giây.",
                        retryAfterSeconds = retryAfterSeconds
                    };

                    var json = JsonSerializer.Serialize(errorResponse, new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    });

                    await context.HttpContext.Response.WriteAsync(json, cancellationToken);
                };
            });

            return services;
        }

        public static string GetClientIp(HttpContext context)
        {
            // Ưu tiên Header Cloudflare nếu có
            if (context.Request.Headers.TryGetValue("CF-Connecting-IP", out var cfIp) && !string.IsNullOrWhiteSpace(cfIp))
            {
                return cfIp.ToString().Trim();
            }

            // Hỗ trợ Header X-Forwarded-For chuẩn qua Reverse Proxy / Load Balancer
            if (context.Request.Headers.TryGetValue("X-Forwarded-For", out var xff) && !string.IsNullOrWhiteSpace(xff))
            {
                var raw = xff.ToString().Split(',')[0].Trim();
                if (!string.IsNullOrWhiteSpace(raw)) return raw;
            }

            // Fallback về địa chỉ kết nối trực tiếp
            return context.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        }
    }
}
