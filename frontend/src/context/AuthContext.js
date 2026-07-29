import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { authAPI } from '../api/app';

const AuthContext = createContext();

const TOKEN_KEY         = 'thebob-token';
const USER_KEY          = 'thebob-current-user';
const REFRESH_TOKEN_KEY = 'thebob-refresh-token';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser         = localStorage.getItem(USER_KEY);
    const savedToken        = localStorage.getItem(TOKEN_KEY);

    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {
        // token/user bị corrupt → clear toàn bộ
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  /**
   * Gọi sau khi login/register thành công.
   * Lưu cả JWT + Refresh Token vào localStorage.
   */
  const login = useCallback((userData, authToken, refreshToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem(USER_KEY,  JSON.stringify(userData));
    localStorage.setItem(TOKEN_KEY, authToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }, []);

  /**
   * Đăng xuất: gọi BE revoke Refresh Token trước rồi mới xóa localStorage.
   * Kể cả nếu API lỗi (mạng yếu), vẫn clear local state để tránh treo UI.
   */
  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (refreshToken) {
        await authAPI.logout(refreshToken); // Gọi BE revoke token trong DB
      }
    } catch {
      // Dù BE lỗi vẫn clear local để đăng xuất được
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser((prev) => {
      const updated = { ...prev, ...userData };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ✅ Boolean thay vì function để tránh tạo reference mới mỗi render
  const isAdminBool = user?.role === 'Admin';
  const isUserBool  = user?.role === 'User';

  // Giữ dạng function để không break code cũ đang gọi isAdmin()
  const isAdmin        = useCallback(() => isAdminBool,  [isAdminBool]);
  const isUser         = useCallback(() => isUserBool,   [isUserBool]);
  const isAuthenticated = useCallback(() => !!user && !!token, [user, token]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    isAdmin,
    isUser,
    isAuthenticated,
    // ✅ Thêm boolean trực tiếp để dùng trong JSX điều kiện (nhanh hơn gọi fn)
    isAdminUser:   isAdminBool,
    isRegularUser: isUserBool,
  }), [user, token, loading, login, logout, updateUser, isAdmin, isUser, isAuthenticated, isAdminBool, isUserBool]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};