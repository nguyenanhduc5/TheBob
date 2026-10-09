namespace THEBOB.Features.Collections.DTOs
{
    public class CollectionRequest
    {
        public string Name { get; set; } = string.Empty;

        public string? Subtitle { get; set; }

        public string? Description { get; set; }

        public string? ImageUrl { get; set; }

        public bool IsActive { get; set; } = true;

        public int SortOrder { get; set; }

        public List<int> ProductIds { get; set; } = new();
    }

    public class CollectionLayoutRequest
    {
        public string LayoutMode { get; set; } = string.Empty;
    }
}
