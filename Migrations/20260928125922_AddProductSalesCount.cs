using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MakninouAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddProductSalesCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "SalesCount",
                table: "Products",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            // Preserve the measurable part of existing sales history. Historical pack
            // components cannot be reconstructed safely because pack contents can change.
            migrationBuilder.Sql("""
                UPDATE "Products" AS p
                SET "SalesCount" = history."Quantity"
                FROM (
                    SELECT "ProductId", SUM("Quantity")::bigint AS "Quantity"
                    FROM "OrderItems"
                    WHERE "ProductId" IS NOT NULL
                    GROUP BY "ProductId"
                ) AS history
                WHERE p."Id" = history."ProductId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SalesCount",
                table: "Products");
        }
    }
}
