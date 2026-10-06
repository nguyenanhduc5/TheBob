using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Repositories
{
    public class AdminProductRepository : IAdminProductRepository
    {
        private readonly ThebobDbContext _context;

        public AdminProductRepository(ThebobDbContext context)
        {
            _context = context;
        }

        public IQueryable<Product> QueryProductsForAdmin()
        {
            return _context.Products
                .IgnoreQueryFilters()
                .Include(p => p.Brand)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Size)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Color)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Images)
                .AsSplitQuery();
        }

        public Task<Product?> GetProductForAdminAsync(int id, CancellationToken cancellationToken)
        {
            return QueryProductsForAdmin().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        }

        public Task<ProductVariant?> GetVariantForAdminAsync(int id, CancellationToken cancellationToken)
        {
            return _context.ProductVariants
                .IgnoreQueryFilters()
                .Include(v => v.Product)
                .Include(v => v.Size)
                .Include(v => v.Color)
                .Include(v => v.Images)
                .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        }

        public Task<bool> VariantHasOrderItemsAsync(int variantId, CancellationToken cancellationToken)
        {
            return _context.OrderItems.AnyAsync(oi => oi.VariantId == variantId, cancellationToken);
        }

        public Task<Brand?> GetBrandByIdAsync(int id, CancellationToken cancellationToken)
        {
            return _context.Brands.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        }

        public Task<Brand?> GetBrandByNameAsync(string name, CancellationToken cancellationToken)
        {
            return _context.Brands.FirstOrDefaultAsync(b => b.Name == name, cancellationToken);
        }

        public Task<Color?> GetColorByIdAsync(int id, CancellationToken cancellationToken)
        {
            return _context.Colors.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        }

        public Task<Color?> GetColorByNameAsync(string name, CancellationToken cancellationToken)
        {
            return _context.Colors.FirstOrDefaultAsync(c => c.Name == name, cancellationToken);
        }

        public Task<Size?> GetSizeByIdAsync(int id, CancellationToken cancellationToken)
        {
            return _context.Sizes.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        }

        public Task<Size?> GetSizeByNameAsync(string name, CancellationToken cancellationToken)
        {
            return _context.Sizes.FirstOrDefaultAsync(s => s.Name == name, cancellationToken);
        }

        public void AddProduct(Product product)
        {
            _context.Products.Add(product);
        }

        public void AddBrand(Brand brand)
        {
            _context.Brands.Add(brand);
        }

        public void AddColor(Color color)
        {
            _context.Colors.Add(color);
        }

        public void AddSize(Size size)
        {
            _context.Sizes.Add(size);
        }

        public void AddInventoryLog(InventoryLog log)
        {
            _context.InventoryLogs.Add(log);
        }

        public void AddAuditLog(AuditLog log)
        {
            _context.AuditLogs.Add(log);
        }

        public void RemoveProductImages(IEnumerable<ProductImage> images)
        {
            _context.ProductImages.RemoveRange(images);
        }

        public void RemoveVariantImages(IEnumerable<ProductVariantImage> images)
        {
            _context.ProductVariantImages.RemoveRange(images);
        }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
        {
            return _context.SaveChangesAsync(cancellationToken);
        }

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken)
        {
            return _context.Database.BeginTransactionAsync(cancellationToken);
        }
    }
}
