# THEBOB E-Commerce Troubleshooting Guide

## Common Issues & Solutions

### Backend Issues

#### 1. Database Connection Error
**Error:** `Cannot connect to database`
**Solution:**
- Verify MySQL is running
- Check connection string in `appsettings.json`
- Ensure database exists: `CREATE DATABASE thebob_db;`
- Run migrations: `dotnet ef database update`

#### 2. API Port Already in Use
**Error:** `Port 5000 is already in use`
**Solution:**
- Kill process on port 5000:
  ```bash
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```
- Or run on different port:
  ```bash
  dotnet run --urls "http://localhost:5001"
  ```

#### 3. CORS Errors
**Error:** `Access to XMLHttpRequest has been blocked by CORS policy`
**Solution:**
- Verify CORS is configured in `Program.cs`
- Check that frontend origin is whitelisted
- Ensure headers are set correctly in responses

#### 4. JWT Token Invalid
**Error:** `401 Unauthorized`
**Solution:**
- Verify token is sent in Authorization header
- Check token format: `Bearer <token>`
- Verify token hasn't expired
- Clear localStorage and login again

#### 5. Nullable Value Type Warnings
**Warning:** `CS8629 - Nullable value type may be null`
**Solution:** These are non-critical warnings. To fix:
```csharp
// Instead of:
int? categoryId = null;

// Use:
int? categoryId = (int?)request.CategoryId;
```

### Frontend Issues

#### 1. Cannot Connect to Backend
**Error:** `Failed to fetch from http://localhost:5000`
**Solution:**
- Ensure backend is running: `dotnet run`
- Check backend is on port 5000
- Check network tab in DevTools for actual error
- Verify CORS headers in backend response

#### 2. Routes Not Working
**Error:** `Page not found / blank page`
**Solution:**
- Verify routes are defined in `App.js`
- Check route path spelling
- Verify components are imported correctly
- Clear browser cache and reload

#### 3. Authentication Not Persisting
**Error:** `Logged out after refresh`
**Solution:**
- Check localStorage in DevTools (F12)
- Verify `thebob-token` and `thebob-current-user` exist
- Check AuthContext initialization in App.js
- Verify localStorage.getItem() is called on mount

#### 4. Cart Not Updating
**Error:** `Add to cart button doesn't work`
**Solution:**
- Check CartContext is initialized
- Verify CartProvider wraps App component
- Check browser console for errors
- Verify useCart hook is used correctly

#### 5. Admin Routes Not Accessible
**Error:** `Redirected to home when accessing /admin`
**Solution:**
- Verify user is logged in as admin
- Check user.role is set to "Admin"
- Verify AdminRoute component checks role correctly
- Check isAdmin() function in AuthContext

### Common Coding Errors

#### Missing Import
```javascript
// Error: useCart is not defined
// Solution: Add import
import { useCart } from '../context/CartContext';
```

#### Async/Await Issues
```javascript
// Wrong: Forgetting async/await
const data = fetch(url);

// Correct:
const response = await fetch(url);
const data = await response.json();
```

#### State Update Issues
```javascript
// Wrong: Mutating state directly
setFormData(formData.name = "new");

// Correct: Creating new object
setFormData({ ...formData, name: "new" });
```

#### CSS Not Applying
```javascript
// Solution: Verify import path is correct
import '../styles/Products.css';  // Correct relative path
```

## Performance Issues

### Slow Page Load
**Solutions:**
1. Check Network tab in DevTools
2. Verify API responses are reasonable size
3. Lazy load images: `<img loading="lazy" />`
4. Implement pagination for large lists
5. Use React.memo for components

### High Memory Usage
**Solutions:**
1. Clean up event listeners in useEffect cleanup
2. Avoid creating objects in render
3. Use useCallback for event handlers
4. Implement pagination instead of loading all items

## Security Issues

### Sensitive Data in Logs
**Never log:**
- Passwords
- JWT tokens
- Personal information
- API keys

### CORS Issues
**Solution:**
```csharp
// In Program.cs
services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", builder =>
        builder.WithOrigins("http://localhost:3000")
               .AllowAnyMethod()
               .AllowAnyHeader());
});
```

### Token Expiration
**Solution:**
- Set reasonable token expiry (e.g., 24 hours)
- Implement token refresh mechanism
- Handle 401 errors gracefully
- Redirect to login on token expiry

## Database Issues

### Migration Failed
**Solution:**
```bash
# Rollback migration
dotnet ef migrations remove

# Update database
dotnet ef database update
```

### Data Not Persisting
**Solution:**
- Verify SaveChangesAsync() is called
- Check for transaction rollback
- Verify connection string is correct
- Check database permissions

## Testing Checklist

### Before Deployment
- [ ] Backend builds successfully
- [ ] Frontend builds successfully
- [ ] All routes work
- [ ] Authentication works
- [ ] Cart operations work
- [ ] Order submission works
- [ ] Admin panel is accessible
- [ ] Responsive design works on mobile
- [ ] No console errors
- [ ] No compilation warnings

### Test Cases
1. **User Registration**
   - Valid registration
   - Invalid email format
   - Duplicate email
   - Password validation

2. **User Login**
   - Valid credentials
   - Invalid password
   - Non-existent user
   - Token generation

3. **Product Browsing**
   - List products
   - Filter by category
   - Filter by price
   - Search by keyword
   - Sort by price

4. **Shopping**
   - Add to cart
   - Update quantity
   - Remove from cart
   - Apply coupon
   - Checkout

5. **Admin Functions**
   - Add product
   - Edit product
   - Delete product
   - Manage categories
   - View orders
   - Update order status

## Debug Mode

### Enable Debug Logging in Backend
```csharp
// In appsettings.Development.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft": "Debug"
    }
  }
}
```

### React DevTools
- Install React DevTools browser extension
- Use Profiler to check component renders
- Use Console to inspect state and props

### Network Debugging
1. Open DevTools (F12)
2. Go to Network tab
3. Perform action
4. Check request/response headers and body
5. Verify status codes (200, 400, 401, 500)

## Useful Commands

```bash
# Backend
dotnet build                          # Compile
dotnet run                           # Run
dotnet ef migrations add <Name>      # Create migration
dotnet ef database update            # Apply migration
dotnet ef database drop              # Drop database

# Frontend
npm install                          # Install dependencies
npm start                            # Run dev server
npm run build                        # Build for production
npm test                             # Run tests
npm run eject                        # Eject from CRA (not reversible!)

# Database
mysql -u root -p                     # Connect to MySQL
SHOW DATABASES;                      # List databases
USE thebob_db;                       # Select database
SHOW TABLES;                         # List tables
SELECT * FROM Products;              # Query table
```

## Getting Help

1. **Check Console Errors**
   - Browser DevTools (F12)
   - Backend terminal output
   - Application logs

2. **Stack Overflow**
   - Search error message
   - Check similar issues
   - Provide minimal reproducible example

3. **Documentation**
   - React: https://react.dev
   - ASP.NET Core: https://learn.microsoft.com
   - Entity Framework: https://learn.microsoft.com/ef
   - MySQL: https://dev.mysql.com/doc

4. **Check Project Files**
   - IMPLEMENTATION_GUIDE.md
   - CHECKLIST.md
   - Source code comments

---

**Remember:** Most issues can be solved by:
1. Checking console for error messages
2. Verifying all imports and configurations
3. Ensuring both backend and frontend are running
4. Clearing browser cache and reloading
5. Checking network requests in DevTools
