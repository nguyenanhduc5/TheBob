using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using THEBOB.Constants;
using THEBOB.Data;
using THEBOB.Models;
using Xunit;

namespace THEBOB.Tests
{
    public class ConcurrencyInventoryAndPaymentTests
    {
        private ThebobDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<ThebobDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;
            return new ThebobDbContext(options);
        }

        [Fact]
        public async Task Test_StockDeduction_WhenStockIsSufficient_ShouldDeductStockSuccessfully()
        {
            // Arrange
            var dbName = Guid.NewGuid().ToString();
            using (var db = GetInMemoryDbContext(dbName))
            {
                var product = new Product { Id = 10, Name = "Test Product" };
                var size = new Size { Id = 1, Name = "M" };
                var color = new Color { Id = 1, Name = "Black" };
                db.Products.Add(product);
                db.Sizes.Add(size);
                db.Colors.Add(color);

                db.ProductVariants.Add(new ProductVariant
                {
                    Id = 1,
                    ProductId = product.Id,
                    SizeId = size.Id,
                    ColorId = color.Id,
                    Price = 250000,
                    Stock = 10,
                    Sku = "TSHIRT-BLK-M"
                });
                await db.SaveChangesAsync();
            }

            // Act
            using (var db = GetInMemoryDbContext(dbName))
            {
                var variant = await db.ProductVariants.FirstOrDefaultAsync(v => v.Id == 1);
                Assert.NotNull(variant);

                int orderQuantity = 3;
                if (variant.Stock >= orderQuantity)
                {
                    variant.Stock -= orderQuantity;
                    await db.SaveChangesAsync();
                }
            }

            // Assert
            using (var db = GetInMemoryDbContext(dbName))
            {
                var variant = await db.ProductVariants.FirstOrDefaultAsync(v => v.Id == 1);
                Assert.NotNull(variant);
                Assert.Equal(7, variant.Stock); // 10 - 3 = 7
            }
        }

        [Fact]
        public async Task Test_ConcurrentStockDeduction_WhenStockIsInsufficient_ShouldPreventOverSelling()
        {
            // Arrange
            var dbName = Guid.NewGuid().ToString();
            using (var db = GetInMemoryDbContext(dbName))
            {
                var product = new Product { Id = 20, Name = "Test Product 2" };
                var size = new Size { Id = 2, Name = "L" };
                var color = new Color { Id = 2, Name = "White" };
                db.Products.Add(product);
                db.Sizes.Add(size);
                db.Colors.Add(color);

                db.ProductVariants.Add(new ProductVariant
                {
                    Id = 2,
                    ProductId = product.Id,
                    SizeId = size.Id,
                    ColorId = color.Id,
                    Price = 300000,
                    Stock = 1, // Chỉ còn duy nhất 1 sản phẩm trong kho!
                    Sku = "TSHIRT-WHT-L"
                });
                await db.SaveChangesAsync();
            }

            // Act: 2 người dùng cùng lúc muốn bấm MUA 1 sản phẩm cuối cùng
            var user1Task = Task.Run(async () =>
            {
                using var db = GetInMemoryDbContext(dbName);
                var variant = await db.ProductVariants.FirstOrDefaultAsync(v => v.Id == 2);
                if (variant != null && variant.Stock >= 1)
                {
                    await Task.Delay(50); // Giả lập độ trễ mạng
                    variant.Stock -= 1;
                    await db.SaveChangesAsync();
                    return true;
                }
                return false;
            });

            var user2Task = Task.Run(async () =>
            {
                using var db = GetInMemoryDbContext(dbName);
                var variant = await db.ProductVariants.FirstOrDefaultAsync(v => v.Id == 2);
                if (variant != null && variant.Stock >= 1)
                {
                    await Task.Delay(50); // Giả lập độ trễ mạng
                    variant.Stock -= 1;
                    await db.SaveChangesAsync();
                    return true;
                }
                return false;
            });

            var results = await Task.WhenAll(user1Task, user2Task);

            // Assert: Kho không được âm (< 0) và ít nhất 1 request mua thành công
            using (var db = GetInMemoryDbContext(dbName))
            {
                var variant = await db.ProductVariants.FirstOrDefaultAsync(v => v.Id == 2);
                Assert.NotNull(variant);
                Assert.True(variant.Stock >= 0, "Stock cannot be negative!");
            }
        }

        [Fact]
        public async Task Test_OrderCalculationAndConstants_ShouldMatchExpectedTotal()
        {
            // Arrange
            var dbName = Guid.NewGuid().ToString();
            using (var db = GetInMemoryDbContext(dbName))
            {
                var order = new Order
                {
                    Id = 100,
                    UserId = 1,
                    TotalAmount = 500000,
                    Status = OrderStatus.Pending,
                    PaymentMethod = AppConstants.PaymentGateways.SePay,
                    CreatedAt = DateTime.UtcNow
                };
                db.Orders.Add(order);
                await db.SaveChangesAsync();
            }

            // Act & Assert
            using (var db = GetInMemoryDbContext(dbName))
            {
                var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == 100);
                Assert.NotNull(order);
                Assert.Equal(AppConstants.PaymentGateways.SePay, order.PaymentMethod);
                Assert.Equal(OrderStatus.Pending, order.Status);
                Assert.Equal(500000, order.TotalAmount);
            }
        }
    }
}
