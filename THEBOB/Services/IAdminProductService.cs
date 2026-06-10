using THEBOB.DTOs.AdminProducts;

namespace THEBOB.Services
{
    public interface IAdminProductService
    {
        Task<ServiceResult<IReadOnlyList<AdminProductListItemDto>>> GetProductsAsync(CancellationToken cancellationToken);
        Task<ServiceResult<AdminProductDetailDto>> GetProductAsync(int id, CancellationToken cancellationToken);
        Task<ServiceResult<AdminProductDetailDto>> CreateProductAsync(AdminProductCreateRequest request, int? userId, CancellationToken cancellationToken);
        Task<ServiceResult<AdminProductDetailDto>> UpdateProductAsync(int id, AdminProductUpdateRequest request, int? userId, CancellationToken cancellationToken);
        Task<ServiceResult<bool>> DeleteProductAsync(int id, int? userId, CancellationToken cancellationToken);
        Task<ServiceResult<AdminProductDetailDto>> UpdateProductStatusAsync(int id, AdminProductStatusRequest request, int? userId, CancellationToken cancellationToken);
        Task<ServiceResult<AdminVariantDto>> UpdateVariantStockAsync(int id, AdminVariantStockRequest request, int? userId, CancellationToken cancellationToken);
        Task<ServiceResult<AdminVariantDto>> UpdateVariantPriceAsync(int id, AdminVariantPriceRequest request, int? userId, CancellationToken cancellationToken);
    }
}
