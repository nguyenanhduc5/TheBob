using System.Text.Json;
using Microsoft.AspNetCore.Http;
using THEBOB.Controllers;

namespace THEBOB.Services
{
    public interface IPaymentService
    {
        Task<(bool Success, string Message, int StatusCode, CreatePaymentResponse? Data)> CreatePaymentAsync(int orderId, int userId, decimal? customAmount = null);
        Task<(bool Success, string Message, int StatusCode, PaymentStatusResponse? Data)> GetPaymentStatusAsync(int orderId, int userId, bool isAdmin);
        Task<(bool Success, string Message, int StatusCode)> CancelPaymentAsync(int orderId, int userId);
        Task<(bool Success, string Message, int StatusCode, object? Data)> ProcessWebhookAsync(JsonElement payload, HttpRequest request);
        Task<PagedPaymentTransactionsResponse> GetTransactionsAsync(string? status, int page, int pageSize);
        Task<(bool Success, string Message, int StatusCode, object? Data)> ConfirmPaymentAsync(ConfirmPaymentRequest request);
    }
}
