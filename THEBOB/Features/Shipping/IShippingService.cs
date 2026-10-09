using THEBOB.Models;

namespace THEBOB.Services
{
    public interface IShippingService
    {
        Task<object> GetProvincesAsync();
        Task<object> GetDistrictsAsync(int provinceId);
        Task<object> GetWardsAsync(int districtId);
        Task<GhnFeeResponse> CalculateFeeAsync(GhnFeeRequest request);
        Task<GhnTrackingResponse> GetTrackingAsync(string ghnOrderCode);

        Task<(bool Success, string Message, int StatusCode, object? Data)> CreateShipmentAsync(int orderId, GhnCreateOrderRequest? request);
        Task<(bool Success, string Message, int StatusCode, object? Data)> SetGhnCodeManuallyAsync(int orderId, string ghnOrderCode);
        Task<(bool Success, string Message, int StatusCode, object? Data)> RefreshOrderTrackingAsync(int orderId);
        Task<(bool Success, string Message, int StatusCode)> CancelShipmentAsync(int orderId, string ghnOrderCode);
        Task<bool> HandleGhnWebhookAsync(GhnWebhookPayload payload);
    }
}
