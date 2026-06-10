using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Collections.Generic;
using System;
using System.Linq;

namespace THEBOB.Models
{
    public enum UserRole
    {
        User = 0,
        Admin = 1
    }

    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string PasswordHash { get; set; } = string.Empty;

        [MaxLength(255)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Phone { get; set; }

        // Foreign key to roles table
        public int RoleId { get; set; }

        [ForeignKey("RoleId")]
        public Role? RoleEntity { get; set; }

        // Compatibility properties used by existing controllers/front-end
        [NotMapped]
        public string Username
        {
            get => Email;
            set => Email = value;
        }

        [NotMapped]
        public string Name
        {
            get => FullName;
            set => FullName = value;
        }

        [NotMapped]
        public string Address
        {
            get => Addresses.FirstOrDefault()?.SpecificAddress ?? string.Empty;
            set
            {
                var first = Addresses.FirstOrDefault();
                if (first != null)
                {
                    first.SpecificAddress = value;
                }
                else
                {
                    Addresses.Add(new Address
                    {
                        RecipientName = FullName,
                        RecipientPhone = Phone ?? string.Empty,
                        SpecificAddress = value,
                        ProvinceCity = string.Empty,
                        District = string.Empty,
                        Ward = string.Empty
                    });
                }
            }
        }

        [NotMapped]
        public UserRole Role
        {
            get => (RoleEntity != null && RoleEntity.RoleName == "Admin") ? UserRole.Admin : UserRole.User;
            set { /* setter intentionally left blank; use RoleEntity/RoleId for persistence */ }
        }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<Address> Addresses { get; set; } = new List<Address>();

        public ICollection<Wishlist> Wishlists { get; set; } = new List<Wishlist>();
    }
}
