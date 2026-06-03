using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Linq;
using System.Security.Claims;
using System.Text;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddEndpointsApiExplorer();

// Register controllers so MapControllers() works
builder.Services.AddControllers();

// Add authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "THEBOB",
            ValidAudience = "THEBOB_API",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("THEBOB_JWT_SECRET_KEY_2026_SUPER_SECRET")),
            RoleClaimType = ClaimTypes.Role
        };

        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                Console.WriteLine($"JWT authentication failed: {context.Exception.Message}");
                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                var principal = context.Principal;
                Console.WriteLine($"JWT validated");
                Console.WriteLine($"  IsAuthenticated: {principal?.Identity?.IsAuthenticated}");
                Console.WriteLine($"  Identity.Name: {principal?.Identity?.Name}");
                Console.WriteLine($"  Claims:");
                foreach (var claim in principal?.Claims ?? new List<Claim>())
                {
                    Console.WriteLine($"    {claim.Type}: {claim.Value}");
                }
                var roles = principal?.FindAll(System.Security.Claims.ClaimTypes.Role);
                Console.WriteLine($"  ClaimTypes.Role claims: {string.Join(", ", roles?.Select(c => c.Value) ?? new List<string>())}");
                var rolesClaim = principal?.FindAll("role");
                Console.WriteLine($"  'role' claims: {string.Join(", ", rolesClaim?.Select(c => c.Value) ?? new List<string>())}");
                return Task.CompletedTask;
            }
        };
    });

// Add authorization
builder.Services.AddAuthorization();

// Add CORS policy for React frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", builder =>
    {
        builder.WithOrigins("http://localhost:3000")
               .AllowAnyHeader()
               .AllowAnyMethod()
               .AllowCredentials();
    });
});

// Register services
builder.Services.AddScoped<IAuthService, AuthService>();

// Add Swagger
builder.Services.AddSwaggerGen();

// Add DbContext with MySQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ThebobDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString))
);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
    var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();

    db.Database.Migrate();

    var adminSeedEnabled = builder.Configuration.GetValue<bool>("AdminSeed:Enable", false);
    var adminUsername = builder.Configuration["AdminSeed:Username"];
    var adminPassword = builder.Configuration["AdminSeed:Password"];
    var adminEmail = builder.Configuration["AdminSeed:Email"];
    var adminName = builder.Configuration["AdminSeed:Name"];
    var adminPhone = builder.Configuration["AdminSeed:Phone"];
    var adminAddress = builder.Configuration["AdminSeed:Address"];

    if (adminSeedEnabled &&
        !string.IsNullOrWhiteSpace(adminUsername) &&
        !string.IsNullOrWhiteSpace(adminPassword))
    {
        var adminUser = db.Users.FirstOrDefault(u => u.Username == adminUsername);

        if (adminUser == null)
        {
            adminUser = new User
            {
                Username = adminUsername,
                Email = adminEmail ?? string.Empty,
                Name = adminName ?? "Admin",
                Phone = adminPhone ?? string.Empty,
                Address = adminAddress ?? string.Empty,
                PasswordHash = authService.HashPassword(adminPassword),
                Role = UserRole.Admin,
                IsActive = true
            };

            db.Users.Add(adminUser);
            db.SaveChanges();
        }
        else if (adminUser.Role != UserRole.Admin || !adminUser.IsActive)
        {
            adminUser.Role = UserRole.Admin;
            adminUser.IsActive = true;
            adminUser.Email = adminEmail ?? adminUser.Email;
            adminUser.Name = adminName ?? adminUser.Name;
            adminUser.Phone = adminPhone ?? adminUser.Phone;
            adminUser.Address = adminAddress ?? adminUser.Address;
            adminUser.PasswordHash = authService.HashPassword(adminPassword);
            db.SaveChanges();
        }
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseRouting();
app.UseCors("AllowReactApp");

// Add authentication & authorization middleware
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
