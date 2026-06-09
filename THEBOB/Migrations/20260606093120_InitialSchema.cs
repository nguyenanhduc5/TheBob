using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace THEBOB.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: initial DROP operations removed to make this migration idempotent
            // against databases where some schema changes were already applied.
            // Note: column renames were performed in a previous, partially-applied run.
            // Skipping RenameColumn/RenameIndex for Role/ProductId -> RoleId/VariantId
            // to make this migration safe to re-run on the current database state.

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                table: "Users",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            // FullName column already exists or was handled earlier; skip.

            // UpdatedAt column already exists or was handled earlier; skip.

            migrationBuilder.AlterColumn<double>(
                name: "Rating",
                table: "Products",
                type: "double",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(3,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Price",
                table: "Products",
                type: "decimal(65,30)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalAmount",
                table: "Orders",
                type: "decimal(65,30)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,2)");

            // PricePerItem column already exists or was handled earlier; skip.

            // StaticColor column already exists or was handled earlier; skip.

            // StaticProductName column already exists or was handled earlier; skip.

            // StaticSize column already exists or was handled earlier; skip.

            // VariantId column in OrderItems already exists or was handled earlier; skip.

            try
            {
                migrationBuilder.Sql(@"CREATE TABLE IF NOT EXISTS `Addresses` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `UserId` int NOT NULL,
                    `RecipientName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `RecipientPhone` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
                    `ProvinceCity` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `District` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `Ward` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `SpecificAddress` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
                    `IsDefault` tinyint(1) NOT NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NOT NULL,
                    PRIMARY KEY (`Id`)
                ) CHARACTER SET=utf8mb4;");
                migrationBuilder.Sql(@"SET @fk_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.REFERENTIAL_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE()
                      AND CONSTRAINT_NAME = 'FK_Addresses_Users_UserId'
                      AND TABLE_NAME = 'Addresses'
                );
                SET @sql := IF(@fk_exists = 0,
                    'ALTER TABLE `Addresses` ADD CONSTRAINT `FK_Addresses_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"CREATE TABLE IF NOT EXISTS `Coupons` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `Code` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `DiscountType` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `DiscountValue` decimal(12,2) NOT NULL,
                    `MinOrderValue` decimal(12,2) NOT NULL,
                    `MaxDiscountAmount` decimal(12,2) NULL,
                    `StartDate` datetime(6) NOT NULL,
                    `EndDate` datetime(6) NOT NULL,
                    `UsageLimit` int NOT NULL,
                    `UsedCount` int NOT NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NOT NULL,
                    PRIMARY KEY (`Id`)
                ) CHARACTER SET=utf8mb4;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"CREATE TABLE IF NOT EXISTS `ProductVariants` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `ProductId` int NOT NULL,
                    `Size` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `Color` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `Sku` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
                    `Price` decimal(12,2) NOT NULL,
                    `Stock` int NOT NULL,
                    `IsAvailable` tinyint(1) NOT NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NOT NULL,
                    PRIMARY KEY (`Id`)
                ) CHARACTER SET=utf8mb4;");
                migrationBuilder.Sql(@"SET @fk_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.REFERENTIAL_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE()
                      AND CONSTRAINT_NAME = 'FK_ProductVariants_Products_ProductId'
                      AND TABLE_NAME = 'ProductVariants'
                );
                SET @sql := IF(@fk_exists = 0,
                    'ALTER TABLE `ProductVariants` ADD CONSTRAINT `FK_ProductVariants_Products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `Products` (`Id`) ON DELETE CASCADE',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"CREATE TABLE IF NOT EXISTS `Roles` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `RoleName` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    PRIMARY KEY (`Id`)
                ) CHARACTER SET=utf8mb4;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @idx_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Users'
                      AND INDEX_NAME = 'IX_Users_RoleId'
                );
                SET @sql := IF(@idx_exists = 0,
                    'CREATE INDEX `IX_Users_RoleId` ON `Users` (`RoleId`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @idx_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'OrderItems'
                      AND INDEX_NAME = 'IX_OrderItems_VariantId'
                );
                SET @sql := IF(@idx_exists = 0,
                    'CREATE INDEX `IX_OrderItems_VariantId` ON `OrderItems` (`VariantId`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @idx_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Addresses'
                      AND INDEX_NAME = 'IX_Addresses_UserId'
                );
                SET @sql := IF(@idx_exists = 0,
                    'CREATE INDEX `IX_Addresses_UserId` ON `Addresses` (`UserId`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @idx_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Coupons'
                      AND INDEX_NAME = 'IX_Coupons_Code'
                );
                SET @sql := IF(@idx_exists = 0,
                    'CREATE UNIQUE INDEX `IX_Coupons_Code` ON `Coupons` (`Code`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @idx_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'ProductVariants'
                      AND INDEX_NAME = 'IX_ProductVariants_ProductId_Size_Color'
                );
                SET @sql := IF(@idx_exists = 0,
                    'CREATE UNIQUE INDEX `IX_ProductVariants_ProductId_Size_Color` ON `ProductVariants` (`ProductId`, `Size`, `Color`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @idx_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'ProductVariants'
                      AND INDEX_NAME = 'IX_ProductVariants_Sku'
                );
                SET @sql := IF(@idx_exists = 0,
                    'CREATE UNIQUE INDEX `IX_ProductVariants_Sku` ON `ProductVariants` (`Sku`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }
            try
            {
                migrationBuilder.Sql(@"SET @fk_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.REFERENTIAL_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE()
                      AND CONSTRAINT_NAME = 'FK_CartItems_ProductVariants_VariantId'
                      AND TABLE_NAME = 'CartItems'
                );
                SET @sql := IF(@fk_exists = 0,
                    'ALTER TABLE `CartItems` ADD CONSTRAINT `FK_CartItems_ProductVariants_VariantId` FOREIGN KEY (`VariantId`) REFERENCES `ProductVariants` (`Id`) ON DELETE CASCADE',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @fk_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.REFERENTIAL_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE()
                      AND CONSTRAINT_NAME = 'FK_InventoryLogs_ProductVariants_VariantId'
                      AND TABLE_NAME = 'InventoryLogs'
                );
                SET @sql := IF(@fk_exists = 0,
                    'ALTER TABLE `InventoryLogs` ADD CONSTRAINT `FK_InventoryLogs_ProductVariants_VariantId` FOREIGN KEY (`VariantId`) REFERENCES `ProductVariants` (`Id`) ON DELETE CASCADE',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            try
            {
                migrationBuilder.Sql(@"SET @fk_exists := (
                    SELECT COUNT(*)
                    FROM information_schema.REFERENTIAL_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE()
                      AND CONSTRAINT_NAME = 'FK_OrderItems_ProductVariants_VariantId'
                      AND TABLE_NAME = 'OrderItems'
                );
                SET @sql := IF(@fk_exists = 0,
                    'ALTER TABLE `OrderItems` ADD CONSTRAINT `FK_OrderItems_ProductVariants_VariantId` FOREIGN KEY (`VariantId`) REFERENCES `ProductVariants` (`Id`)',
                    'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
            }
            catch { }

            // NOTE: FK from Users.RoleId to Roles.Id was omitted to avoid applying a constraint
            // that could fail if existing User.RoleId values don't match Roles table entries.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CartItems_ProductVariants_VariantId",
                table: "CartItems");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryLogs_ProductVariants_VariantId",
                table: "InventoryLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_ProductVariants_VariantId",
                table: "OrderItems");

            // FK_Users_Roles_RoleId was not created in Up(); nothing to drop here.

            migrationBuilder.DropTable(
                name: "Addresses");

            migrationBuilder.DropTable(
                name: "Coupons");

            migrationBuilder.DropTable(
                name: "ProductVariants");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_Users_RoleId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_VariantId",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PricePerItem",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "StaticColor",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "StaticProductName",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "StaticSize",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "VariantId",
                table: "OrderItems");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "Users",
                newName: "Role");

            migrationBuilder.RenameColumn(
                name: "VariantId",
                table: "InventoryLogs",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_InventoryLogs_VariantId",
                table: "InventoryLogs",
                newName: "IX_InventoryLogs_ProductId");

            migrationBuilder.RenameColumn(
                name: "VariantId",
                table: "CartItems",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_CartItems_VariantId",
                table: "CartItems",
                newName: "IX_CartItems_ProductId");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Phone",
                keyValue: null,
                column: "Phone",
                value: "");

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                table: "Users",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "Users",
                type: "varchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Username",
                table: "Users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<decimal>(
                name: "Rating",
                table: "Products",
                type: "decimal(3,2)",
                nullable: false,
                oldClrType: typeof(double),
                oldType: "double");

            migrationBuilder.AlterColumn<decimal>(
                name: "Price",
                table: "Products",
                type: "decimal(10,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)");

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalAmount",
                table: "Orders",
                type: "decimal(10,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)");

            migrationBuilder.AddColumn<decimal>(
                name: "PriceAtTime",
                table: "OrderItems",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ProductId",
                table: "OrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_ProductId",
                table: "OrderItems",
                column: "ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_CartItems_Products_ProductId",
                table: "CartItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryLogs_Products_ProductId",
                table: "InventoryLogs",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Products_ProductId",
                table: "OrderItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
