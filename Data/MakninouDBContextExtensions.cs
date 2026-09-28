using Microsoft.EntityFrameworkCore;
using System.Runtime.CompilerServices;

namespace MakninouAPI.Data;

public static class MakninouDBContextExtensions
{
    public static IServiceCollection addMakninouDbContext(this IServiceCollection collection, string connectionString)
    {
        collection.AddDbContext<MakninouDBContext>(options => options.UseNpgsql(connectionString), contextLifetime: ServiceLifetime.Scoped, optionsLifetime: ServiceLifetime.Scoped);

        return collection;

    }
}
