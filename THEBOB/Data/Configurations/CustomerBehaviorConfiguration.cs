using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using THEBOB.Models;

namespace THEBOB.Data.Configurations;

public class CustomerBehaviorConfiguration : IEntityTypeConfiguration<CustomerBehavior>
{
    public void Configure(EntityTypeBuilder<CustomerBehavior> builder)
    {
        builder.HasIndex(b => new { b.Timestamp, b.ActionType });
        builder.HasIndex(b => new { b.UserId, b.Timestamp });
    }
}
