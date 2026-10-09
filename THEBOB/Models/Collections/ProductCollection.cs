namespace THEBOB.Models
{
    public class ProductCollection
    {
        public int CollectionId { get; set; }

        public Collection? Collection { get; set; }

        public int ProductId { get; set; }

        public Product? Product { get; set; }

        public int SortOrder { get; set; }
    }
}
