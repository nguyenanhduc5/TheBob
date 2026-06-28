import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('thebob-current-user');
    const savedToken = localStorage.getItem('thebob-token');

    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {
        // token/user bị corrupt → clear
        localStorage.removeItem('thebob-current-user');
        localStorage.removeItem('thebob-token');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('thebob-current-user', JSON.stringify(userData));
    localStorage.setItem('thebob-token', authToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('thebob-current-user');
    localStorage.removeItem('thebob-token');
  }, []);

  const updateUser = useCallback((userData) => {
    setUser((prev) => {
      const updated = { ...prev, ...userData };
      localStorage.setItem('thebob-current-user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ✅ FIX: dùng boolean thay vì function để tránh tạo reference mới mỗi render
  // Trước đây: isAdmin = () => user?.role === 'Admin'
  // → mỗi lần AuthContext render, isAdmin là function MỚI
  // → component con gọi isAdmin() trong useEffect deps sẽ re-run liên tục
  const isAdminBool = user?.role === 'Admin';
  const isUserBool  = user?.role === 'User';

  // Giữ dạng function để không break code cũ đang gọi isAdmin()
  // nhưng dùng useCallback để stable reference
  const isAdmin = useCallback(() => isAdminBool, [isAdminBool]);
  const isUser  = useCallback(() => isUserBool,  [isUserBool]);
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
    // VD: {isAdminUser && <AdminLayout>} thay vì {isAdmin() && <AdminLayout>}
    isAdminUser: isAdminBool,
    isRegularUser: isUserBool,
  }), [user, token, loading, login, logout, updateUser, isAdmin, isUser, isAuthenticated, isAdminBool, isUserBool]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};