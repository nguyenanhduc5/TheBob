using System.Text;
using System.Text.RegularExpressions;

namespace THEBOB.Helpers
{
    public static class SlugHelper
    {
        public static string GenerateSlug(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return Guid.NewGuid().ToString("N")[..8];

            // Chuẩn hóa Unicode -> NFD rồi loại bỏ các dấu diacritics
            var normalized = text.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var c in normalized)
            {
                var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
                if (cat != System.Globalization.UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            }

            var ascii = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
            // Thay thế ký tự đ, Đ
            ascii = ascii.Replace("đ", "d").Replace("Đ", "d");
            // Chỉ giữ lại ký tự chữ cái, số, khoảng trắng và gạch ngang
            ascii = Regex.Replace(ascii, @"[^a-z0-9\s-]", "");
            // Thay thế khoảng trắng thành dấu gạch ngang
            ascii = Regex.Replace(ascii, @"\s+", "-").Trim('-');
            // Xóa gạch ngang trùng lặp
            ascii = Regex.Replace(ascii, @"-{2,}", "-");

            return string.IsNullOrEmpty(ascii) ? Guid.NewGuid().ToString("N")[..8] : ascii;
        }
    }
}
