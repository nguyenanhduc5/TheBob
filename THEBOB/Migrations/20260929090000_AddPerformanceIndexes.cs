using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using THEBOB.Data;

#nullable disable

namespace THEBOB.Migrations
{
    [DbContext(typeof(ThebobDbContext))]
    [Migration("20260929090000_AddPerformanceIndexes")]
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_CreatedAt",
                table: "Notifications",
                columns: new[] { "UserId", "CreatedAt" });
            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications");


            migrationBuilder.CreateIndex(
                name: "IX_CustomerBehaviors_Timestamp_ActionType",
                table: "CustomerBehaviors",
                columns: new[] { "Timestamp", "ActionType" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerBehaviors_UserId_Timestamp",
                table: "CustomerBehaviors",
                columns: new[] { "UserId", "Timestamp" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CustomerBehaviors_UserId_Timestamp",
                table: "CustomerBehaviors");

            migrationBuilder.DropIndex(
                name: "IX_CustomerBehaviors_Timestamp_ActionType",
                table: "CustomerBehaviors");
            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications",
                column: "UserId");
            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_CreatedAt",
                table: "Notifications");

            
        }
    }
}
