using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Services.Recommendation
{
    public class RecommendationBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<RecommendationBackgroundService> _logger;

        public RecommendationBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<RecommendationBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Yield();
            _logger.LogInformation("Recommendation background mining service is starting. First run delayed 12 hours.");

            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromHours(12), stoppingToken);

                try
                {
                    await RunMiningAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An error occurred during data mining.");
                }
            }
        }

        public async Task RunMiningAsync()
        {
            _logger.LogInformation("Starting Apriori and HUI data mining...");

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();

            var orderRows = await db.OrderItems
                .AsNoTracking()
                .Where(oi =>
                    oi.VariantId != null &&
                    (oi.Order.Status == OrderStatus.Delivered
                     || oi.Order.Status == OrderStatus.Paid
                     || oi.Order.Status == OrderStatus.Processing))
                .Select(oi => new
                {
                    oi.OrderId,
                    ProductId = oi.Variant!.ProductId,
                    oi.Quantity,
                    oi.PricePerItem,
                    oi.CostPerItem
                })
                .ToListAsync();

            var orders = orderRows.GroupBy(x => x.OrderId).ToList();
            if (orders.Count < 2)
            {
                _logger.LogWarning("Not enough orders to run mining (minimum 2). Current count: {Count}", orders.Count);
                return;
            }

            var aprioriTransactions = new List<HashSet<int>>();
            var huiTransactions = new List<HuiTransaction>();

            foreach (var order in orders)
            {
                var itemset = new HashSet<int>();
                var huiItems = new Dictionary<int, decimal>();
                decimal tu = 0;

                foreach (var item in order)
                {
                    int prodId = item.ProductId;
                    itemset.Add(prodId);

                    decimal cost = item.CostPerItem > 0 ? item.CostPerItem : item.PricePerItem * 0.3m;
                    decimal profit = item.PricePerItem - cost;
                    if (profit < 0) profit = 0;

                    decimal utility = item.Quantity * profit;

                    if (!huiItems.ContainsKey(prodId)) huiItems[prodId] = 0;
                    huiItems[prodId] += utility;
                    tu += utility;
                }

                if (itemset.Count > 0)
                {
                    aprioriTransactions.Add(itemset);
                    huiTransactions.Add(new HuiTransaction
                    {
                        Id = order.Key,
                        ItemUtilities = huiItems,
                        TransactionUtility = tu
                    });
                }
            }

            if (aprioriTransactions.Count < 2)
            {
                _logger.LogWarning("Not enough valid transactions containing active variants to run mining.");
                return;
            }

            double totalTxCount = aprioriTransactions.Count;

            // Define dynamic mining parameters
            double minSupport = 0.02; // 2% minimum support (more lenient for smaller databases)
            double minConfidence = 0.05; // 5% minimum confidence
            decimal minUtilPercentage = 0.02m; // 2% of total database utility

            // Calculate total utility
            decimal totalDatabaseUtility = huiTransactions.Sum(t => t.TransactionUtility);
            decimal minUtil = totalDatabaseUtility * minUtilPercentage;

            _logger.LogInformation("Total Transactions: {TxCount}, Total Utility: {TotalUtil}, Min Utility Threshold: {MinUtil}", 
                totalTxCount, totalDatabaseUtility, minUtil);

            // Execute Apriori
            var (frequentItemsets, rules) = AprioriEngine.Mine(aprioriTransactions, minSupport, minConfidence);

            // Execute HUI
            var huiSets = FhmEngine.Mine(huiTransactions, minUtil, totalTxCount);

            // Save results to Database inside a transaction compatible with retry strategy
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var dbTx = await db.Database.BeginTransactionAsync();
                try
                {
                    // Clear old rules and HUI sets
                    db.AssociationRules.RemoveRange(db.AssociationRules);
                    db.HighUtilityItemsets.RemoveRange(db.HighUtilityItemsets);
                    await db.SaveChangesAsync();

                    // Save new association rules
                    var ruleEntities = rules.Select(r => new AssociationRuleEntity
                    {
                        Antecedent = string.Join(",", r.Antecedent),
                        Consequent = string.Join(",", r.Consequent),
                        Support = r.Support,
                        Confidence = r.Confidence,
                        Lift = r.Lift,
                        Conviction = r.Conviction,
                        CreatedAt = DateTime.UtcNow
                    }).ToList();

                    db.AssociationRules.AddRange(ruleEntities);

                    // Save new high utility itemsets
                    var huiEntities = huiSets.Select(h => new HighUtilityItemsetEntity
                    {
                        ItemsetKeys = string.Join(",", h.Itemset),
                        Utility = h.Utility,
                        Support = h.Support,
                        CreatedAt = DateTime.UtcNow
                    }).ToList();

                    db.HighUtilityItemsets.AddRange(huiEntities);

                    await db.SaveChangesAsync();
                    await dbTx.CommitAsync();

                    _logger.LogInformation("Successfully completed mining. Saved {RuleCount} rules and {HuiCount} High Utility Itemsets.", 
                        ruleEntities.Count, huiEntities.Count);
                }
                catch (Exception ex)
                {
                    await dbTx.RollbackAsync();
                    _logger.LogError(ex, "Failed to save mined results to database. Transaction rolled back.");
                    throw;
                }
            });
        }
    }
}
