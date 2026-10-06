using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace THEBOB.Migrations
{
    /// <inheritdoc />
    public partial class AddIdempotentRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS `IdempotentRequests` (
                    `Id` bigint NOT NULL AUTO_INCREMENT,
                    `Key` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `UserId` int NULL,
                    `Path` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
                    `Method` varchar(10) CHARACTER SET utf8mb4 NOT NULL,
                    `RequestHash` varchar(64) CHARACTER SET utf8mb4 NULL,
                    `Status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
                    `StatusCode` int NULL,
                    `ResponseBody` longtext CHARACTER SET utf8mb4 NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NOT NULL,
                    `ExpiresAt` datetime(6) NOT NULL,
                    CONSTRAINT `PK_IdempotentRequests` PRIMARY KEY (`Id`),
                    INDEX `IX_IdempotentRequests_ExpiresAt` (`ExpiresAt`),
                    UNIQUE INDEX `IX_IdempotentRequests_Key_UserId` (`Key`, `UserId`)
                ) CHARACTER SET=utf8mb4;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IdempotentRequests");
        }
    }
}
