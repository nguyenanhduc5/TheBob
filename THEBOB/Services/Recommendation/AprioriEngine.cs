using System;
using System.Collections.Generic;
using System.Linq;

namespace THEBOB.Services.Recommendation
{
    public class AprioriRule
    {
        public List<int> Antecedent { get; set; } = new();
        public List<int> Consequent { get; set; } = new();
        public double Support { get; set; }
        public double Confidence { get; set; }
        public double Lift { get; set; }
        public double Conviction { get; set; }
    }

    public class AprioriEngine
    {
        public static (List<List<int>> FrequentItemsets, List<AprioriRule> Rules) Mine(
            List<HashSet<int>> transactions,
            double minSupport,
            double minConfidence)
        {
            int n = transactions.Count;
            if (n == 0) return (new(), new());

            var frequentItemsets = new List<List<int>>();
            var rules = new List<AprioriRule>();

            // 1. Find frequent 1-itemsets
            var itemCounts = new Dictionary<int, int>();
            foreach (var t in transactions)
            {
                foreach (var item in t)
                {
                    if (!itemCounts.ContainsKey(item)) itemCounts[item] = 0;
                    itemCounts[item]++;
                }
            }

            var L1 = itemCounts
                .Where(kvp => (double)kvp.Value / n >= minSupport)
                .Select(kvp => new List<int> { kvp.Key })
                .ToList();

            if (!L1.Any()) return (new(), new());

            var L = new List<List<List<int>>> { L1 };
            frequentItemsets.AddRange(L1);

            int k = 2;
            while (true)
            {
                var prevL = L[k - 2];
                var candidates = GenerateCandidates(prevL, k);
                if (!candidates.Any()) break;

                // Count supports
                var candCounts = new Dictionary<string, int>();
                var candList = candidates.Select(c => (Candidate: c, Key: string.Join(",", c.OrderBy(x => x)))).ToList();

                foreach (var t in transactions)
                {
                    foreach (var cand in candList)
                    {
                        if (cand.Candidate.All(item => t.Contains(item)))
                        {
                            if (!candCounts.ContainsKey(cand.Key)) candCounts[cand.Key] = 0;
                            candCounts[cand.Key]++;
                        }
                    }
                }

                var Lk = candList
                    .Where(cand => candCounts.ContainsKey(cand.Key) && (double)candCounts[cand.Key] / n >= minSupport)
                    .Select(cand => cand.Candidate)
                    .ToList();

                if (!Lk.Any()) break;

                L.Add(Lk);
                frequentItemsets.AddRange(Lk);
                k++;
            }

            // Generate association rules from frequent itemsets of size >= 2
            var allItemsetSupports = new Dictionary<string, double>();
            // Count supports for all frequent itemsets to avoid re-scanning
            foreach (var itemset in frequentItemsets)
            {
                string key = string.Join(",", itemset.OrderBy(x => x));
                int count = transactions.Count(t => itemset.All(item => t.Contains(item)));
                allItemsetSupports[key] = (double)count / n;
            }

            foreach (var itemset in frequentItemsets.Where(x => x.Count >= 2))
            {
                string itemsetKey = string.Join(",", itemset.OrderBy(x => x));
                double supportXY = allItemsetSupports[itemsetKey];

                // Generate subsets
                var subsets = GetSubsets(itemset);
                foreach (var antecedent in subsets)
                {
                    if (!antecedent.Any() || antecedent.Count == itemset.Count) continue;

                    var consequent = itemset.Except(antecedent).ToList();
                    string antKey = string.Join(",", antecedent.OrderBy(x => x));
                    string consKey = string.Join(",", consequent.OrderBy(x => x));

                    if (allItemsetSupports.TryGetValue(antKey, out double supportX) && 
                        allItemsetSupports.TryGetValue(consKey, out double supportY))
                    {
                        double confidence = supportXY / supportX;
                        if (confidence >= minConfidence)
                        {
                            double lift = confidence / supportY;
                            double conviction = (1 - supportY) / (1 - confidence + 1e-9);

                            rules.Add(new AprioriRule
                            {
                                Antecedent = antecedent,
                                Consequent = consequent,
                                Support = supportXY,
                                Confidence = confidence,
                                Lift = lift,
                                Conviction = conviction
                            });
                        }
                    }
                }
            }

            return (frequentItemsets, rules);
        }

        private static List<List<int>> GenerateCandidates(List<List<int>> prevL, int k)
        {
            var candidates = new List<List<int>>();
            int len = prevL.Count;

            for (int i = 0; i < len; i++)
            {
                for (int j = i + 1; j < len; j++)
                {
                    var l1 = prevL[i];
                    var l2 = prevL[j];

                    // Join if first k-2 elements are identical
                    bool joinable = true;
                    for (int m = 0; m < k - 2; m++)
                    {
                        if (l1[m] != l2[m])
                        {
                            joinable = false;
                            break;
                        }
                    }

                    if (joinable)
                    {
                        var candidate = l1.Union(l2).OrderBy(x => x).ToList();
                        if (candidate.Count == k)
                        {
                            // Prune candidate if any subset of size k-1 is not frequent
                            if (HasFrequentSubsets(candidate, prevL, k))
                            {
                                candidates.Add(candidate);
                            }
                        }
                    }
                }
            }

            return candidates;
        }

        private static bool HasFrequentSubsets(List<int> candidate, List<List<int>> prevL, int k)
        {
            var subsets = GetSubsetsOfSize(candidate, k - 1);
            foreach (var subset in subsets)
            {
                bool isFrequent = prevL.Any(item => item.SequenceEqual(subset.OrderBy(x => x)));
                if (!isFrequent) return false;
            }
            return true;
        }

        private static List<List<int>> GetSubsetsOfSize(List<int> list, int size)
        {
            var result = new List<List<int>>();
            GetSubsetsOfSizeHelper(list, size, 0, new List<int>(), result);
            return result;
        }

        private static void GetSubsetsOfSizeHelper(List<int> list, int size, int index, List<int> current, List<List<int>> result)
        {
            if (current.Count == size)
            {
                result.Add(new List<int>(current));
                return;
            }
            for (int i = index; i < list.Count; i++)
            {
                current.Add(list[i]);
                GetSubsetsOfSizeHelper(list, size, i + 1, current, result);
                current.RemoveAt(current.Count - 1);
            }
        }

        private static List<List<int>> GetSubsets(List<int> list)
        {
            var subsets = new List<List<int>>();
            int subsetCount = 1 << list.Count;
            for (int i = 0; i < subsetCount; i++)
            {
                var subset = new List<int>();
                for (int bit = 0; bit < list.Count; bit++)
                {
                    if ((i & (1 << bit)) != 0)
                    {
                        subset.Add(list[bit]);
                    }
                }
                subsets.Add(subset);
            }
            return subsets;
        }
    }
}
