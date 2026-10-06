import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Icons } from '../icons';
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
          <Icons.dashboard size={18} /> Bảng Điều Khiển
        </Link>
        <Link to="/admin/products" className={getNavLinkClass('/admin/products')}>
          <Icons.product size={18} /> Sản Phẩm
        </Link>
        <Link to="/admin/categories" className={getNavLinkClass('/admin/categories')}>
          <Icons.category size={18} /> Danh Mục
        </Link>
        <Link to="/admin/orders" className={getNavLinkClass('/admin/orders')}>
          <Icons.orders size={18} /> Đơn Hàng
        </Link>
        <Link to="/admin/promotions" className={getNavLinkClass('/admin/promotions')}>
          <Icons.promotion size={18} /> Khuyến Mãi
        </Link>
        <Link to="/admin/users" className={getNavLinkClass('/admin/users')}>
          <Icons.users size={18} /> Người Dùng
        </Link>
        <Link to="/admin/chat" className={getNavLinkClass('/admin/chat')}>
          <Icons.chat size={18} /> Chat
        </Link>
        <Link to="/admin/faqs" className={getNavLinkClass('/admin/faqs')}>
          <Icons.faq size={18} /> FAQ
        </Link>
        <Link to="/admin/blog" className={getNavLinkClass('/admin/blog')}>
          <Icons.blog size={18} /> Bài Viết Blog
        </Link>
        <Link to="/admin/profile" className={getNavLinkClass('/admin/profile')}>
          <Icons.account size={18} /> Tài Khoản
        </Link>
        <Link to="/admin/settings" className={getNavLinkClass('/admin/settings')}>
          <Icons.settings size={18} /> Cài Đặt
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
            <Icons.user size={16} /> {user?.fullName || 'Admin'}
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
