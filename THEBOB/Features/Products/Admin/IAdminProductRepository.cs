using Microsoft.EntityFrameworkCore.Storage;
using THEBOB.Models;

namespace THEBOB.Repositories
{
    public interface IAdminProductRepository
    {
        IQueryable<Product> QueryProductsForAdmin();
        Task<Product?> GetProductForAdminAsync(int id, CancellationToken cancellationToken);
        Task<ProductVariant?> GetVariantForAdminAsync(int id, CancellationToken cancellationToken);
        Task<bool> VariantHasOrderItemsAsync(int variantId, CancellationToken cancellationToken);
        Task<Brand?> GetBrandByIdAsync(int id, CancellationToken cancellationToken);
        Task<Brand?> GetBrandByNameAsync(string name, CancellationToken cancellationToken);
        Task<Color?> GetColorByIdAsync(int id, CancellationToken cancellationToken);
        Task<Color?> GetColorByNameAsync(string name, CancellationToken cancellationToken);
        Task<Size?> GetSizeByIdAsync(int id, CancellationToken cancellationToken);
        Task<Size?> GetSizeByNameAsync(string name, CancellationToken cancellationToken);
        void AddProduct(Product product);
        void AddBrand(Brand brand);
        void AddColor(Color color);
        void AddSize(Size size);
        void AddInventoryLog(InventoryLog log);
        void AddAuditLog(AuditLog log);
        void RemoveProductImages(IEnumerable<ProductImage> images);
        void RemoveVariantImages(IEnumerable<ProductVariantImage> images);
        Task<int> SaveChangesAsync(CancellationToken cancellationToken);
        Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
    }
}
