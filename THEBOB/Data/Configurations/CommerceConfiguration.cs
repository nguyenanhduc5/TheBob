using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using THEBOB.Models;

namespace THEBOB.Data.Configurations
{
    public class ProductReviewConfiguration : IEntityTypeConfiguration<ProductReview>
    {
        public void Configure(EntityTypeBuilder<ProductReview> builder)
        {
            builder.HasIndex(r => new { r.ProductId, r.UserId }).IsUnique();
            builder.ToTable(t => t.HasCheckConstraint("CK_ProductReviews_Rating_Range", "`Rating` >= 1 AND `Rating` <= 5"));

            builder.HasOne(r => r.Product)
                .WithMany()
                .HasForeignKey(r => r.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(r => r.OrderItem)
                .WithMany(oi => oi.ProductReviews)
                .HasForeignKey(r => r.OrderItemId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class CouponConfiguration : IEntityTypeConfiguration<Coupon>
    {
        public void Configure(EntityTypeBuilder<Coupon> builder)
        {
            builder.HasIndex(c => c.Code).IsUnique();
            builder.Property(c => c.DiscountValue).HasColumnType("decimal(12,2)");
            builder.Property(c => c.MinOrderValue).HasColumnType("decimal(12,2)");
            builder.Property(c => c.MaxDiscountAmount).HasColumnType("decimal(12,2)");
        }
    }

    public class CouponUsageConfiguration : IEntityTypeConfiguration<CouponUsage>
    {
        public void Configure(EntityTypeBuilder<CouponUsage> builder)
        {
            builder.HasIndex(cu => new { cu.CouponId, cu.UserId }).IsUnique();

            builder.HasOne(cu => cu.Coupon)
                .WithMany(c => c.CouponUsages)
                .HasForeignKey(cu => cu.CouponId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(cu => cu.User)
                .WithMany()
                .HasForeignKey(cu => cu.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class WishlistConfiguration : IEntityTypeConfiguration<Wishlist>
    {
        public void Configure(EntityTypeBuilder<Wishlist> builder)
        {
            builder.HasIndex(w => w.UserId).IsUnique();

            builder.HasOne(w => w.User)
                .WithMany(u => u.Wishlists)
                .HasForeignKey(w => w.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class WishlistItemConfiguration : IEntityTypeConfiguration<WishlistItem>
    {
        public void Configure(EntityTypeBuilder<WishlistItem> builder)
        {
            builder.HasIndex(wi => new { wi.WishlistId, wi.ProductId }).IsUnique();

            builder.HasOne(wi => wi.Wishlist)
                .WithMany(w => w.WishlistItems)
                .HasForeignKey(wi => wi.WishlistId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(wi => wi.Product)
                .WithMany()
                .HasForeignKey(wi => wi.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
    {
        public void Configure(EntityTypeBuilder<AuditLog> builder)
        {
            builder.Property(a => a.Action).HasMaxLength(100).IsRequired();
            builder.Property(a => a.TableName).HasMaxLength(100).IsRequired();
            builder.HasIndex(a => new { a.TableName, a.CreatedAt });

            builder.HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
