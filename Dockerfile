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

# Render tự động inject biến PORT (mặc định 10000 hoặc 8080)
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "THEBOB.dll"]
