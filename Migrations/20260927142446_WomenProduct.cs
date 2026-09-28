using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MakninouAPI.Migrations
{
    /// <inheritdoc />
    public partial class WomenProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsWomenProduct",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsWomenProduct",
                table: "Products");
        }
    }
}
