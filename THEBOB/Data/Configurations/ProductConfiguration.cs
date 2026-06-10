using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using THEBOB.Models;

namespace THEBOB.Data.Configurations
{
    public class ProductConfiguration : IEntityTypeConfiguration<Product>
    {
        public void Configure(EntityTypeBuilder<Product> builder)
        {
            builder.HasQueryFilter(p => !p.IsDeleted);

            builder.HasIndex(p => p.Name);
            builder.HasIndex(p => p.CategoryId);

            builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
            builder.Property(p => p.Description).HasMaxLength(1000);
            builder.Property(p => p.MainImageUrl).HasMaxLength(500);
            builder.Property(p => p.Material).HasMaxLength(100);
            builder.Property(p => p.CareInstructions).HasMaxLength(100);
            builder.Property(p => p.IsAvailable).HasDefaultValue(true);

            builder.HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(p => p.Brand)
                .WithMany(b => b.Products)
                .HasForeignKey(p => p.BrandId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
    {
        public void Configure(EntityTypeBuilder<ProductVariant> builder)
        {
            builder.HasQueryFilter(v => !v.IsDeleted && !v.Product!.IsDeleted);

            builder.Property(v => v.Sku).HasMaxLength(100).IsRequired();
            builder.Property(v => v.Price).HasColumnType("decimal(12,2)").IsRequired();

            builder.HasIndex(v => v.ProductId);
            builder.HasIndex(v => v.Sku).IsUnique();
            builder.HasIndex(v => new { v.ProductId, v.SizeId, v.ColorId }).IsUnique();

            builder.ToTable(t => t.HasCheckConstraint("CK_ProductVariants_Stock_NonNegative", "`Stock` >= 0"));
            builder.ToTable(t => t.HasCheckConstraint("CK_ProductVariants_Price_NonNegative", "`Price` >= 0"));

            builder.HasOne(v => v.Product)
                .WithMany(p => p.ProductVariants)
                .HasForeignKey(v => v.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(v => v.Size)
                .WithMany(s => s.ProductVariants)
                .HasForeignKey(v => v.SizeId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(v => v.Color)
                .WithMany(c => c.ProductVariants)
                .HasForeignKey(v => v.ColorId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
    {
        public void Configure(EntityTypeBuilder<ProductImage> builder)
        {
            builder.HasIndex(pi => new { pi.ProductId, pi.SortOrder });

            builder.HasOne(pi => pi.Product)
                .WithMany(p => p.Images)
                .HasForeignKey(pi => pi.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class ProductVariantImageConfiguration : IEntityTypeConfiguration<ProductVariantImage>
    {
        public void Configure(EntityTypeBuilder<ProductVariantImage> builder)
        {
            builder.Property(i => i.Url).HasMaxLength(500).IsRequired();
            builder.HasIndex(i => new { i.VariantId, i.SortOrder });

            builder.HasOne(i => i.Variant)
                .WithMany(v => v.Images)
                .HasForeignKey(i => i.VariantId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class CategoryConfiguration : IEntityTypeConfiguration<Category>
    {
        public void Configure(EntityTypeBuilder<Category> builder)
        {
            builder.HasQueryFilter(c => !c.IsDeleted);

            builder.HasIndex(c => c.Slug).IsUnique();

            builder.Property(c => c.Name).HasMaxLength(100).IsRequired();
            builder.Property(c => c.Slug).HasMaxLength(100).IsRequired();
            builder.Property(c => c.Description).HasMaxLength(500);
        }
    }

    public class SizeConfiguration : IEntityTypeConfiguration<Size>
    {
        public void Configure(EntityTypeBuilder<Size> builder)
        {
            builder.HasIndex(s => s.Name).IsUnique();
            builder.Property(s => s.Name).HasMaxLength(50).IsRequired();
        }
    }

    public class ColorConfiguration : IEntityTypeConfiguration<Color>
    {
        public void Configure(EntityTypeBuilder<Color> builder)
        {
            builder.HasIndex(c => c.Name).IsUnique();
            builder.Property(c => c.Name).HasMaxLength(50).IsRequired();
            builder.Property(c => c.HexCode).HasMaxLength(20);
        }
    }

    public class BrandConfiguration : IEntityTypeConfiguration<Brand>
    {
        public void Configure(EntityTypeBuilder<Brand> builder)
        {
            builder.HasIndex(b => b.Name).IsUnique();
            builder.Property(b => b.Name).HasMaxLength(100).IsRequired();
            builder.Property(b => b.LogoUrl).HasMaxLength(500);
        }
    }
}
