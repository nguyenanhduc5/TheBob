using THEBOB.Controllers;
using THEBOB.Models;

namespace THEBOB.Services
{
    public interface IOrderService
    {
        Task<List<object>> GetUserOrdersAsync(int userId);
        Task<(bool Success, string Message, int StatusCode, object? Data)> GetOrderByIdAsync(int orderId, int userId, bool isAdmin);
        Task<(bool Success, string Message, int StatusCode, object? Data)> GetOrderStatusAsync(int orderId, int userId, bool isAdmin);
        Task<(bool Success, string Message, int StatusCode, object? Data)> CreateOrderAsync(int userId, CreateOrderRequest request);
        Task<List<object>> GetAllOrdersAsync();
        Task<object> GetAdminOrdersPaginatedAsync(string? search, string? status, int page, int pageSize);
        Task<(bool Success, string Message, int StatusCode, object? Data)> UpdateOrderStatusAsync(int orderId, OrderStatus newStatus, int? currentUserId);
        Task<(bool Success, string Message, int StatusCode, object? Data)> CancelOrderAsync(int orderId, int userId);
        Task<(bool Success, string Message, int StatusCode, object? Data)> ConfirmOrderManualAsync(int orderId, int? currentUserId);
        Task<(bool Success, string Message, int StatusCode, object? Data)> CancelOrderManualAsync(int orderId, int? currentUserId);
        Task AutoCancelExpiredOrdersAsync();
    }
}
