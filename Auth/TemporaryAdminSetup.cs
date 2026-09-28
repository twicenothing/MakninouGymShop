using MakninouAPI.Data;
using MakninouAPI.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MakninouAPI.Auth;

// Remove this file and the MapTemporaryAdminSetup call after provisioning the owner.
public static class TemporaryAdminSetup
{
    public static void MapTemporaryAdminSetup(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
            return;

        app.MapPost("/admin/setup", async Task<IResult> (
            AdminLoginRequest request, MakninouDBContext db, CancellationToken cancellationToken) =>
        {
            if (await db.Admins.AnyAsync(cancellationToken))
                return Results.Conflict(new { error = "An admin already exists. Remove the temporary setup endpoint." });

            if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Trim().Length > 256
                || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12 || request.Password.Length > 1024)
                return Results.BadRequest(new { error = "Provide a username (1–256 characters) and a password (12–1024 characters)." });

            var admin = new Admin
            {
                // Every setup request inserts the same primary key, so concurrent requests cannot create two admins.
                Id = 1,
                Username = request.Username.Trim(),
                PasswordHash = new PasswordHasher<object>().HashPassword(new object(), request.Password)
            };
            db.Admins.Add(admin);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                return Results.Conflict(new { error = "An admin already exists." });
            }
            return Results.Json(new { admin.Id, admin.Username }, statusCode: StatusCodes.Status201Created);
        }).AllowAnonymous().RequireRateLimiting("AdminSetup");
    }
}
