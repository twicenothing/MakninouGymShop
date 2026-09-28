using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using MakninouAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace MakninouAPI.Auth;

public sealed record AdminLoginRequest(string Username, string Password);
public sealed record AdminTokenResponse(string AccessToken, string TokenType, int ExpiresIn);

public sealed class AdminAuthentication
{
    public const string Policy = "AdminOnly";
    private readonly string _dummyHash = new PasswordHasher<object>().HashPassword(new object(), Guid.NewGuid().ToString());
    private readonly string _issuer;
    private readonly string _audience;
    private readonly SymmetricSecurityKey _key;
    private readonly PasswordHasher<object> _hasher = new();

    public AdminAuthentication(IConfiguration configuration)
    {
        _issuer = configuration["Jwt:Issuer"] ?? "MakninouAPI";
        _audience = configuration["Jwt:Audience"] ?? "MakninouAdmin";
        var key = Required(configuration, "Jwt:SigningKey");
        if (Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException("Jwt:SigningKey must contain at least 32 bytes. Use a randomly generated secret.");
        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }

    public TokenValidationParameters ValidationParameters => new()
    {
        ValidateIssuer = true,
        ValidIssuer = _issuer,
        ValidateAudience = true,
        ValidAudience = _audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = _key,
        ValidateLifetime = true,
        RequireExpirationTime = true,
        RequireSignedTokens = true,
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = "sub",
        RoleClaimType = "role"
    };

    public async Task<AdminTokenResponse?> LoginAsync(AdminLoginRequest request, MakninouDBContext db, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password)
            || request.Username.Length > 256 || request.Password.Length > 1024)
            return null;

        var admin = await db.Admins.AsNoTracking().SingleOrDefaultAsync(
            admin => admin.Username == request.Username, cancellationToken);
        // Do the same password-hashing work for unknown usernames.
        var result = _hasher.VerifyHashedPassword(this, admin?.PasswordHash ?? _dummyHash, request.Password);
        if (admin is null || result == PasswordVerificationResult.Failed)
            return null;

        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: [new Claim("sub", admin.Id.ToString()), new Claim("name", admin.Username), new Claim("role", "Admin"),
                new Claim("jti", Guid.NewGuid().ToString())],
            notBefore: now,
            expires: now.AddHours(1),
            signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
        return new AdminTokenResponse(new JwtSecurityTokenHandler().WriteToken(token), "Bearer", 3600);
    }

    public static void Configure(WebApplicationBuilder builder)
    {
        var admin = new AdminAuthentication(builder.Configuration);
        builder.Services.AddSingleton(admin);
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = admin.ValidationParameters;
            });
        builder.Services.AddAuthorization(options => options.AddPolicy(Policy,
            policy => policy.RequireAuthenticatedUser().RequireRole("Admin")));
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            foreach (var policyName in new[] { "AdminLogin", "AdminSetup" })
            options.AddPolicy(policyName, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0
                }));
        });
    }

    private static string Required(IConfiguration configuration, string key) =>
        !string.IsNullOrWhiteSpace(configuration[key]) ? configuration[key]!
            : throw new InvalidOperationException($"Configure {key}. See ADMIN_SETUP.md.");

    public static void PrintPasswordHash()
    {
        Console.Write("New admin password (at least 12 characters): ");
        var password = new StringBuilder();
        ConsoleKeyInfo key;
        while ((key = Console.ReadKey(intercept: true)).Key != ConsoleKey.Enter)
        {
            if (key.Key == ConsoleKey.Backspace && password.Length > 0)
                password.Length--;
            else if (!char.IsControl(key.KeyChar))
                password.Append(key.KeyChar);
        }
        Console.WriteLine();
        if (password.Length < 12 || password.Length > 1024)
            throw new ArgumentException("Use a password between 12 and 1024 characters.");
        Console.WriteLine(new PasswordHasher<object>().HashPassword(new object(), password.ToString()));
    }
}
