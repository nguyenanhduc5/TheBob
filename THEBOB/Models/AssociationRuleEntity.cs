using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class AssociationRuleEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Antecedent { get; set; } = string.Empty; // e.g. "1,2"

        [Required]
        [MaxLength(255)]
        public string Consequent { get; set; } = string.Empty; // e.g. "3"

        public double Support { get; set; }

        public double Confidence { get; set; }

        public double Lift { get; set; }

        public double Conviction { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
