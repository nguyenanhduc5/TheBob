using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace THEBOB.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSepayPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentProvider",
                table: "PaymentTransactions",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TransactionId",
                table: "PaymentTransactions",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "VaNumber",
                table: "PaymentTransactions",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "WebhookPayload",
                table: "PaymentTransactions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_TransactionId",
                table: "PaymentTransactions",
                column: "TransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_VaNumber",
                table: "PaymentTransactions",
                column: "VaNumber");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PaymentTransactions_TransactionId",
                table: "PaymentTransactions");

            migrationBuilder.DropIndex(
                name: "IX_PaymentTransactions_VaNumber",
                table: "PaymentTransactions");

            migrationBuilder.DropColumn(
                name: "PaymentProvider",
                table: "PaymentTransactions");

            migrationBuilder.DropColumn(
                name: "TransactionId",
                table: "PaymentTransactions");

            migrationBuilder.DropColumn(
                name: "VaNumber",
                table: "PaymentTransactions");

            migrationBuilder.DropColumn(
                name: "WebhookPayload",
                table: "PaymentTransactions");
        }
    }
}
