using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using THEBOB.Models;

namespace THEBOB.Data.Configurations
{
    public class OrderConfiguration : IEntityTypeConfiguration<Order>
    {
        public void Configure(EntityTypeBuilder<Order> builder)
        {
            builder.HasIndex(o => o.OrderNumber).IsUnique();
            builder.HasIndex(o => o.UserId);
            builder.HasIndex(o => o.Status);

            builder.Property(o => o.TotalAmount).HasColumnType("decimal(12,2)");

            builder.HasOne(o => o.User)
                .WithMany()
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(o => o.Coupon)
                .WithMany()
                .HasForeignKey(o => o.CouponId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
    {
        public void Configure(EntityTypeBuilder<OrderItem> builder)
        {
            builder.Property(oi => oi.PricePerItem).HasColumnType("decimal(12,2)");
            builder.Property(oi => oi.ProductName).HasMaxLength(255).IsRequired();
            builder.Property(oi => oi.Sku).HasMaxLength(100);
            builder.Property(oi => oi.Size).HasMaxLength(100);
            builder.Property(oi => oi.Color).HasMaxLength(100);
            builder.Property(oi => oi.ProductImage).HasMaxLength(500);

            builder.HasOne(oi => oi.Order)
                .WithMany(o => o.OrderItems)
                .HasForeignKey(oi => oi.OrderId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(oi => oi.Variant)
                .WithMany()
                .HasForeignKey(oi => oi.VariantId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
    {
        public void Configure(EntityTypeBuilder<PaymentTransaction> builder)
        {
            builder.Property(p => p.Gateway).HasMaxLength(50).IsRequired();
            builder.Property(p => p.TransactionCode).HasMaxLength(100);
            builder.Property(p => p.VaNumber).HasMaxLength(100);
            builder.Property(p => p.TransactionId).HasMaxLength(100);
            builder.Property(p => p.PaymentProvider).HasMaxLength(50);
            builder.Property(p => p.Amount).HasColumnType("decimal(12,2)");
            builder.Property(p => p.Status).HasMaxLength(50).IsRequired();

            builder.HasIndex(p => p.OrderId);
            builder.HasIndex(p => p.TransactionCode);
            builder.HasIndex(p => p.VaNumber);
            builder.HasIndex(p => p.TransactionId);

            builder.HasOne(p => p.Order)
                .WithMany(o => o.PaymentTransactions)
                .HasForeignKey(p => p.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class InventoryLogConfiguration : IEntityTypeConfiguration<InventoryLog>
    {
        public void Configure(EntityTypeBuilder<InventoryLog> builder)
        {
            builder.HasIndex(i => i.VariantId);

            builder.HasOne(i => i.Variant)
                .WithMany()
                .HasForeignKey(i => i.VariantId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(i => i.User)
                .WithMany()
                .HasForeignKey(i => i.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
