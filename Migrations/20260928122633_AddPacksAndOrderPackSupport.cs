using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MakninouAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPacksAndOrderPackSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "OrderItems",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "ItemName",
                table: "OrderItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "PackId",
                table: "OrderItems",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Packs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PackName = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    PackPriceDZD = table.Column<int>(type: "integer", nullable: false),
                    OriginalPriceDZD = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Packs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PackItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PackId = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PackItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PackItems_Packs_PackId",
                        column: x => x.PackId,
                        principalTable: "Packs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PackItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_PackId",
                table: "OrderItems",
                column: "PackId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_OrderItem_ProductOrPack",
                table: "OrderItems",
                sql: "(\"ProductId\" IS NOT NULL AND \"PackId\" IS NULL) OR (\"ProductId\" IS NULL AND \"PackId\" IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_PackItems_PackId_ProductId",
                table: "PackItems",
                columns: new[] { "PackId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PackItems_ProductId",
                table: "PackItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Packs_PackName",
                table: "Packs",
                column: "PackName",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Packs_PackId",
                table: "OrderItems",
                column: "PackId",
                principalTable: "Packs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Packs_PackId",
                table: "OrderItems");

            migrationBuilder.DropTable(
                name: "PackItems");

            migrationBuilder.DropTable(
                name: "Packs");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_PackId",
                table: "OrderItems");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OrderItem_ProductOrPack",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "ItemName",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "PackId",
                table: "OrderItems");

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "OrderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
