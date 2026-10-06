using System.Net;
using System.Text.Json;
using THEBOB.Exceptions;
using THEBOB.Models;

namespace THEBOB.Middlewares
{
    /// <summary>
    /// Middleware x? lý ngo?i l? toàn c?c (Global Exception Handler).
    /// Ðón b?t t?t c? các ngo?i l? chua du?c x? lý trên toàn b? HTTP request pipeline,
    /// t? d?ng phân lo?i mã HTTP (400, 401, 403, 404, 409, 500)
    /// và chu?n hóa d? li?u tr? v? theo d?nh d?ng nh?t quán ApiResponse<T>.
    /// </summary>
    public class ExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionHandlingMiddleware> _logger;
        private readonly IHostEnvironment _env;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        public ExceptionHandlingMiddleware(
            RequestDelegate next,
            ILogger<ExceptionHandlingMiddleware> logger,
            IHostEnvironment env)
        {
            _next = next;
            _logger = logger;
            _env = env;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            if (context.Response.HasStarted)
            {
                _logger.LogWarning("Không th? g?i ph?n h?i l?i vì response stream dã b?t d?u g?i d? li?u cho client.");
                return;
            }

            var statusCode = StatusCodes.Status500InternalServerError;
            string message;
            object? errors = null;

            switch (exception)
            {
                case AppException appEx:
                    statusCode = appEx.StatusCode;
                    message = appEx.Message;
                    errors = appEx.Errors;
                    _logger.LogWarning("Nghi?p v? tr? v? l?i [{StatusCode}]: {Message}", statusCode, message);
                    break;

                case KeyNotFoundException knfEx:
                    statusCode = StatusCodes.Status404NotFound;
                    message = knfEx.Message;
                    _logger.LogWarning("Không tìm th?y tài nguyên: {Message}", message);
                    break;

                case UnauthorizedAccessException unauthEx:
                    statusCode = StatusCodes.Status401Unauthorized;
                    message = string.IsNullOrWhiteSpace(unauthEx.Message)
                        ? "B?n không có quy?n truy c?p vào tài nguyên này."
                        : unauthEx.Message;
                    _logger.LogWarning("Truy c?p chua xác th?c: {Message}", message);
                    break;

                case ArgumentException argEx:
                    statusCode = StatusCodes.Status400BadRequest;
                    message = argEx.Message;
                    _logger.LogWarning("Tham s? không h?p l?: {Message}", message);
                    break;

                case InvalidOperationException invEx:
                    statusCode = StatusCodes.Status400BadRequest;
                    message = invEx.Message;
                    _logger.LogWarning("Thao tác không h?p l?: {Message}", message);
                    break;

                case BadHttpRequestException badHttpEx:
                    statusCode = StatusCodes.Status400BadRequest;
                    message = badHttpEx.Message;
                    _logger.LogWarning("HTTP Request không h?p l?: {Message}", message);
                    break;

                default:
                    statusCode = StatusCodes.Status500InternalServerError;
                    _logger.LogError(exception, "L?i h? th?ng chua x? lý (Unhandled Exception) t?i {Method} {Path}",
                        context.Request.Method, context.Request.Path);

                    if (_env.IsDevelopment())
                    {
                        message = exception.Message;
                        errors = new
                        {
                            exceptionType = exception.GetType().FullName,
                            stackTrace = exception.StackTrace,
                            innerException = exception.InnerException?.Message
                        };
                    }
                    else
                    {
                        message = "Ðã x?y ra l?i h? th?ng n?i b?. Vui lòng th? l?i sau ho?c liên h? b? ph?n h? tr?.";
                    }
                    break;
            }

            context.Response.Clear();
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.StatusCode = statusCode;

            var responsePayload = ApiResponse<object>.Fail(message, errors);
            var json = JsonSerializer.Serialize(responsePayload, JsonOptions);

            await context.Response.WriteAsync(json);
        }
    }

    public static class ExceptionHandlingMiddlewareExtensions
    {
        /// <summary>
        /// Kích ho?t Global Exception Handling Middleware cho ?ng d?ng.
        /// </summary>
        public static IApplicationBuilder UseCustomExceptionHandling(this IApplicationBuilder app)
        {
            return app.UseMiddleware<ExceptionHandlingMiddleware>();
        }
    }
}
