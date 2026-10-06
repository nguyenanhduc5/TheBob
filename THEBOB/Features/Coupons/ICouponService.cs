using System.Collections.Generic;
using System.Threading.Tasks;
using THEBOB.Models;

namespace THEBOB.Services
{
    public interface ICouponService
    {
        Task<List<object>> GetCouponsAsync();
        Task<List<object>> GetAutomaticCouponsAsync();
        Task<List<object>> GetMyVouchersAsync(int userId);
        Task<object> ApplyCouponAsync(int? userId, string code, decimal orderValue);
        Task<Coupon> GetByIdAsync(int id);
        Task<Coupon> CreateCouponAsync(Coupon coupon);
        Task<Coupon> UpdateCouponAsync(int id, Coupon coupon);
        Task DeleteCouponAsync(int id);
    }
}
