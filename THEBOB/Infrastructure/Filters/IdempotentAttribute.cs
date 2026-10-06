using System;
using System.IO;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Infrastructure.Filters
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false, Inherited = true)]
    public class IdempotentAttribute : Attribute, IAsyncActionFilter
    {
        public bool IsRequired { get; set; } = false;
        public int ExpiryMinutes { get; set; } = 1440; // 24 hours

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
            ReferenceHandler = ReferenceHandler.IgnoreCycles
        };

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var httpContext = context.HttpContext;
            var request = httpContext.Request;

            // 1. Check for Idempotency-Key header
            string? idempotencyKey = null;
            if (request.Headers.TryGetValue("Idempotency-Key", out var keyVal) && !string.IsNullOrWhiteSpace(keyVal))
            {
                idempotencyKey = keyVal.ToString().Trim();
            }
            else if (request.Headers.TryGetValue("X-Idempotency-Key", out var altKeyVal) && !string.IsNullOrWhiteSpace(altKeyVal))
            {
                idempotencyKey = altKeyVal.ToString().Trim();
            }

            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                if (IsRequired)
                {
                    context.Result = new BadRequestObjectResult(ApiResponse<object>.Fail("Missing Idempotency-Key header."));
                    return;
                }
                await next();
                return;
            }

            if (idempotencyKey.Length > 100)
            {
                context.Result = new BadRequestObjectResult(ApiResponse<object>.Fail("Idempotency-Key must not exceed 100 characters."));
                return;
            }

            // 2. Identify user
            var userIdClaim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? userId = int.TryParse(userIdClaim, out var parsedId) ? parsedId : null;

            // 3. Compute request hash if body is available
            string? requestHash = null;
            try
            {
                request.EnableBuffering();
                if (request.Body.CanSeek)
                {
                    request.Body.Position = 0;
                    using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
                    var bodyText = await reader.ReadToEndAsync();
                    request.Body.Position = 0;
                    if (!string.IsNullOrEmpty(bodyText))
                    {
                        using var sha256 = SHA256.Create();
                        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(bodyText));
                        requestHash = Convert.ToHexString(hashBytes);
                    }
                }
            }
            catch
            {
                // Fallback if body cannot be read
            }

            var scopeFactory = httpContext.RequestServices.GetRequiredService<IServiceScopeFactory>();
            var logger = httpContext.RequestServices.GetService<ILogger<IdempotentAttribute>>();
            var now = DateTime.UtcNow;

            // 4. Check existing idempotency record using an isolated scope
            IdempotentRequest? record = null;
            using (var scope = scopeFactory.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
                var existing = await db.IdempotentRequests
                    .FirstOrDefaultAsync(r => r.Key == idempotencyKey && r.UserId == userId);

                if (existing != null)
                {
                    // Check if record expired
                    if (existing.ExpiresAt <= now)
                    {
                        db.IdempotentRequests.Remove(existing);
                        await db.SaveChangesAsync();
                        existing = null;
                    }
                    else if (existing.Status == "Completed")
                    {
                        logger?.LogInformation("Idempotent replay served for key {Key}, User {UserId}", idempotencyKey, userId);
                        httpContext.Response.Headers["Idempotent-Replay"] = "true";
                        context.Result = new ContentResult
                        {
                            StatusCode = existing.StatusCode ?? 200,
                            ContentType = "application/json",
                            Content = existing.ResponseBody ?? "{}"
                        };
                        return;
                    }
                    else if (existing.Status == "InFlight")
                    {
                        // If in-flight for less than 2 minutes, treat as concurrent request
                        if (existing.CreatedAt >= now.AddMinutes(-2))
                        {
                            logger?.LogWarning("Concurrent request detected for in-flight key {Key}, User {UserId}", idempotencyKey, userId);
                            context.Result = new ConflictObjectResult(ApiResponse<object>.Fail("Yêu cầu đang được xử lý, vui lòng chờ trong giây lát."));
                            return;
                        }

                        // Stuck in-flight for > 2 min: allow takeover
                        existing.Status = "InFlight";
                        existing.CreatedAt = now;
                        existing.UpdatedAt = now;
                        existing.RequestHash = requestHash;
                        await db.SaveChangesAsync();
                        record = existing;
                    }
                    else // Status == "Failed"
                    {
                        // Allow retry on failed requests
                        existing.Status = "InFlight";
                        existing.CreatedAt = now;
                        existing.UpdatedAt = now;
                        existing.RequestHash = requestHash;
                        await db.SaveChangesAsync();
                        record = existing;
                    }
                }

                if (record == null && existing == null)
                {
                    record = new IdempotentRequest
                    {
                        Key = idempotencyKey,
                        UserId = userId,
                        Path = request.Path.Value ?? string.Empty,
                        Method = request.Method,
                        RequestHash = requestHash,
                        Status = "InFlight",
                        CreatedAt = now,
                        UpdatedAt = now,
                        ExpiresAt = now.AddMinutes(ExpiryMinutes)
                    };

                    db.IdempotentRequests.Add(record);
                    try
                    {
                        await db.SaveChangesAsync();
                    }
                    catch (DbUpdateException ex)
                    {
                        logger?.LogWarning(ex, "DbUpdateException when creating IdempotentRequest key {Key}", idempotencyKey);
                        context.Result = new ConflictObjectResult(ApiResponse<object>.Fail("Yêu cầu đang được xử lý đồng thời, vui lòng không thao tác lại."));
                        return;
                    }
                }
            }

            // 5. Execute action
            ActionExecutedContext executedContext;
            try
            {
                executedContext = await next();
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Action execution threw an exception for idempotency key {Key}", idempotencyKey);
                // Record failure so user can retry later
                await UpdateRecordStatusAsync(scopeFactory, idempotencyKey, userId, "Failed", 500, null, logger);
                throw;
            }

            // 6. Inspect result and save response cache
            if (executedContext.Exception != null && !executedContext.ExceptionHandled)
            {
                await UpdateRecordStatusAsync(scopeFactory, idempotencyKey, userId, "Failed", 500, null, logger);
                return;
            }

            int? statusCode = null;
            string? responseBody = null;

            if (executedContext.Result is ObjectResult objectResult)
            {
                statusCode = objectResult.StatusCode ?? 200;
                if (statusCode >= 200 && statusCode < 300)
                {
                    try
                    {
                        responseBody = JsonSerializer.Serialize(objectResult.Value, JsonOptions);
                    }
                    catch (Exception ex)
                    {
                        logger?.LogWarning(ex, "Could not serialize response body for idempotency caching");
                    }
                }
            }
            else if (executedContext.Result is StatusCodeResult statusResult)
            {
                statusCode = statusResult.StatusCode;
            }

            var isSuccess = statusCode.HasValue && statusCode.Value >= 200 && statusCode.Value < 300;
            var finalStatus = isSuccess ? "Completed" : "Failed";

            await UpdateRecordStatusAsync(scopeFactory, idempotencyKey, userId, finalStatus, statusCode, responseBody, logger);
        }

        private static async Task UpdateRecordStatusAsync(
            IServiceScopeFactory scopeFactory,
            string key,
            int? userId,
            string status,
            int? statusCode,
            string? responseBody,
            ILogger? logger)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
                var record = await db.IdempotentRequests
                    .FirstOrDefaultAsync(r => r.Key == key && r.UserId == userId);

                if (record != null)
                {
                    record.Status = status;
                    record.StatusCode = statusCode;
                    if (responseBody != null)
                    {
                        record.ResponseBody = responseBody;
                    }
                    record.UpdatedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Failed to update IdempotentRequest for key {Key}", key);
            }
        }
    }
}
