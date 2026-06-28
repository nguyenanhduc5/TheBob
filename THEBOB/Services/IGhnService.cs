// Services/IGhnService.cs
using THEBOB.Models;

namespace THEBOB.Services;

public interface IGhnService
{
    Task<GhnFeeResponse> CalculateFeeAsync(GhnFeeRequest request);
    Task<GhnCreateOrderResponse> CreateShippingOrderAsync(GhnCreateOrderRequest request);
    Task<GhnTrackingResponse> GetTrackingAsync(string ghnOrderCode);
    Task CancelShippingOrderAsync(string ghnOrderCode);
    Task<List<GhnProvince>> GetProvincesAsync();
    Task<List<GhnDistrict>> GetDistrictsAsync(int provinceId);
    Task<List<GhnWard>> GetWardsAsync(int districtId);
}
