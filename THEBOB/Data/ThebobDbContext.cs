using Microsoft.EntityFrameworkCore;
using THEBOB.Models;

namespace THEBOB.Data
{
    public class ThebobDbContext : DbContext
    {
        public ThebobDbContext(DbContextOptions<ThebobDbContext> options) : base(options)
        {
        }

        public DbSet<Product> Products { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<ProductImage> ProductImages { get; set; }
        public DbSet<ProductVariant> ProductVariants { get; set; }
        public DbSet<ProductReview> ProductReviews { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Address> Addresses { get; set; }
        public DbSet<Coupon> Coupons { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Cart> Carts { get; set; }
        public DbSet<CartItem> CartItems { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<InventoryLog> InventoryLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Category
            modelBuilder.Entity<Category>()
                .HasIndex(c => c.Slug)
                .IsUnique();

            // Configure Product
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            // Configure ProductVariant
            modelBuilder.Entity<ProductVariant>()
                .HasIndex(v => v.Sku)
                .IsUnique();

            modelBuilder.Entity<ProductVariant>()
                .HasIndex(v => new { v.ProductId, v.Size, v.Color })
                .IsUnique();

            // Configure ProductImage
            modelBuilder.Entity<ProductImage>()
                .HasIndex(pi => new { pi.ProductId, pi.SortOrder });

            // Configure Order
            modelBuilder.Entity<Order>()
                .HasIndex(o => o.OrderNumber)
                .IsUnique();

            // Configure Order-Coupon relationship
            modelBuilder.Entity<Order>()
                .HasOne(o => o.Coupon)
                .WithMany()
                .HasForeignKey(o => o.CouponId)
                .OnDelete(DeleteBehavior.SetNull);

            // Configure OrderItem snapshot price
            modelBuilder.Entity<OrderItem>()
                .Property(oi => oi.PricePerItem)
                .HasColumnType("decimal(12,2)");

            // Configure Coupon
            modelBuilder.Entity<Coupon>()
                .HasIndex(c => c.Code)
                .IsUnique();

            // Configure ProductReview
            modelBuilder.Entity<ProductReview>()
                .HasIndex(r => new { r.ProductId, r.UserId })
                .IsUnique();
        }
    }
}
