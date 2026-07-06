using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Services.Recommendation
{
    public class RecommendationService
    {
        private readonly ThebobDbContext _context;

        public RecommendationService(ThebobDbContext context)
        {
            _context = context;
        }

        // Ghi nhận hành vi khách hàng
        public async Task TrackBehaviorAsync(int? userId, string sessionId, string actionType, string? targetId, int weightScore)
        {
            var behavior = new CustomerBehavior
            {
                UserId = userId,
                SessionId = sessionId,
                ActionType = actionType,
                TargetId = targetId,
                WeightScore = weightScore,
                Timestamp = DateTime.UtcNow
            };

            _context.CustomerBehaviors.Add(behavior);
            await _context.SaveChangesAsync();
        }

        // 1. Related Products (Sản phẩm liên quan)
        public async Task<List<Product>> GetRelatedProductsAsync(int productId, int limit)
        {
            var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == productId);
            if (product == null) return new();

            // Lấy các luật kết hợp có tiền đề là productId này
            var prodIdStr = productId.ToString();
            var activeRules = await _context.AssociationRules
                .Where(r => r.Antecedent == prodIdStr)
                .OrderByDescending(r => r.Lift)
                .Take(limit * 2)
                .ToListAsync();

            var candidateIds = activeRules
                .Select(r => int.TryParse(r.Consequent, out var id) ? id : 0)
                .Where(id => id > 0 && id != productId)
                .Distinct()
                .ToList();

            // Nếu chưa đủ limit, lấy thêm các sản phẩm cùng Category
            if (candidateIds.Count < limit)
            {
                var categoryId = product.CategoryId;
                var sameCategoryIds = await _context.Products
                    .Where(p => p.CategoryId == categoryId && p.Id != productId && !p.IsDeleted)
                    .Select(p => p.Id)
                    .Take(limit - candidateIds.Count)
                    .ToListAsync();
                candidateIds.AddRange(sameCategoryIds);
            }

            candidateIds = candidateIds.Distinct().Take(limit).ToList();

            return await _context.Products
                .Include(p => p.ProductVariants)
                .Include(p => p.Brand)
                .Where(p => candidateIds.Contains(p.Id) && !p.IsDeleted)
                .ToListAsync();
        }

        // 2. Frequently Bought Together (Thường mua cùng nhau)
        public async Task<List<Product>> GetFrequentlyBoughtTogetherAsync(List<int> productIds, int limit)
        {
            if (productIds == null || !productIds.Any()) return new();

            // Tìm các luật kết hợp mà tiền đề chứa các sản phẩm này
            // Đơn giản hóa: tiền đề trùng hoặc chứa ít nhất một sản phẩm trong giỏ
            var rules = await _context.AssociationRules.ToListAsync();
            var candidates = new Dictionary<int, double>();

            foreach (var rule in rules)
            {
                var antecedentIds = rule.Antecedent.Split(',')
                    .Select(s => int.TryParse(s, out var id) ? id : 0)
                    .Where(id => id > 0)
                    .ToList();

                // Nếu antecedent nằm hoàn toàn trong giỏ hàng hiện tại
                if (antecedentIds.Any() && antecedentIds.All(id => productIds.Contains(id)))
                {
                    var consequentIds = rule.Consequent.Split(',')
                        .Select(s => int.TryParse(s, out var id) ? id : 0)
                        .Where(id => id > 0)
                        .ToList();

                    foreach (var consId in consequentIds)
                    {
                        if (productIds.Contains(consId)) continue; // Bỏ qua nếu đã có trong giỏ

                        if (!candidates.ContainsKey(consId)) candidates[consId] = 0;
                        // Điểm số ưu tiên Support & Confidence
                        candidates[consId] = Math.Max(candidates[consId], rule.Support * rule.Confidence);
                    }
                }
            }

            var sortedCandidateIds = candidates
                .OrderByDescending(kv => kv.Value)
                .Select(kv => kv.Key)
                .Take(limit)
                .ToList();

            // Nếu không đủ, lấy sản phẩm ngẫu nhiên/nổi bật để bù vào
            if (sortedCandidateIds.Count < limit)
            {
                var featuredIds = await _context.Products
                    .Where(p => !productIds.Contains(p.Id) && !sortedCandidateIds.Contains(p.Id) && !p.IsDeleted)
                    .OrderByDescending(p => p.Rating)
                    .Select(p => p.Id)
                    .Take(limit - sortedCandidateIds.Count)
                    .ToListAsync();
                sortedCandidateIds.AddRange(featuredIds);
            }

            return await _context.Products
                .Include(p => p.ProductVariants)
                .Include(p => p.Brand)
                .Where(p => sortedCandidateIds.Contains(p.Id) && !p.IsDeleted)
                .ToListAsync();
        }

        // 3. Personalized Recommendation (Cá nhân hóa kết hợp Apriori + HUI)
        public async Task<List<Product>> GetPersonalizedRecommendationsAsync(int userId, int limit)
        {
            // Lấy các tương tác gần đây của user để làm context
            var recentInteractions = await _context.CustomerBehaviors
                .Where(b => b.UserId == userId && b.Timestamp >= DateTime.UtcNow.AddDays(-7))
                .ToListAsync();

            var userProductInteractions = recentInteractions
                .Where(b => b.ActionType == "VIEW" || b.ActionType == "ADD_TO_CART")
                .GroupBy(b => b.TargetId)
                .Select(g => new
                {
                    ProductId = int.TryParse(g.Key, out var id) ? id : 0,
                    Score = g.Sum(x => x.WeightScore)
                })
                .Where(x => x.ProductId > 0)
                .ToDictionary(x => x.ProductId, x => x.Score);

            if (!userProductInteractions.Any())
            {
                // Fallback về Trending
                return await GetTrendingProductsAsync(limit);
            }

            // Tìm các ứng viên gợi ý từ luật kết hợp dựa trên các sản phẩm user quan tâm
            var activeRules = await _context.AssociationRules.ToListAsync();
            var candidates = new Dictionary<int, (double Support, double Confidence, double Lift, decimal Utility, double BehaviorScore)>();

            var huis = await _context.HighUtilityItemsets.ToListAsync();

            foreach (var item in userProductInteractions)
            {
                int viewedId = item.Key;
                double behavScore = item.Value;

                foreach (var rule in activeRules)
                {
                    var antecedentIds = rule.Antecedent.Split(',')
                        .Select(s => int.TryParse(s, out var id) ? id : 0)
                        .Where(id => id > 0)
                        .ToList();

                    if (antecedentIds.Contains(viewedId))
                    {
                        var consequentIds = rule.Consequent.Split(',')
                            .Select(s => int.TryParse(s, out var id) ? id : 0)
                            .Where(id => id > 0)
                            .ToList();

                        foreach (var consId in consequentIds)
                        {
                            if (userProductInteractions.ContainsKey(consId)) continue; // Bỏ qua sản phẩm đã tương tác

                            // Tìm Utility của tập kết hợp {viewedId, consId} trong HUI
                            decimal utility = 0;
                            var matchingHui = huis.FirstOrDefault(h =>
                            {
                                var hKeys = h.ItemsetKeys.Split(',')
                                    .Select(s => int.TryParse(s, out var id) ? id : 0)
                                    .Where(id => id > 0)
                                    .ToList();
                                return hKeys.Contains(viewedId) && hKeys.Contains(consId);
                            });
                            if (matchingHui != null)
                            {
                                utility = matchingHui.Utility;
                            }

                            if (!candidates.ContainsKey(consId))
                            {
                                candidates[consId] = (rule.Support, rule.Confidence, rule.Lift, utility, behavScore);
                            }
                            else
                            {
                                // Lấy giá trị lớn nhất
                                var prev = candidates[consId];
                                candidates[consId] = (
                                    Math.Max(prev.Support, rule.Support),
                                    Math.Max(prev.Confidence, rule.Confidence),
                                    Math.Max(prev.Lift, rule.Lift),
                                    Math.Max(prev.Utility, utility),
                                    prev.BehaviorScore + behavScore
                                );
                            }
                        }
                    }
                }
            }

            if (!candidates.Any())
            {
                return await GetTrendingProductsAsync(limit);
            }

            // Chuẩn hóa Min-Max các chỉ số để xếp hạng
            double maxSup = candidates.Values.Max(c => c.Support);
            double minSup = candidates.Values.Min(c => c.Support);
            double maxLift = candidates.Values.Max(c => c.Lift);
            double minLift = candidates.Values.Min(c => c.Lift);
            decimal maxUtil = candidates.Values.Max(c => c.Utility);
            decimal minUtil = candidates.Values.Min(c => c.Utility);
            double maxBehav = candidates.Values.Max(c => c.BehaviorScore);
            double minBehav = candidates.Values.Min(c => c.BehaviorScore);

            var scoredCandidates = new List<(int ProductId, double Score)>();
            foreach (var cand in candidates)
            {
                int prodId = cand.Key;
                var val = cand.Value;

                double normSup = maxSup - minSup > 0 ? (val.Support - minSup) / (maxSup - minSup) : 1;
                double normLift = maxLift - minLift > 0 ? (val.Lift - minLift) / (maxLift - minLift) : 1;
                double normUtil = maxUtil - minUtil > 0 ? (double)(val.Utility - minUtil) / (double)(maxUtil - minUtil) : 1;
                double normBehav = maxBehav - minBehav > 0 ? (val.BehaviorScore - minBehav) / (maxBehav - minBehav) : 1;

                // Công thức: 20% Sup + 20% Conf + 10% Lift + 30% Utility + 20% Behav
                double finalScore = (0.2 * normSup) +
                                    (0.2 * val.Confidence) +
                                    (0.1 * normLift) +
                                    (0.3 * normUtil) +
                                    (0.2 * normBehav);

                scoredCandidates.Add((prodId, finalScore));
            }

            var finalIds = scoredCandidates
                .OrderByDescending(c => c.Score)
                .Select(c => c.ProductId)
                .Take(limit)
                .ToList();

            return await _context.Products
                .Include(p => p.ProductVariants)
                .Include(p => p.Brand)
                .Where(p => finalIds.Contains(p.Id) && !p.IsDeleted)
                .ToListAsync();
        }

        // 4. Trending Products (Sản phẩm xu hướng)
        public async Task<List<Product>> GetTrendingProductsAsync(int limit)
        {
            // Thống kê số lượng tương tác trong 7 ngày gần đây
            var sinceDate = DateTime.UtcNow.AddDays(-7);
            var trendIds = await _context.CustomerBehaviors
                .Where(b => b.Timestamp >= sinceDate && (b.ActionType == "VIEW" || b.ActionType == "ADD_TO_CART" || b.ActionType == "PURCHASE"))
                .GroupBy(b => b.TargetId)
                .Select(g => new
                {
                    ProductIdStr = g.Key,
                    Score = g.Sum(x => x.WeightScore)
                })
                .ToListAsync();

            var sortedIds = trendIds
                .Select(x => new { ProductId = int.TryParse(x.ProductIdStr, out var id) ? id : 0, x.Score })
                .Where(x => x.ProductId > 0)
                .OrderByDescending(x => x.Score)
                .Select(x => x.ProductId)
                .Take(limit)
                .ToList();

            if (sortedIds.Count < limit)
            {
                var backupIds = await _context.Products
                    .Where(p => !sortedIds.Contains(p.Id) && !p.IsDeleted)
                    .OrderByDescending(p => p.Rating)
                    .Select(p => p.Id)
                    .Take(limit - sortedIds.Count)
                    .ToListAsync();
                sortedIds.AddRange(backupIds);
            }

            return await _context.Products
                .Include(p => p.ProductVariants)
                .Include(p => p.Brand)
                .Where(p => sortedIds.Contains(p.Id) && !p.IsDeleted)
                .ToListAsync();
        }
    }
}
