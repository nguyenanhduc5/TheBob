using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class Wishlist
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        public User User { get; set; } = null!;

        public ICollection<WishlistItem> WishlistItems { get; set; } = new List<WishlistItem>();
    }
}
