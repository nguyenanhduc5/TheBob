using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;
using THEBOB.Data;

#nullable disable

namespace THEBOB.Migrations
{
    [DbContext(typeof(ThebobDbContext))]
    [Migration("20260910000000_AddKafkaOutbox")]
    public partial class AddKafkaOutbox : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OutboxMessages",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Type = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    AggregateId = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    Payload = table.Column<string>(type: "longtext", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table => table.PrimaryKey("PK_OutboxMessages", x => x.Id));

            migrationBuilder.CreateIndex(name: "IX_OutboxMessages_PublishedAt_OccurredAt", table: "OutboxMessages", columns: new[] { "PublishedAt", "OccurredAt" });
            migrationBuilder.CreateIndex(name: "IX_OutboxMessages_Type_AggregateId", table: "OutboxMessages", columns: new[] { "Type", "AggregateId" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "OutboxMessages");
        }
    }
}
