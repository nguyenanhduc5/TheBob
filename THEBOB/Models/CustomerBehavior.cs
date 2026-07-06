using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class CustomerBehavior
    {
        [Key]
        public int Id { get; set; }

        public int? UserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string SessionId { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string ActionType { get; set; } = string.Empty; // VIEW, SEARCH, WISHLIST, ADD_TO_CART, REMOVE_FROM_CART, PURCHASE

        [MaxLength(255)]
        public string? TargetId { get; set; } // ProductId or search query

        public int WeightScore { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
