using System;
using System.Collections.Generic;
using System.Linq;

namespace THEBOB.Services.Recommendation
{
    public class HuiTransaction
    {
        public int Id { get; set; }
        public Dictionary<int, decimal> ItemUtilities { get; set; } = new();
        public decimal TransactionUtility { get; set; }
    }

    public class Element
    {
        public int Tid { get; set; }
        public decimal Iu { get; set; } // Item utility
        public decimal Ru { get; set; } // Remaining utility
    }

    public class UtilityList
    {
        public int Item { get; set; }
        public List<Element> Elements { get; set; } = new();
        public decimal SumIUs { get; set; } // Sum of internal utilities
        public decimal SumRUs { get; set; } // Sum of remaining utilities
    }

    public class HighUtilityItemset
    {
        public List<int> Itemset { get; set; } = new();
        public decimal Utility { get; set; }
        public double Support { get; set; }
    }

    public class FhmEngine
    {
        public static List<HighUtilityItemset> Mine(
            List<HuiTransaction> transactions,
            decimal minUtil,
            double totalTxCount)
        {
            var result = new List<HighUtilityItemset>();
            if (!transactions.Any()) return result;

            // 1. Calculate TWU of each item
            var itemTWUs = new Dictionary<int, decimal>();
            var itemCounts = new Dictionary<int, int>();

            foreach (var tx in transactions)
            {
                foreach (var item in tx.ItemUtilities.Keys)
                {
                    if (!itemTWUs.ContainsKey(item)) itemTWUs[item] = 0;
                    itemTWUs[item] += tx.TransactionUtility;

                    if (!itemCounts.ContainsKey(item)) itemCounts[item] = 0;
                    itemCounts[item]++;
                }
            }

            // Filter items with TWU >= minUtil
            var activeItems = itemTWUs
                .Where(x => x.Value >= minUtil)
                .Select(x => x.Key)
                .OrderBy(x => itemTWUs[x]) // Order by TWU ascending (heuristic for FHM)
                .ToList();

            if (!activeItems.Any()) return result;

            // 2. Build EUCS (Estimated Utility Co-occurrence Structure)
            // EUCS maps (item1, item2) -> sum of TUs where both appear
            var eucs = new Dictionary<int, Dictionary<int, decimal>>();
            foreach (var tx in transactions)
            {
                var txItems = tx.ItemUtilities.Keys.Where(x => activeItems.Contains(x)).ToList();
                for (int i = 0; i < txItems.Count; i++)
                {
                    int itemA = txItems[i];
                    if (!eucs.ContainsKey(itemA)) eucs[itemA] = new();
                    for (int j = i + 1; j < txItems.Count; j++)
                    {
                        int itemB = txItems[j];
                        if (!eucs[itemA].ContainsKey(itemB)) eucs[itemA][itemB] = 0;
                        eucs[itemA][itemB] += tx.TransactionUtility;
                    }
                }
            }

            // 3. Build Utility Lists for 1-itemsets
            var uls = new Dictionary<int, UtilityList>();
            foreach (var item in activeItems)
            {
                uls[item] = new UtilityList { Item = item };
            }

            // Populate 1-itemset Utility Lists
            foreach (var tx in transactions)
            {
                // Sort items in transaction by TWU ascending
                var sortedTxItems = tx.ItemUtilities.Keys
                    .Where(x => activeItems.Contains(x))
                    .OrderBy(x => itemTWUs[x])
                    .ToList();

                for (int i = 0; i < sortedTxItems.Count; i++)
                {
                    int item = sortedTxItems[i];
                    decimal itemUtil = tx.ItemUtilities[item];

                    // Calculate remaining utility
                    decimal remainingUtil = 0;
                    for (int j = i + 1; j < sortedTxItems.Count; j++)
                    {
                        remainingUtil += tx.ItemUtilities[sortedTxItems[j]];
                    }

                    uls[item].Elements.Add(new Element
                    {
                        Tid = tx.Id,
                        Iu = itemUtil,
                        Ru = remainingUtil
                    });
                    uls[item].SumIUs += itemUtil;
                    uls[item].SumRUs += remainingUtil;
                }
            }

            // 4. Recursive search
            Search(new List<int>(), null, uls, minUtil, eucs, totalTxCount, result);

            return result;
        }

        private static void Search(
            List<int> prefix,
            UtilityList? pUL,
            Dictionary<int, UtilityList> extensionULs,
            decimal minUtil,
            Dictionary<int, Dictionary<int, decimal>> eucs,
            double totalTxCount,
            List<HighUtilityItemset> results)
        {
            var items = extensionULs.Keys.ToList();

            for (int i = 0; i < items.Count; i++)
            {
                int itemX = items[i];
                UtilityList ulX = extensionULs[itemX];

                // If sum of internal utilities >= minUtil, it is a HUI
                if (ulX.SumIUs >= minUtil)
                {
                    var newItemset = new List<int>(prefix) { itemX };
                    results.Add(new HighUtilityItemset
                    {
                        Itemset = newItemset,
                        Utility = ulX.SumIUs,
                        Support = (double)ulX.Elements.Count / totalTxCount
                    });
                }

                // If sum of internal and remaining utilities >= minUtil, explore extensions
                if (ulX.SumIUs + ulX.SumRUs >= minUtil)
                {
                    var nextExtensionULs = new Dictionary<int, UtilityList>();

                    for (int j = i + 1; j < items.Count; j++)
                    {
                        int itemY = items[j];

                        // FHM Pruning using EUCS
                        decimal pairTWU = GetEUCSValue(eucs, itemX, itemY);
                        if (pairTWU < minUtil)
                        {
                            continue; // Pruned!
                        }

                        // Join utility lists
                        UtilityList ulXY = Construct(pUL, ulX, extensionULs[itemY]);
                        nextExtensionULs[itemY] = ulXY;
                    }

                    var newPrefix = new List<int>(prefix) { itemX };
                    Search(newPrefix, ulX, nextExtensionULs, minUtil, eucs, totalTxCount, results);
                }
            }
        }

        private static decimal GetEUCSValue(
            Dictionary<int, Dictionary<int, decimal>> eucs,
            int itemA,
            int itemB)
        {
            int minItem = Math.Min(itemA, itemB);
            int maxItem = Math.Max(itemA, itemB);

            if (eucs.TryGetValue(minItem, out var subDict) && subDict.TryGetValue(maxItem, out decimal twu))
            {
                return twu;
            }
            return 0;
        }

        private static UtilityList Construct(UtilityList? pUL, UtilityList ulX, UtilityList ulY)
        {
            var ulXY = new UtilityList { Item = ulY.Item };

            // Join elements
            int idxX = 0;
            int idxY = 0;

            while (idxX < ulX.Elements.Count && idxY < ulY.Elements.Count)
            {
                var elX = ulX.Elements[idxX];
                var elY = ulY.Elements[idxY];

                if (elX.Tid == elY.Tid)
                {
                    if (pUL == null)
                    {
                        // 2-itemset join
                        ulXY.Elements.Add(new Element
                        {
                            Tid = elX.Tid,
                            Iu = elX.Iu + elY.Iu,
                            Ru = elY.Ru
                        });
                        ulXY.SumIUs += elX.Iu + elY.Iu;
                        ulXY.SumRUs += elY.Ru;
                    }
                    else
                    {
                        // 3-itemset (or more) join: need to subtract prefix utility
                        var elP = pUL.Elements.FirstOrDefault(e => e.Tid == elX.Tid);
                        if (elP != null)
                        {
                            ulXY.Elements.Add(new Element
                            {
                                Tid = elX.Tid,
                                Iu = elX.Iu + elY.Iu - elP.Iu,
                                Ru = elY.Ru
                            });
                            ulXY.SumIUs += elX.Iu + elY.Iu - elP.Iu;
                            ulXY.SumRUs += elY.Ru;
                        }
                    }
                    idxX++;
                    idxY++;
                }
                else if (elX.Tid < elY.Tid)
                {
                    idxX++;
                }
                else
                {
                    idxY++;
                }
            }

            return ulXY;
        }
    }
}
