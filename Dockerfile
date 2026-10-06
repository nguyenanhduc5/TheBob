# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj và restore
COPY ["THEBOB/THEBOB.csproj", "THEBOB/"]
RUN dotnet restore "THEBOB/THEBOB.csproj"

# Copy toàn bộ nguồn và build release
COPY . .
WORKDIR "/src/THEBOB"
RUN dotnet publish "THEBOB.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Bật Polling File Watcher & Tắt reload config trên Linux Container Render để tránh tràn inotify limit (128)
ENV DOTNET_USE_POLLING_FILE_WATCHER=true
ENV DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE=false
ENV ASPNETCORE_HOSTINGSTARTUPASSEMBLIES=""
ENV ASPNETCORE_URLS=http://0.0.0.0:8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "THEBOB.dll"]
