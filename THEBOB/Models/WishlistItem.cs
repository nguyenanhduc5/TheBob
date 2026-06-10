using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class WishlistItem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int WishlistId { get; set; }

        public Wishlist Wishlist { get; set; } = null!;

        [Required]
        public int ProductId { get; set; }

        public Product Product { get; set; } = null!;
    }
}
