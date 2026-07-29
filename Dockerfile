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

# Tắt FileSystemWatcher để tránh tràn inotify limit trên Linux Container Render
ENV DOTNET_USE_POLLING_FILE_WATCHER=false
ENV ASPNETCORE_HOSTINGSTARTUPASSEMBLIES=""
ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "THEBOB.dll"]
