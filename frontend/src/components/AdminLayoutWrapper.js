import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useMemo, useCallback } from 'react';
import './AdminLayout.css';

const AdminLayoutWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const getNavLinkClass = useCallback((path) => {
    return location.pathname === path ? 'nav-item active' : 'nav-item';
  }, [location.pathname]);

  // Memoize sidebar to prevent re-render
  const sidebarContent = useMemo(() => (
    <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="admin-brand">THEBOB</div>
      <nav className="admin-nav">
        <Link to="/admin" className={getNavLinkClass('/admin')}>
          Bảng Điều Khiển
        </Link>
        <Link to="/admin/products" className={getNavLinkClass('/admin/products')}>
          Sản Phẩm
        </Link>
        <Link to="/admin/categories" className={getNavLinkClass('/admin/categories')}>
          Danh Mục
        </Link>
        <Link to="/admin/orders" className={getNavLinkClass('/admin/orders')}>
          Đơn Hàng
        </Link>
        <Link to="/admin/coupons" className={getNavLinkClass('/admin/coupons')}>
          Mã Giảm Giá
        </Link>
        <Link to="/admin/users" className={getNavLinkClass('/admin/users')}>
          Người Dùng
        </Link>
        <Link to="/admin/profile" className={getNavLinkClass('/admin/profile')}>
          Tài Khoản
        </Link>
      </nav>
    </aside>
  ), [sidebarOpen, getNavLinkClass]);

  // Memoize topbar to prevent re-render
  const topbarContent = useMemo(() => (
    <header className="admin-topbar">
      <div className="topbar-left">
        <h2>Admin</h2>
      </div>
      <div className="topbar-right">
        <div className="admin-menu-container">
          <button 
            className="admin-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            title="Menu Admin"
          >
            👤 {user?.fullName || 'Admin'}
          </button>
          {menuOpen && (
            <div className="admin-dropdown">
              <div className="dropdown-item email">{user?.email}</div>
              <hr />
              <button 
                className="dropdown-item logout-btn"
                onClick={handleLogout}
              >
                Đăng Xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  ), [menuOpen, user, handleLogout]);

  return (
    <div className="admin-wrapper">
      <button 
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle Sidebar"
      >
        ☰
      </button>

      {sidebarContent}

      <div className="admin-main">
        {topbarContent}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayoutWrapper;
