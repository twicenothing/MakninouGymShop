using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MakninouAPI.Data;

// EF commands need database configuration, but must not start authentication or email workers.
public sealed class MakninouDBContextFactory : IDesignTimeDbContextFactory<MakninouDBContext>
{
    public MakninouDBContext CreateDbContext(string[] args)
    {
        // Use the same JSON, environment, user-secret and command-line configuration as the API.
        var builder = WebApplication.CreateBuilder(args);
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Configure ConnectionStrings:DefaultConnection for database commands.");

        var options = new DbContextOptionsBuilder<MakninouDBContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new MakninouDBContext(options);
    }
}
