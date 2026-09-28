using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MakninouAPI.Migrations
{
    /// <inheritdoc />
    public partial class StoreProductCategoryAsString : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Convert existing enum values to names, not numeric strings.
            migrationBuilder.Sql("""
                ALTER TABLE "Products" ALTER COLUMN "ProductCategory" DROP DEFAULT;
                ALTER TABLE "Products" ALTER COLUMN "ProductCategory" TYPE text
                USING CASE "ProductCategory"
                    WHEN 0 THEN 'Complement'
                    WHEN 1 THEN 'Vitamine'
                    ELSE "ProductCategory"::text
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Products" ALTER COLUMN "ProductCategory" DROP DEFAULT;
                ALTER TABLE "Products" ALTER COLUMN "ProductCategory" TYPE integer
                USING CASE "ProductCategory"
                    WHEN 'Complement' THEN 0
                    WHEN 'Vitamine' THEN 1
                    ELSE "ProductCategory"::integer
                END;
                ALTER TABLE "Products" ALTER COLUMN "ProductCategory" SET DEFAULT 0;
                """);
        }
    }
}
