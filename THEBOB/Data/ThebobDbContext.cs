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

    public DbSet<User> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Cấu hình Product
            modelBuilder.Entity<Product>()
                .Property(p => p.Price)
                .HasColumnType("decimal(10,2)");

            modelBuilder.Entity<Product>()
                .Property(p => p.Rating)
                .HasColumnType("decimal(3,2)");
        }
    }
}
