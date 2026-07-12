namespace THEBOB.Models.Promotion
{
    /// <summary>Loại khuyến mãi</summary>
    public enum PromotionType
    {
        /// <summary>Nhập mã coupon thủ công</summary>
        Coupon = 0,

        /// <summary>Tự động áp dụng — không cần nhập mã</summary>
        Automatic = 1,

        /// <summary>Flash Sale với giới hạn thời gian chặt</summary>
        FlashSale = 2,

        /// <summary>Voucher gửi riêng cho user</summary>
        Voucher = 3,

        /// <summary>Ưu đãi cho thành viên / nhóm khách</summary>
        Member = 4,

        /// <summary>Ưu đãi sinh nhật</summary>
        Birthday = 5
    }

    /// <summary>Trạng thái chương trình khuyến mãi</summary>
    public enum PromotionStatus
    {
        Draft = 0,
        Active = 1,
        Paused = 2,
        Ended = 3
    }

    /// <summary>Kiểu tính giảm giá</summary>
    public enum DiscountKind
    {
        /// <summary>Giảm theo %</summary>
        Percentage = 0,

        /// <summary>Giảm số tiền cố định</summary>
        FixedAmount = 1,

        /// <summary>Miễn phí vận chuyển</summary>
        FreeShipping = 2,

        /// <summary>Mua X tặng Y (BuyXGetY)</summary>
        BuyXGetY = 3,

        /// <summary>Mua theo combo — giá combo</summary>
        BundlePrice = 4
    }

    /// <summary>Phạm vi áp dụng</summary>
    public enum PromotionScope
    {
        /// <summary>Toàn shop</summary>
        AllShop = 0,

        /// <summary>Chỉ theo sản phẩm cụ thể</summary>
        Product = 1,

        /// <summary>Chỉ theo danh mục</summary>
        Category = 2,

        /// <summary>Chỉ theo thương hiệu</summary>
        Brand = 3,

        /// <summary>Chỉ cho user cụ thể (voucher cá nhân)</summary>
        User = 4,

        /// <summary>Chỉ cho nhóm khách hàng</summary>
        CustomerGroup = 5,

        /// <summary>Chỉ theo SKU</summary>
        Sku = 6,

        /// <summary>Chỉ theo tag sản phẩm</summary>
        Tag = 7
    }
}
