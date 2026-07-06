using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class HighUtilityItemsetEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string ItemsetKeys { get; set; } = string.Empty; // e.g. "1,2,5"

        public decimal Utility { get; set; }

        public double Support { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
