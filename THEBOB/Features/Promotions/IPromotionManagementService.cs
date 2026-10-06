using THEBOB.DTOs.Promotion;
using THEBOB.Models;
using THEBOB.Models.Promotion;

namespace THEBOB.Services.Promotion
{
    public interface IPromotionManagementService
    {
        Task<object> GetAllAsync(PromotionStatus? status, PromotionType? type, int page, int pageSize);
        Task<(bool Success, string Message, int StatusCode, PromotionDto? Data)> GetByIdAsync(int id);
        Task<(bool Success, string Message, int StatusCode, PromotionDto? Data)> CreateAsync(CreatePromotionRequest req, string createdBy);
        Task<(bool Success, string Message, int StatusCode, PromotionDto? Data)> UpdateAsync(int id, CreatePromotionRequest req);
        Task<(bool Success, string Message, int StatusCode, object? Data)> UpdateStatusAsync(int id, PromotionStatus status);
        Task<(bool Success, string Message, int StatusCode, object? Data)> CloneAsync(int id, string createdBy);
        Task<(bool Success, string Message, int StatusCode, bool NoContent)> DeleteAsync(int id);

        Task<(bool Success, string Message, int StatusCode, PromotionStatsDto? Data)> GetStatsAsync(int id);
        Task<PromotionStatsSummaryDto> GetStatsSummaryAsync();
        Task<object> GetUsagesAsync(int id, int page, int pageSize);

        Task<(bool Success, string Message, int StatusCode, object? Data)> SendUserCouponAsync(SendUserCouponRequest req);
        Task<(bool Success, string Message, int StatusCode, object? Data)> SendBulkCouponAsync(SendBulkCouponRequest req);

        Task<ValidateCouponResponse> ValidateCouponAsync(int userId, string couponCode);
        Task<object> CalculatePromotionsAsync(int userId, CalculatePromotionsRequest req);
        Task<List<UserCouponDto>> GetMyVouchersAsync(int userId);
        Task<List<AvailablePromotionDto>> GetApplicableAsync(int userId);
        Task<(bool Success, string Message, int StatusCode, object? Data)> GetEligibleProductsAsync(int id);

        Task<List<CustomerGroup>> GetCustomerGroupsAsync();
        Task<CustomerGroup> CreateCustomerGroupAsync(CustomerGroup group);
    }
}
