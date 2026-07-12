using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.LiveChat
{
    public class AdminPresence
    {
        [Key]
        public int AdminId { get; set; }

        [ForeignKey(nameof(AdminId))]
        public User Admin { get; set; } = null!;

        public bool IsOnline { get; set; }

        public DateTime LastSeen { get; set; } = DateTime.UtcNow;

        [MaxLength(200)]
        public string? ConnectionId { get; set; }
    }
}
