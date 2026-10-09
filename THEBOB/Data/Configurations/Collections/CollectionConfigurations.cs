using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using THEBOB.Models;

namespace THEBOB.Data.Configurations
{
    public class CollectionConfiguration : IEntityTypeConfiguration<Collection>
    {
        public void Configure(EntityTypeBuilder<Collection> builder)
        {
            builder.HasQueryFilter(collection => !collection.IsDeleted);
            builder.HasIndex(collection => collection.Slug).IsUnique();
            builder.HasIndex(collection => new { collection.IsActive, collection.SortOrder });

            builder.Property(collection => collection.Name).HasMaxLength(160).IsRequired();
            builder.Property(collection => collection.Slug).HasMaxLength(180).IsRequired();
            builder.Property(collection => collection.Subtitle).HasMaxLength(200);
            builder.Property(collection => collection.Description).HasMaxLength(1200);
            builder.Property(collection => collection.ImageUrl).HasMaxLength(2000);
            builder.Property(collection => collection.IsActive).HasDefaultValue(true);
        }
    }

    public class ProductCollectionConfiguration : IEntityTypeConfiguration<ProductCollection>
    {
        public void Configure(EntityTypeBuilder<ProductCollection> builder)
        {
            builder.HasQueryFilter(item => !item.Collection!.IsDeleted && !item.Product!.IsDeleted);
            builder.HasKey(item => new { item.CollectionId, item.ProductId });
            builder.HasIndex(item => new { item.CollectionId, item.SortOrder });

            builder.HasOne(item => item.Collection)
                .WithMany(collection => collection.ProductCollections)
                .HasForeignKey(item => item.CollectionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(item => item.Product)
                .WithMany(product => product.ProductCollections)
                .HasForeignKey(item => item.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class CollectionDisplaySettingConfiguration : IEntityTypeConfiguration<CollectionDisplaySetting>
    {
        public void Configure(EntityTypeBuilder<CollectionDisplaySetting> builder)
        {
            builder.Property(setting => setting.LayoutMode)
                .HasMaxLength(24)
                .HasDefaultValue(CollectionLayoutModes.Staggered)
                .IsRequired();
        }
    }
}
