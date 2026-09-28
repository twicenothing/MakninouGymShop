using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MakninouAPI.Auth;
using MakninouAPI.Data;
using MakninouAPI.Models;
using MakninouAPI.DTOs;
using MakninouAPI.Notifications;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
var signingKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
// Environment variables are isolated to this verification process.
Environment.SetEnvironmentVariable("Jwt__SigningKey", signingKey);
Environment.SetEnvironmentVariable("Jwt__Issuer", "MakninouAPI");
Environment.SetEnvironmentVariable("Jwt__Audience", "MakninouAdmin");
Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", "Host=localhost;Database=unused;Username=unused");

using var connection = new SqliteConnection("Data Source=:memory:");
connection.Open();
using var factory = new WebApplicationFactory<AdminAuthentication>().WithWebHostBuilder(builder =>
{
    builder.UseEnvironment("Development");
    builder.UseContentRoot(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../")));
    builder.ConfigureServices(services =>
    {
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        services.RemoveAll<MakninouDBContext>();
        services.RemoveAll<DbContextOptions<MakninouDBContext>>();
        services.RemoveAll<IDbContextOptionsConfiguration<MakninouDBContext>>();
        services.AddDbContext<MakninouDBContext>(options => options.UseSqlite(connection));
        services.RemoveAll<IOrderNotificationPublisher>();
        services.AddSingleton<IOrderNotificationPublisher, TestNotificationPublisher>();
    });
});

using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
{
    BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false
});

using (var scope = factory.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<MakninouDBContext>().Database.EnsureCreated();

async Task CheckSetup(string newPassword, HttpStatusCode expected)
{
    using var request = new HttpRequestMessage(HttpMethod.Post, "/admin/setup")
    {
        Content = JsonContent.Create(new AdminLoginRequest("test-admin", newPassword))
    };
    using var response = await client.SendAsync(request);
    if (response.StatusCode != expected) throw new Exception($"Setup: expected {expected}, got {response.StatusCode}");
    if ((await response.Content.ReadAsStringAsync()).Contains("passwordHash", StringComparison.OrdinalIgnoreCase))
        throw new Exception("Setup exposed the password hash.");
}
await CheckSetup("short", HttpStatusCode.BadRequest);
await CheckSetup(password, HttpStatusCode.Created);
await CheckSetup(password, HttpStatusCode.Conflict);
using (var scope = factory.Services.CreateScope())
{
    var admin = scope.ServiceProvider.GetRequiredService<MakninouDBContext>().Admins.Single();
    if (admin.PasswordHash == password
        || new PasswordHasher<object>().VerifyHashedPassword(new object(), admin.PasswordHash, password)
            == PasswordVerificationResult.Failed)
        throw new Exception("Admin password was not hashed correctly.");
}
var routes = new[]
{
    (HttpMethod.Post, "/products"), (HttpMethod.Put, "/products/1"),
    (HttpMethod.Delete, "/products/1"), (HttpMethod.Patch, "/products/1/stock"),
    (HttpMethod.Put, "/products/1/image"), (HttpMethod.Delete, "/products/1/image")
    , (HttpMethod.Get, "/orders"), (HttpMethod.Patch, "/orders/1/confirm"),
    (HttpMethod.Patch, "/orders/1/cancel"), (HttpMethod.Patch, "/orders/1/delivered"),
    (HttpMethod.Get, "/packs/all"), (HttpMethod.Post, "/packs"), (HttpMethod.Put, "/packs/1"),
    (HttpMethod.Patch, "/packs/1/active?isActive=false"), (HttpMethod.Delete, "/packs/1")
};
async Task Check(HttpMethod method, string path, HttpStatusCode expected, string? token = null)
{
    using var request = new HttpRequestMessage(method, path) { Content = JsonContent.Create(new { }) };
    if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    using var response = await client.SendAsync(request);
    if (response.StatusCode != expected)
        throw new Exception($"{method} {path}: expected {expected}, got {response.StatusCode}");
}

string Token(string role, string key, DateTime expires, string audience = "MakninouAdmin", string issuer = "MakninouAPI") =>
    new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(issuer, audience,
        [new Claim("sub", "test-user"), new Claim("role", role)],
        DateTime.UtcNow.AddHours(-2), expires,
        new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256)));

foreach (var (method, path) in routes)
{
    await Check(method, path, HttpStatusCode.Unauthorized);
    await Check(method, path, HttpStatusCode.Unauthorized, "invalid-token");
    await Check(method, path, HttpStatusCode.Forbidden, Token("Customer", signingKey, DateTime.UtcNow.AddMinutes(5)));
    await Check(method, path, HttpStatusCode.Unauthorized, Token("Admin", signingKey, DateTime.UtcNow.AddMinutes(-5)));
    await Check(method, path, HttpStatusCode.Unauthorized, Token("Admin", new string('x', 64), DateTime.UtcNow.AddMinutes(5)));
    await Check(method, path, HttpStatusCode.Unauthorized, Token("Admin", signingKey, DateTime.UtcNow.AddMinutes(5), "wrong-audience"));
    await Check(method, path, HttpStatusCode.Unauthorized, Token("Admin", signingKey, DateTime.UtcNow.AddMinutes(5), issuer: "wrong-issuer"));
}

using var wrongLogin = await client.PostAsJsonAsync("/admin/login", new AdminLoginRequest("test-admin", "wrong-password"));
if (wrongLogin.StatusCode != HttpStatusCode.Unauthorized) throw new Exception("Wrong password accepted.");
using var wrongUser = await client.PostAsJsonAsync("/admin/login", new AdminLoginRequest("unknown", password));
if (wrongUser.StatusCode != HttpStatusCode.Unauthorized) throw new Exception("Unknown username accepted.");
using var login = await client.PostAsJsonAsync("/admin/login", new AdminLoginRequest("test-admin", password));
login.EnsureSuccessStatusCode();
var tokenResponse = (await login.Content.ReadFromJsonAsync<AdminTokenResponse>())!;
if (tokenResponse.ExpiresIn != 3600 || tokenResponse.TokenType != "Bearer") throw new Exception("Unexpected token response.");
// Validation fails before database access, proving the authorized routes are reached safely.
await Check(HttpMethod.Post, "/products", HttpStatusCode.BadRequest, tokenResponse.AccessToken);
await Check(HttpMethod.Put, "/products/1", HttpStatusCode.BadRequest, tokenResponse.AccessToken);
await Check(HttpMethod.Patch, "/products/1/stock", HttpStatusCode.BadRequest, tokenResponse.AccessToken);
await Check(HttpMethod.Put, "/products/1/image", HttpStatusCode.BadRequest, tokenResponse.AccessToken);
await Check(HttpMethod.Get, "/orders", HttpStatusCode.OK, tokenResponse.AccessToken);
foreach (var action in new[] { "confirm", "cancel", "delivered" })
    await Check(HttpMethod.Patch, $"/orders/999/{action}", HttpStatusCode.NotFound, tokenResponse.AccessToken);
await Check(HttpMethod.Get, "/products?category=invalid", HttpStatusCode.BadRequest);
await Check(HttpMethod.Post, "/orders", HttpStatusCode.BadRequest);

// Pack and mixed-order integration checks: isolated SQLite only; notification publisher is a no-op.
using (var scope = factory.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MakninouDBContext>();
    db.Products.AddRange(
        new Product { Id=1, ProductName="Test protein", Description="Test", ProductCategory=ProductCategory.Proteine, ProductUnitPriceDZD=1000, StockQuantity=10 },
        new Product { Id=2, ProductName="Test creatine", Description="Test", ProductCategory=ProductCategory.Creatine, ProductUnitPriceDZD=2000, StockQuantity=10 });
    await db.SaveChangesAsync();
}
await Check(HttpMethod.Get, "/products", HttpStatusCode.OK);
await Check(HttpMethod.Get, "/products/1", HttpStatusCode.OK);
await Check(HttpMethod.Get, "/packs", HttpStatusCode.OK);
async Task<HttpResponseMessage> AdminSend(HttpMethod method, string path, object? body = null)
{
    using var request = new HttpRequestMessage(method,path);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer",tokenResponse.AccessToken);
    if (body is not null) request.Content = JsonContent.Create(body);
    return await client.SendAsync(request);
}
var packInput = new PackCreateDTO("Test pack", "Test", 2500, [new(1,2),new(2,1)]);
using var createPack = await AdminSend(HttpMethod.Post,"/packs",packInput);
createPack.EnsureSuccessStatusCode();
var pack = (await createPack.Content.ReadFromJsonAsync<PackResponseDTO>())!;
if (pack.OriginalPriceDZD != 4000 || pack.SavingsDZD != 1500) throw new Exception("Incorrect pack prices.");
using var updatePack = await AdminSend(HttpMethod.Put,$"/packs/{pack.Id}",packInput);
updatePack.EnsureSuccessStatusCode();
using var deactivate = await AdminSend(HttpMethod.Patch,$"/packs/{pack.Id}/active?isActive=false");
deactivate.EnsureSuccessStatusCode();
var publicPacks = (await client.GetFromJsonAsync<List<PackResponseDTO>>("/packs"))!;
if (publicPacks.Count != 0) throw new Exception("Inactive pack leaked into public list.");
using var allPacks = await AdminSend(HttpMethod.Get,"/packs/all");
if ((await allPacks.Content.ReadFromJsonAsync<List<PackResponseDTO>>())?.Count != 1) throw new Exception("Admin cannot see inactive pack.");
OrderCreateDTO Order(params OrderItemCreateDTO[] items) => new("0555000000","Test","Test",items.ToList());
async Task PostOrder(OrderCreateDTO body, HttpStatusCode expected)
{
    using var response = await client.PostAsJsonAsync("/orders",body);
    if (response.StatusCode != expected) throw new Exception($"Order expected {expected}, got {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
    if (expected == HttpStatusCode.Created)
    {
        var result = (await response.Content.ReadFromJsonAsync<OrderResponseDTO>())!;
        if (result.Items.Count != 2 || result.Items[1].ItemName != "Test pack" || result.Items[1].PackId != pack.Id)
            throw new Exception("Incorrect order snapshot/serialization.");
    }
}
await PostOrder(Order(new OrderItemCreateDTO(null,pack.Id,1)),HttpStatusCode.Conflict);
using var activate = await AdminSend(HttpMethod.Patch,$"/packs/{pack.Id}/active?isActive=true");
activate.EnsureSuccessStatusCode();
await PostOrder(Order(new OrderItemCreateDTO(0,pack.Id,1)),HttpStatusCode.BadRequest);
await PostOrder(Order(new OrderItemCreateDTO(1,pack.Id,1)),HttpStatusCode.BadRequest);
await PostOrder(Order(new OrderItemCreateDTO(null,pack.Id,int.MaxValue)),HttpStatusCode.Conflict);
// A direct line fits, but the pack draws on the same product and must roll back all stock.
await PostOrder(Order(new OrderItemCreateDTO(1,null,9),new(null,pack.Id,1)),HttpStatusCode.Conflict);
using (var scope = factory.Services.CreateScope())
    if (await scope.ServiceProvider.GetRequiredService<MakninouDBContext>().Products.AnyAsync(p=>p.StockQuantity!=10 || p.SalesCount!=0))
        throw new Exception("Failed order changed stock or sales count.");
await PostOrder(Order(new OrderItemCreateDTO(1,null,1),new(null,pack.Id,2)),HttpStatusCode.Created);
using (var scope = factory.Services.CreateScope())
{
    var db=scope.ServiceProvider.GetRequiredService<MakninouDBContext>();
    var firstProduct = (await db.Products.FindAsync(1))!;
    var secondProduct = (await db.Products.FindAsync(2))!;
    if (firstProduct.StockQuantity!=5 || secondProduct.StockQuantity!=8 || firstProduct.SalesCount!=5 || secondProduct.SalesCount!=2)
        throw new Exception("Mixed order stock/sales aggregation failed.");
}
using var deletePack = await AdminSend(HttpMethod.Delete,$"/packs/{pack.Id}");
if (deletePack.StatusCode!=HttpStatusCode.Conflict) throw new Exception("An ordered pack was deleted.");
var bestSellers = (await client.GetFromJsonAsync<List<int>>("/products/best-sellers"))!;
if (!bestSellers.SequenceEqual(new[] {1,2}))
    throw new Exception("Best sellers must use persistent product sales counts, including pack components.");
Console.WriteLine("PASS: pack CRUD, inactive visibility, mixed order snapshots, shared stock, overflow and invalid-ID rejection, rollback and deletion protection.");

using (var demoConnection = new SqliteConnection("Data Source=:memory:"))
{
    await demoConnection.OpenAsync();
    var demoOptions = new DbContextOptionsBuilder<MakninouDBContext>().UseSqlite(demoConnection).Options;
    await using var demoDb = new MakninouDBContext(demoOptions);
    await demoDb.Database.EnsureCreatedAsync();
    await DemoCatalogSeeder.SeedAsync(demoDb);
    await DemoCatalogSeeder.SeedAsync(demoDb);
    if (await demoDb.Products.CountAsync() != 14 || await demoDb.Packs.CountAsync() != 4
        || await demoDb.PackItems.CountAsync() != 11)
        throw new Exception("Demo catalog seed is incomplete or not idempotent.");
    if (await demoDb.Products.CountAsync(product => product.SalesCount > 0) != 14)
        throw new Exception("Demo catalog does not populate the best-seller display.");
}
Console.WriteLine("PASS: idempotent demo catalog creates 14 products, 4 packs and display sales counts.");
for (var i = 0; i < 2; i++)
{
    using var attempt = await client.PostAsJsonAsync("/admin/login", new AdminLoginRequest("test-admin", "wrong"));
}
using var limited = await client.PostAsJsonAsync("/admin/login", new AdminLoginRequest("test-admin", password));
if (limited.StatusCode != HttpStatusCode.TooManyRequests) throw new Exception("Login rate limit missing.");
using var productionFactory = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Production"));
using var productionClient = productionFactory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
using var productionSetup = await productionClient.PostAsJsonAsync("/admin/setup", new AdminLoginRequest("other", password));
if (productionSetup.StatusCode != HttpStatusCode.NotFound) throw new Exception("Setup available in Production.");
Console.WriteLine("PASS: first-admin setup, input validation, password hashing, duplicate rejection, production exclusion, database login, JWT validation, admin-only writes, public reads/orders, and rate limiting. Used only an isolated in-memory SQLite database; no email sent.");

sealed class TestNotificationPublisher : IOrderNotificationPublisher
{
    public ValueTask PublishAsync(OrderCreatedEvent order, CancellationToken cancellationToken = default) => ValueTask.CompletedTask;
}
