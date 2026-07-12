using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models.LiveChat
{
    public class Faq
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string Question { get; set; } = string.Empty;

        [Required]
        public string Answer { get; set; } = string.Empty;

        /// <summary>Comma-separated hoặc JSON array string để match keyword.</summary>
        [Required]
        [MaxLength(2000)]
        public string Keywords { get; set; } = string.Empty;

        public int Priority { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
