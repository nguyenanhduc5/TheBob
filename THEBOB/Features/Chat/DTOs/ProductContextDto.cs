namespace THEBOB.DTOs.Chat
{
    public class ProductContextDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string BrandName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Material { get; set; } = string.Empty;
        
        // Base price calculation (maybe min price among variants)
        public decimal MinPrice { get; set; }
        public decimal MaxPrice { get; set; }
        
        // Active promotion percent (0 if none)
        public decimal PromotionPercent { get; set; }
        
        public double Rating { get; set; }
        public int ReviewCount { get; set; }
        
        public List<VariantInfo> Variants { get; set; } = new();

        public class VariantInfo
        {
            public int Id { get; set; }
            public string Sku { get; set; } = string.Empty;
            public string Size { get; set; } = string.Empty;
            public string Color { get; set; } = string.Empty;
            public decimal Price { get; set; }
            public int Stock { get; set; }
            public int Sold { get; set; } // If available
        }
    }
}
