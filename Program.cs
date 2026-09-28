using MakninouAPI.Data;
using MakninouAPI.DTOs;
using MakninouAPI.Services;
using MakninouAPI.Notifications;
using System.ComponentModel.DataAnnotations;
using MakninouAPI.Auth;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.EntityFrameworkCore;

if (args.Contains("--hash-admin-password"))
{
    AdminAuthentication.PrintPasswordHash();
    return;
}

var builder = WebApplication.CreateBuilder(args);
AdminAuthentication.Configure(builder);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Configure ConnectionStrings:MakninouDB with your PostgreSQL connection string.");
}

builder.Services.addMakninouDbContext(connectionString);
builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<ProductImageService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddSingleton<OrderNotificationQueue>();
builder.Services.AddSingleton<IOrderNotificationPublisher>(service =>
    service.GetRequiredService<OrderNotificationQueue>());
builder.Services.AddSingleton<IOrderNotificationHandler, EmailNotificationHandler>();
builder.Services.AddHostedService<OrderNotificationWorker>();
builder.Services.AddScoped<PackService>();
// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();


var app = builder.Build();

if (args.Contains("--seed-demo-catalog"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<MakninouDBContext>();
    await db.Database.MigrateAsync();
    await DemoCatalogSeeder.SeedAsync(db);
    Console.WriteLine("Demo catalog ready: products and packs were added without changing existing records.");
    return;
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapTemporaryAdminSetup();

app.MapPost("/admin/login", async (AdminLoginRequest request, AdminAuthentication authentication,
    HttpContext context, MakninouDBContext db, CancellationToken cancellationToken) =>
{
    context.Response.Headers.CacheControl = "no-store";
    var token = await authentication.LoginAsync(request, db, cancellationToken);
    return token is null ? Results.Unauthorized() : Results.Ok(token);
}).AllowAnonymous().RequireRateLimiting("AdminLogin");

var adminProducts = app.MapGroup("/products").RequireAuthorization(AdminAuthentication.Policy);



adminProducts.MapPost("", async Task<IResult> (ProductService service, ProductCreateDTO request) =>
{

    var validationResults = new List<ValidationResult>();
    var validationContext = new ValidationContext(request);

    bool isValid = Validator.TryValidateObject(request, validationContext, validationResults, true);

    if (!isValid)
    {
        return Results.BadRequest(validationResults);
    }


    try
    {
        var product = await service.AddProduct(request);
        if (product == null)
        {
            return Results.InternalServerError();
        }
        return Results.Ok(product);
    }
    catch (DuplicateProductNameException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }

});

app.MapGet("/products/best-sellers", async (ProductService service) =>
    Results.Ok(await service.GetBestSellerIds()));

app.MapGet("/products/{id:int}", async Task<IResult> (ProductService service, int id) =>
{
    var foundProduct = await service.GetProductById(id);
    return foundProduct is null
    ? Results.NotFound(new { error = $"Product {id} was not found." })
    : Results.Ok(foundProduct);

});


app.MapGet("/products", async Task<IResult> (string? category, ProductService service) =>
{
    try
    {
        var products = await service.GetProductsByCategory(category);
        return Results.Ok(products);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapGet("/products/women", async Task<IResult> (ProductService service) =>
{
    var productsList = await service.GetWomenProducts();
    return Results.Ok(productsList);
});

adminProducts.MapPut("/{id:int}", async Task<IResult> (int id, ProductUpdateDTO request, ProductService service) =>
{
    try
    {
        var product = await service.UpdateProduct(id, request);
        return product is null ? Results.NotFound() : Results.Ok(product);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (DuplicateProductNameException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
});

adminProducts.MapPut("/{id:int}/image", async Task<IResult> (int id, HttpRequest request,
    ProductImageService images, CancellationToken cancellationToken) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest(new { error = "Send the image as multipart/form-data using the field named image." });

    var form = await request.ReadFormAsync(cancellationToken);
    var image = form.Files.GetFile("image");
    if (image is null)
        return Results.BadRequest(new { error = "Choose an image to upload." });

    try
    {
        var product = await images.ReplaceAsync(id, image, cancellationToken);
        return product is null
            ? Results.NotFound(new { error = $"Product {id} was not found." })
            : Results.Ok(product);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).DisableAntiforgery();

adminProducts.MapDelete("/{id:int}/image", async Task<IResult> (int id,
    ProductImageService images, CancellationToken cancellationToken) =>
{
    var product = await images.RemoveAsync(id, cancellationToken);
    return product is null
        ? Results.NotFound(new { error = $"Product {id} was not found." })
        : Results.Ok(product);
});

adminProducts.MapDelete("/{id:int}", async Task<IResult> (int id, ProductService service, ProductImageService images) =>
{
    try
    {
        var product = await service.GetProductById(id);
        bool isDeleted = await service.DeleteProductById(id);
        if(isDeleted == false)
        {
            return Results.BadRequest();
        }
        images.DeleteLocalFile(product?.ImageUrl);
        return Results.Ok();
    }
    catch (Exception)
    {

        return Results.InternalServerError();
    }
});

adminProducts.MapPatch("/{id:int}/stock", async Task<IResult> (
    int id, StockAdjustmentDTO request, ProductService service) =>
{
    try
    {
        var product = await service.AdjustStock(id, request.Amount);
        return product is null
            ? Results.NotFound(new { error = $"Product {id} was not found." })
            : Results.Ok(product);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (InsufficientStockException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
});

app.MapPost("/orders", async Task<IResult> (
    OrderCreateDTO request, OrderService service, CancellationToken cancellationToken) =>
{
    try
    {
        var order = await service.CreateOrder(request, cancellationToken);
        return Results.Json(new OrderResponseDTO(order.Id, order.CreatedAt, (int)order.Status,
            order.CustomerFullName, order.CustomerPhoneNumber, order.CustomerAdress,
            order.Items.Select(i => new OrderItemResponseDTO(i.ProductId, i.PackId,
                i.ItemName, i.Quantity, i.UnitPriceDZD)).ToList()), statusCode: StatusCodes.Status201Created);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (KeyNotFoundException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (InsufficientStockException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
});


var adminOrders = app.MapGroup("/orders").RequireAuthorization(AdminAuthentication.Policy);

adminOrders.MapGet("", async Task<IResult> (OrderService service) =>
{
    try
    {
        var orders = await service.GetAllOrdersAsync();
        return Results.Ok(orders);

    }
    catch (Exception)
    {

        return Results.InternalServerError();
    }
});


adminOrders.MapPatch("/{id:int}/confirm", async Task<IResult> (int id, OrderService service) =>
{
    var modified = await service.ConfirmeOrder(id);
    if (modified)
    {
        return Results.Ok(modified);
    }
    return Results.NotFound(id);
});


adminOrders.MapPatch("/{id:int}/cancel", async Task<IResult> (int id, OrderService service) =>
{
    var modified = await service.CancelOrder(id);
    if (modified)
    {
        return Results.Ok(modified);
    }
    return Results.NotFound(id);
});

adminOrders.MapPatch("/{id:int}/delivered", async Task<IResult> (int id, OrderService service) =>
{
    var modified = await service.MarkAsDelivered(id);
    if (modified)
    {
        return Results.Ok(modified);
    }
    return Results.NotFound(id);
});


// Public - anyone can browse packs
app.MapGet("/packs", async Task<IResult> (PackService service, CancellationToken ct) =>
{
    try
    {
        var packs = await service.GetAllPacksAsync(ct);
        return Results.Ok(packs);
    }
    catch (Exception)
    {
        return Results.InternalServerError();
    }
});

app.MapGet("/packs/{id:int}", async Task<IResult> (
    int id, PackService service, CancellationToken ct) =>
{
    try
    {
        var pack = await service.GetPackByIdAsync(id, ct);
        return pack is null
            ? Results.NotFound(new { error = $"Pack {id} was not found." })
            : Results.Ok(pack);
    }
    catch (Exception)
    {
        return Results.InternalServerError();
    }
});

// Admin only - manage packs
var adminPacks = app.MapGroup("/packs").RequireAuthorization(AdminAuthentication.Policy);

adminPacks.MapGet("/all", async (PackService service, CancellationToken ct) =>
    Results.Ok(await service.GetAllPacksAsync(ct, includeInactive: true)));

adminPacks.MapPost("", async Task<IResult> (
    PackCreateDTO request, PackService service, CancellationToken ct) =>
{
    var validationResults = new List<ValidationResult>();
    var validationContext = new ValidationContext(request);
    bool isValid = Validator.TryValidateObject(request, validationContext, validationResults, true);

    if (!isValid)
    {
        return Results.BadRequest(validationResults);
    }

    try
    {
        var pack = await service.CreatePackAsync(request, ct);
        return Results.Created($"/packs/{pack.Id}", pack);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (KeyNotFoundException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
});

adminPacks.MapPut("/{id:int}", async Task<IResult> (
    int id, PackCreateDTO request, PackService service, CancellationToken ct) =>
{
    var validationResults = new List<ValidationResult>();
    var validationContext = new ValidationContext(request);
    bool isValid = Validator.TryValidateObject(request, validationContext, validationResults, true);

    if (!isValid)
    {
        return Results.BadRequest(validationResults);
    }

    try
    {
        var pack = await service.UpdatePackAsync(id, request, ct);
        return Results.Ok(pack);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (KeyNotFoundException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
});

adminPacks.MapPatch("/{id:int}/active", async Task<IResult> (
    int id, bool isActive, PackService service, CancellationToken ct) =>
{
    try
    {
        await service.SetPackActiveAsync(id, isActive, ct);
        return Results.Ok();
    }
    catch (KeyNotFoundException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (Exception)
    {
        return Results.InternalServerError();
    }
});

adminPacks.MapDelete("/{id:int}", async Task<IResult> (
    int id, PackService service, CancellationToken ct) =>
{
    try
    {
        await service.DeletePackAsync(id, ct);
        return Results.Ok();
    }
    catch (KeyNotFoundException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
    catch (Exception)
    {
        return Results.InternalServerError();
    }
});





app.Run();

public partial class Program { }

