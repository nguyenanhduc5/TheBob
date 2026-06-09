using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System;

namespace THEBOB.Models
{
    public enum InventoryChangeType
    {
        Added,      // Stock added (restock)
        Sold,       // Stock reduced (sale)
        Adjusted,   // Manual adjustment
        Returned    // Returned item
    }

    public class InventoryLog
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int VariantId { get; set; }

        [ForeignKey("VariantId")]
        public ProductVariant Variant { get; set; } = null!;
        [Required]
        public InventoryChangeType ChangeType { get; set; }

        [Required]
        public int QuantityChanged { get; set; } // Positive for added, negative for reduced

        [MaxLength(500)]
        public string Reason { get; set; } = string.Empty;

        public int? UserId { get; set; } // Who made the change (nullable for system changes)

        [ForeignKey("UserId")]
        public User? User { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}