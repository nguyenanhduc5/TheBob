using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public static class CollectionLayoutModes
    {
        public const string Staggered = "staggered";
        public const string TwoColumn = "two-column";

        public static bool IsSupported(string? value)
        {
            return value is Staggered or TwoColumn;
        }
    }

    public class CollectionDisplaySetting
    {
        [Key]
        public int Id { get; set; } = 1;

        [Required]
        [MaxLength(24)]
        public string LayoutMode { get; set; } = CollectionLayoutModes.Staggered;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
