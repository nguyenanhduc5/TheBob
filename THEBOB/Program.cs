using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Linq;
using System.Security.Claims;
using System.Text;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Repositories;
using THEBOB.Services;
using THEBOB.Services.Background;
using THEBOB.Services.Blog;
using THEBOB.Services.Chat;
using THEBOB.Services.Promotion;
using THEBOB.Services.Recommendation;
using System.Threading.Channels;
var builder = WebApplication.CreateEmptyBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

// Thêm các dịch vụ Web mặc định
builder.WebHost.UseKestrel();

// Cấu hình không tự động reloadOnChange để tránh lỗi inotify limit trên Render/Linux Container
builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: false)
    .AddEnvironmentVariables();

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddEndpointsApiExplorer();

builder.Services.Configure<HostOptions>(options =>
{
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
});

// Register controllers so MapControllers() works
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.WriteIndented = true;
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddSignalR();

// Add authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtKey = builder.Configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is missing from configuration. Set it in appsettings or environment variables.");
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

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrWhiteSpace(accessToken) && 
                    (path.StartsWithSegments("/hubs/order") || path.StartsWithSegments("/api/hubs/order") ||
                     path.StartsWithSegments("/hubs/chat") || path.StartsWithSegments("/api/hubs/chat")))
                {
                    context.Token = accessToken;
                }
                return System.Threading.Tasks.Task.CompletedTask;
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
        builder.WithOrigins(
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://thebobb.netlify.app"
)
               .AllowAnyHeader()
               .AllowAnyMethod()
               .AllowCredentials();
    });
});

// Add Swagger
builder.Services.AddSwaggerGen();

// Add DbContext with MySQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ThebobDbContext>(options =>
    options.UseMySql(
        connectionString, 
        ServerVersion.AutoDetect(connectionString)
    )
    .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.MultipleCollectionIncludeWarning))
);
// Register services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, EmailService>();

builder.Services.AddMemoryCache();

builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IPresenceService, PresenceService>();
builder.Services.AddScoped<IFaqService, FaqService>();
builder.Services.AddScoped<IProductContextService, ProductContextService>();
builder.Services.AddHttpClient<IAiChatService, AiChatService>();
builder.Services.AddScoped<IAdminProductService, AdminProductService>();
builder.Services.AddScoped<IAdminProductRepository, AdminProductRepository>();
builder.Services.AddScoped<IPromotionEngine, PromotionEngine>();
builder.Services.AddScoped<RecommendationService>();
builder.Services.AddScoped<PromotionEvaluator>();
builder.Services.AddScoped<PromotionScopeChecker>();
builder.Services.AddScoped<PromotionCalculator>();
builder.Services.AddScoped<PromotionStackingResolver>();

// Register Blog Services
builder.Services.AddScoped<IBlogService, BlogService>();
builder.Services.AddSingleton(Channel.CreateUnbounded<BlogNotificationJob>());
builder.Services.AddScoped<IBlogNotificationService, BlogNotificationService>();

// Register High-Performance Channels & Background Processing Services
builder.Services.AddSingleton<AiChatProcessingQueue>();
builder.Services.AddSingleton<BlogClickProcessingQueue>();
builder.Services.AddHostedService<BackgroundQueueProcessingService>();

builder.Services.AddHostedService<RecommendationBackgroundService>();
builder.Services.AddHostedService<PromotionExpireService>();
builder.Services.AddHostedService<FlashSaleNotificationService>();
builder.Services.AddHostedService<BlogNotificationBackgroundService>();

builder.Services.AddHttpClient<SepayService>(client =>
{
    client.BaseAddress = new Uri(
        (builder.Configuration["SePay:BaseUrl"] ?? "https://userapi.sepay.vn/v2").TrimEnd('/') + "/");
    client.DefaultRequestHeaders.Add(
        "Authorization",
        $"Bearer {builder.Configuration["SePay:ApiToken"] ?? "DEFAULT_TOKEN"}");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});
// NOTE: SepayService is already registered via AddHttpClient<SepayService> above — no need for a second AddScoped.
// GHN HttpClient — base address tự động chuyển giữa sandbox / production
var ghnBaseUrl = builder.Environment.IsDevelopment()
    ? "https://dev-online-gateway.ghn.vn"   // Sandbox
    : "https://online-gateway.ghn.vn";       // Production

builder.Services.AddHttpClient<IGhnService, GhnService>(client =>
{
    client.BaseAddress = new Uri(ghnBaseUrl);
    client.Timeout     = TimeSpan.FromSeconds(15);
});
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
            // Chỉ re-hash password khi có thay đổi để tránh ghi DB thừa mỗi lần restart
            if (!authService.VerifyPassword(adminPassword, adminUser.PasswordHash))
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

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseRouting();
app.UseCors("AllowReactApp");

// Add authentication & authorization middleware
app.UseAuthentication();
app.UseAuthorization();

app.UseWebSockets();
app.MapControllers();
app.MapHub<THEBOB.Hubs.OrderHub>("/hubs/order").RequireCors("AllowReactApp");
app.MapHub<THEBOB.Hubs.ChatHub>("/hubs/chat").RequireCors("AllowReactApp");

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var context = services.GetRequiredService<THEBOB.Data.ThebobDbContext>();

    // Clear stale AdminPresence records on startup
    context.Database.ExecuteSqlRaw("UPDATE AdminPresences SET IsOnline = 0, ConnectionId = NULL");
}

app.Run();

