namespace THEBOB.Constants
{
    public static class AppConstants
    {
        public static class Roles
        {
            public const string Admin = "Admin";
            public const string User = "User";
        }

        public static class PaymentGateways
        {
            public const string SePay = "SePay";
            public const string COD = "COD";
            public const string VNPay = "VNPay";
        }

        public static class PaymentStatus
        {
            public const string Pending = "Pending";
            public const string Paid = "Paid";
            public const string Failed = "Failed";
            public const string Refunded = "Refunded";
        }

        public static class OrderStatus
        {
            public const string Pending = "Pending";
            public const string PendingPayment = "PendingPayment";
            public const string Processing = "Processing";
            public const string Shipped = "Shipped";
            public const string Delivered = "Delivered";
            public const string Cancelled = "Cancelled";
        }

        public static class CacheKeys
        {
            public const string BlogFeatured = "blog:featured";
            public const string PresenceAdminCount = "presence:admin:online_count";
        }
    }
}
