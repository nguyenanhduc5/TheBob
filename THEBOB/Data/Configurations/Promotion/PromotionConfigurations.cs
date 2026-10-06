using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using THEBOB.Models.Promotion;

namespace THEBOB.Data.Configurations.Promotion
{
    public class PromotionConfiguration : IEntityTypeConfiguration<Models.Promotion.Promotion>
    {
        public void Configure(EntityTypeBuilder<Models.Promotion.Promotion> builder)
        {
            builder.ToTable("Promotions");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
            builder.Property(p => p.Description).HasMaxLength(1000);
            builder.Property(p => p.BannerUrl).HasMaxLength(2000);
            builder.Property(p => p.CouponCode).HasMaxLength(100);
            builder.Property(p => p.ExclusiveGroup).HasMaxLength(100);
            builder.Property(p => p.CreatedBy).HasMaxLength(200);
            builder.Property(p => p.DiscountValue).HasColumnType("decimal(12,2)");
            builder.Property(p => p.MaxDiscountAmount).HasColumnType("decimal(12,2)");
            builder.Property(p => p.MinOrderValue).HasColumnType("decimal(12,2)");
            builder.Property(p => p.MaxOrderValue).HasColumnType("decimal(12,2)");

            // Unique index trên CouponCode (case-insensitive) — chỉ khi có giá trị
            builder.HasIndex(p => p.CouponCode)
                .IsUnique()
                .HasFilter("`CouponCode` IS NOT NULL AND `CouponCode` != ''");

            builder.HasIndex(p => p.Status);
            builder.HasIndex(p => new { p.Status, p.StartDate, p.EndDate });
            builder.HasIndex(p => p.Priority);
            builder.HasIndex(p => p.Type);

            builder.Property(p => p.Type).HasConversion<string>();
            builder.Property(p => p.Status).HasConversion<string>();
            builder.Property(p => p.DiscountType).HasConversion<string>();
            builder.Property(p => p.Scope).HasConversion<string>();
        }
    }

    public class PromotionProductConfiguration : IEntityTypeConfiguration<PromotionProduct>
    {
        public void Configure(EntityTypeBuilder<PromotionProduct> builder)
        {
            builder.ToTable("PromotionProducts");
            builder.HasIndex(p => p.PromotionId);
            builder.HasIndex(p => p.ProductId);
            builder.HasIndex(p => new { p.PromotionId, p.ProductId }).IsUnique();

            builder.HasOne(p => p.Promotion)
                .WithMany(pr => pr.PromotionProducts)
                .HasForeignKey(p => p.PromotionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(p => p.Product)
                .WithMany()
                .HasForeignKey(p => p.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class PromotionCategoryConfiguration : IEntityTypeConfiguration<PromotionCategory>
    {
        public void Configure(EntityTypeBuilder<PromotionCategory> builder)
        {
            builder.ToTable("PromotionCategories");
            builder.HasIndex(p => p.PromotionId);
            builder.HasIndex(p => new { p.PromotionId, p.CategoryId }).IsUnique();

            builder.HasOne(p => p.Promotion)
                .WithMany(pr => pr.PromotionCategories)
                .HasForeignKey(p => p.PromotionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(p => p.Category)
                .WithMany()
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class PromotionBrandConfiguration : IEntityTypeConfiguration<PromotionBrand>
    {
        public void Configure(EntityTypeBuilder<PromotionBrand> builder)
        {
            builder.ToTable("PromotionBrands");
            builder.HasIndex(p => p.PromotionId);
            builder.HasIndex(p => new { p.PromotionId, p.BrandId }).IsUnique();

            builder.HasOne(p => p.Promotion)
                .WithMany(pr => pr.PromotionBrands)
                .HasForeignKey(p => p.PromotionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(p => p.Brand)
                .WithMany()
                .HasForeignKey(p => p.BrandId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class CustomerGroupConfiguration : IEntityTypeConfiguration<CustomerGroup>
    {
        public void Configure(EntityTypeBuilder<CustomerGroup> builder)
        {
            builder.ToTable("CustomerGroups");
            builder.Property(g => g.Name).IsRequired().HasMaxLength(100);
            builder.Property(g => g.MinTotalSpent).HasColumnType("decimal(12,2)");
            builder.HasIndex(g => g.Name).IsUnique();
        }
    }

    public class PromotionCustomerGroupConfiguration : IEntityTypeConfiguration<PromotionCustomerGroup>
    {
        public void Configure(EntityTypeBuilder<PromotionCustomerGroup> builder)
        {
            builder.ToTable("PromotionCustomerGroups");
            builder.HasIndex(p => new { p.PromotionId, p.CustomerGroupId }).IsUnique();

            builder.HasOne(p => p.Promotion)
                .WithMany(pr => pr.PromotionCustomerGroups)
                .HasForeignKey(p => p.PromotionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(p => p.CustomerGroup)
                .WithMany(g => g.PromotionCustomerGroups)
                .HasForeignKey(p => p.CustomerGroupId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class UserCouponConfiguration : IEntityTypeConfiguration<UserCoupon>
    {
        public void Configure(EntityTypeBuilder<UserCoupon> builder)
        {
            builder.ToTable("UserCoupons");
            builder.HasIndex(u => u.UserId);
            builder.HasIndex(u => new { u.UserId, u.IsUsed });
            builder.HasIndex(u => new { u.PromotionId, u.UserId });

            builder.HasOne(u => u.Promotion)
                .WithMany(p => p.UserCoupons)
                .HasForeignKey(u => u.PromotionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(u => u.User)
                .WithMany()
                .HasForeignKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class PromotionUsageConfiguration : IEntityTypeConfiguration<PromotionUsage>
    {
        public void Configure(EntityTypeBuilder<PromotionUsage> builder)
        {
            builder.ToTable("PromotionUsages");
            builder.HasIndex(u => new { u.PromotionId, u.UserId });
            builder.HasIndex(u => u.OrderId);
            builder.HasIndex(u => u.UsedAt);
            builder.HasIndex(u => u.IsRolledBack);

            builder.Property(u => u.DiscountApplied).HasColumnType("decimal(12,2)");

            builder.HasOne(u => u.Promotion)
                .WithMany(p => p.PromotionUsages)
                .HasForeignKey(u => u.PromotionId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(u => u.User)
                .WithMany()
                .HasForeignKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(u => u.Order)
                .WithMany(o => o.PromotionUsages)
                .HasForeignKey(u => u.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class OrderPromotionConfiguration : IEntityTypeConfiguration<OrderPromotion>
    {
        public void Configure(EntityTypeBuilder<OrderPromotion> builder)
        {
            builder.ToTable("OrderPromotions");
            builder.HasIndex(o => o.OrderId);

            builder.Property(o => o.DiscountApplied).HasColumnType("decimal(12,2)");
            builder.Property(o => o.DiscountValue).HasColumnType("decimal(12,2)");
            builder.Property(o => o.PromotionName).IsRequired().HasMaxLength(200);
            builder.Property(o => o.DiscountType).HasMaxLength(50);
            builder.Property(o => o.CouponCode).HasMaxLength(100);
            builder.Property(o => o.PromotionType).HasMaxLength(50);

            builder.HasOne(o => o.Order)
                .WithMany(ord => ord.OrderPromotions)
                .HasForeignKey(o => o.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Promotion nullable — giữ snapshot kể cả khi promotion bị xóa
            builder.HasOne(o => o.Promotion)
                .WithMany(p => p.OrderPromotions)
                .HasForeignKey(o => o.PromotionId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
