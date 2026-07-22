using Microsoft.EntityFrameworkCore;
using THEBOB.Models;
using THEBOB.Models.Blog;
using THEBOB.Models.LiveChat;
using THEBOB.Models.Promotion;

namespace THEBOB.Data
{
    public class ThebobDbContext : DbContext
    {
        public ThebobDbContext(DbContextOptions<ThebobDbContext> options) : base(options)
        {
        }

        // ── Existing Tables ──────────────────────────────────────────────────
        public DbSet<Product> Products { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<ProductImage> ProductImages { get; set; }
        public DbSet<ProductVariantImage> ProductVariantImages { get; set; }
        public DbSet<ProductVariant> ProductVariants { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Address> Addresses { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Cart> Carts { get; set; }
        public DbSet<CartItem> CartItems { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<InventoryLog> InventoryLogs { get; set; }
        public DbSet<Size> Sizes { get; set; }
        public DbSet<Color> Colors { get; set; }
        public DbSet<Brand> Brands { get; set; }
        public DbSet<PaymentTransaction> PaymentTransactions { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<OtpVerification> OtpVerifications { get; set; }
        public DbSet<CustomerBehavior> CustomerBehaviors { get; set; }
        public DbSet<AssociationRuleEntity> AssociationRules { get; set; }
        public DbSet<HighUtilityItemsetEntity> HighUtilityItemsets { get; set; }
        public DbSet<RecommendationCache> Recommendations { get; set; }
        public DbSet<RecommendationLog> RecommendationLogs { get; set; }

        // ── Legacy (kept for backward-compat during migration) ───────────────
        public DbSet<Coupon> Coupons { get; set; }
        public DbSet<CouponUsage> CouponUsages { get; set; }

        // ── New Promotion Engine Tables ──────────────────────────────────────
        public DbSet<Models.Promotion.Promotion> Promotions { get; set; }
        public DbSet<PromotionProduct> PromotionProducts { get; set; }
        public DbSet<PromotionCategory> PromotionCategories { get; set; }
        public DbSet<PromotionBrand> PromotionBrands { get; set; }
        public DbSet<CustomerGroup> CustomerGroups { get; set; }
        public DbSet<PromotionCustomerGroup> PromotionCustomerGroups { get; set; }
        public DbSet<UserCoupon> UserCoupons { get; set; }
        public DbSet<PromotionUsage> PromotionUsages { get; set; }
        public DbSet<OrderPromotion> OrderPromotions { get; set; }

        // ── Live Chat Tables ──────────────────────────────────────────────────────
        public DbSet<Conversation> Conversations { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<AdminPresence> AdminPresences { get; set; }
        public DbSet<Faq> Faqs { get; set; }

        // ── Blog Module Tables ───────────────────────────────────────────────────
        public DbSet<BlogCategory> BlogCategories { get; set; }
        public DbSet<BlogPost> BlogPosts { get; set; }
        public DbSet<BlogPostProduct> BlogPostProducts { get; set; }
        public DbSet<BlogPostClick> BlogPostClicks { get; set; }
        public DbSet<BlogNotification> BlogNotifications { get; set; }
        public DbSet<UserBlogNotification> UserBlogNotifications { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ThebobDbContext).Assembly);

            // BlogPostProduct — composite PK
            modelBuilder.Entity<BlogPostProduct>()
                .HasKey(bp => new { bp.BlogPostId, bp.ProductId });

            // UserBlogNotification — unique index per (NotificationId, UserId)
            modelBuilder.Entity<UserBlogNotification>()
                .HasIndex(u => new { u.BlogNotificationId, u.UserId })
                .IsUnique();

            // BlogPost — unique slug index
            modelBuilder.Entity<BlogPost>()
                .HasIndex(b => b.Slug)
                .IsUnique();

            // BlogCategory — unique slug index
            modelBuilder.Entity<BlogCategory>()
                .HasIndex(c => c.Slug)
                .IsUnique();
        }

        public override int SaveChanges()
        {
            ValidateProductVariants();
            return base.SaveChanges();
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            ValidateProductVariants();
            return base.SaveChangesAsync(cancellationToken);
        }

        private void ValidateProductVariants()
        {
            var invalidVariant = ChangeTracker.Entries<ProductVariant>()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified)
                .Select(e => e.Entity)
                .FirstOrDefault(v => v.Stock < 0);

            if (invalidVariant != null)
            {
                throw new InvalidOperationException("Product variant stock cannot be negative.");
            }
        }
    }
}
