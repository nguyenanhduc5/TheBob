using System;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models.LiveChat;

namespace THEBOB.Services.Chat
{
    public class FaqService : IFaqService
    {
        private readonly ThebobDbContext _context;

        public FaqService(ThebobDbContext context)
        {
            _context = context;
        }

        public async Task<List<Faq>> GetAllFaqsAsync()
        {
            return await _context.Faqs
                .OrderByDescending(f => f.Priority)
                .ThenBy(f => f.Id)
                .ToListAsync();
        }

        public async Task<Faq> CreateFaqAsync(Faq faq)
        {
            _context.Faqs.Add(faq);
            await _context.SaveChangesAsync();
            return faq;
        }

        public async Task<Faq?> UpdateFaqAsync(int id, Faq faq)
        {
            var existing = await _context.Faqs.FindAsync(id);
            if (existing == null) return null;

            existing.Question = faq.Question;
            existing.Answer = faq.Answer;
            existing.Keywords = faq.Keywords;
            existing.Priority = faq.Priority;
            existing.IsActive = faq.IsActive;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task<bool> DeleteFaqAsync(int id)
        {
            var existing = await _context.Faqs.FindAsync(id);
            if (existing == null) return false;

            _context.Faqs.Remove(existing);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<Faq?> TryMatchFaqAsync(string userMessage)
        {
            if (string.IsNullOrWhiteSpace(userMessage))
                return null;

            string normalizedMessage = RemoveDiacritics(userMessage);

            var activeFaqs = await _context.Faqs
                .Where(f => f.IsActive)
                .ToListAsync();

            var matches = activeFaqs.Select(f => new
            {
                Faq = f,
                MatchCount = CountKeywordMatches(f.Keywords, normalizedMessage)
            })
            .Where(x => x.MatchCount > 0)
            .OrderByDescending(x => x.MatchCount)
            .ThenByDescending(x => x.Faq.Priority)
            .ToList();

            return matches.FirstOrDefault()?.Faq;
        }

        private int CountKeywordMatches(string keywordsString, string normalizedMessage)
        {
            if (string.IsNullOrWhiteSpace(keywordsString))
                return 0;

            var keywords = keywordsString
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(k => RemoveDiacritics(k.Trim()))
                .Where(k => !string.IsNullOrEmpty(k))
                .ToList();

            int count = 0;
            foreach (var keyword in keywords)
            {
                if (normalizedMessage.Contains(keyword))
                {
                    count++;
                }
            }

            return count;
        }

        private string RemoveDiacritics(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return string.Empty;

            var normalizedString = text.Normalize(NormalizationForm.FormD);
            var stringBuilder = new StringBuilder(capacity: normalizedString.Length);

            for (int i = 0; i < normalizedString.Length; i++)
            {
                char c = normalizedString[i];
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                {
                    stringBuilder.Append(c);
                }
            }

            return stringBuilder.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        }
    }
}
