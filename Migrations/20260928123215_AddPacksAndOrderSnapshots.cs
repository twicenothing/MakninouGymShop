using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MakninouAPI.Migrations;

public partial class AddPacksAndOrderSnapshots : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Pack tables are created by AddPacksAndOrderPackSupport. This migration repairs data only.
        migrationBuilder.Sql("""
            UPDATE "Products" SET "ProductCategory" = 'Proteine' WHERE "ProductCategory" = 'Complement';
            UPDATE "Products" SET "ProductCategory" = 'Vitamin' WHERE "ProductCategory" = 'Vitamine';
            UPDATE "OrderItems" AS i SET "ItemName" = p."ProductName"
            FROM "Products" AS p WHERE i."ProductId" = p."Id" AND i."ItemName" = '';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // The old Complement category cannot be distinguished from newly created Proteine products.
        throw new System.NotSupportedException("Category reclassification is irreversible. Restore a backup to roll back this data migration.");
    }
}