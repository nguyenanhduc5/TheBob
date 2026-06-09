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
        var jwtKey = builder.Configuration["Jwt:Key"] ?? "THEBOB_JWT_SECRET_KEY_2026_SUPER_SECRET";
        var issuer = builder.Configuration["Jwt:Issuer"] ?? "THEBOB";
        var audience = builder.Configuration["Jwt:Audience"] ?? "THEBOB_API";

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            RoleClaimType = ClaimTypes.Role
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
    var adminEmail = builder.Configuration["AdminSeed:Email"];
    var adminPassword = builder.Configuration["AdminSeed:Password"];
    var adminName = builder.Configuration["AdminSeed:Name"];
    var adminPhone = builder.Configuration["AdminSeed:Phone"];

    if (adminSeedEnabled && !string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword))
    {
        // Ensure Admin role exists
        var adminRole = db.Roles.FirstOrDefault(r => r.RoleName == "Admin");
        if (adminRole == null)
        {
            adminRole = new Role { RoleName = "Admin" };
            db.Roles.Add(adminRole);
            db.SaveChanges();
        }

        // Ensure User role exists
        var userRole = db.Roles.FirstOrDefault(r => r.RoleName == "User");
        if (userRole == null)
        {
            userRole = new Role { RoleName = "User" };
            db.Roles.Add(userRole);
            db.SaveChanges();
        }

        // Create or update admin user by email
        var adminUser = db.Users.FirstOrDefault(u => u.Email == adminEmail);
        if (adminUser == null)
        {
            adminUser = new User
            {
                Email = adminEmail,
                PasswordHash = authService.HashPassword(adminPassword),
                FullName = adminName ?? "Admin",
                Phone = adminPhone ?? string.Empty,
                RoleId = adminRole.Id,
                RoleEntity = adminRole,
                IsActive = true
            };
            db.Users.Add(adminUser);
            db.SaveChanges();
        }
        else
        {
            adminUser.RoleId = adminRole.Id;
            adminUser.IsActive = true;
            adminUser.PasswordHash = authService.HashPassword(adminPassword);
            adminUser.FullName = adminName ?? adminUser.FullName;
            adminUser.Phone = adminPhone ?? adminUser.Phone;
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
