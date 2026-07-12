using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using THEBOB.Models.LiveChat;

namespace THEBOB.Data.Configurations.LiveChat
{
    public class ConversationConfiguration : IEntityTypeConfiguration<Conversation>
    {
        public void Configure(EntityTypeBuilder<Conversation> builder)
        {
            builder.ToTable("Conversations");

            builder.HasIndex(c => c.UserId);
            builder.HasIndex(c => c.AssignedAdminId);
            builder.HasIndex(c => c.Status);
            builder.HasIndex(c => new { c.UserId, c.Status });

            builder.HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(c => c.AssignedAdmin)
                .WithMany()
                .HasForeignKey(c => c.AssignedAdminId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(c => c.CurrentProduct)
                .WithMany()
                .HasForeignKey(c => c.CurrentProductId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(c => c.CurrentVariant)
                .WithMany()
                .HasForeignKey(c => c.CurrentVariantId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(c => c.CurrentOrder)
                .WithMany()
                .HasForeignKey(c => c.CurrentOrderId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class MessageConfiguration : IEntityTypeConfiguration<Message>
    {
        public void Configure(EntityTypeBuilder<Message> builder)
        {
            builder.ToTable("Messages");

            builder.Property(m => m.Content).HasColumnType("longtext");

            builder.HasIndex(m => m.ConversationId);
            builder.HasIndex(m => new { m.ConversationId, m.CreatedAt });

            builder.HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(m => m.ReferencedProduct)
                .WithMany()
                .HasForeignKey(m => m.ReferencedProductId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(m => m.ReferencedOrder)
                .WithMany()
                .HasForeignKey(m => m.ReferencedOrderId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class AdminPresenceConfiguration : IEntityTypeConfiguration<AdminPresence>
    {
        public void Configure(EntityTypeBuilder<AdminPresence> builder)
        {
            builder.ToTable("AdminPresences");

            builder.HasIndex(a => a.IsOnline);

            builder.HasOne(a => a.Admin)
                .WithMany()
                .HasForeignKey(a => a.AdminId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class FaqConfiguration : IEntityTypeConfiguration<Faq>
    {
        public void Configure(EntityTypeBuilder<Faq> builder)
        {
            builder.ToTable("Faqs");

            builder.Property(f => f.Answer).HasColumnType("longtext");

            builder.HasIndex(f => f.IsActive);
            builder.HasIndex(f => new { f.IsActive, f.Priority });
        }
    }
}
