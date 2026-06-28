import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import './AdminLayout.css';

// ✅ Thêm prop hideTopbar — dùng ở trang Profile admin để ẩn header
export default function AdminLayout({ title, children, hideTopbar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Đóng sidebar khi chuyển route
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!e.target.closest('.admin-menu-container')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinkClass = (path) =>
    location.pathname === path ? 'nav-item active' : 'nav-item';

  return (
    <div className="admin-wrapper">
      <button
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle Sidebar"
      >
        ☰
      </button>

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-brand">THEBOB</div>
        <nav className="admin-nav">
          <Link to="/admin"            className={getNavLinkClass('/admin')}>Bảng Điều Khiển</Link>
          <Link to="/admin/products"   className={getNavLinkClass('/admin/products')}>Sản Phẩm</Link>
          <Link to="/admin/categories" className={getNavLinkClass('/admin/categories')}>Danh Mục</Link>
          <Link to="/admin/orders"     className={getNavLinkClass('/admin/orders')}>Đơn Hàng</Link>
          <Link to="/admin/coupons"    className={getNavLinkClass('/admin/coupons')}>Mã Giảm Giá</Link>
          <Link to="/admin/users"      className={getNavLinkClass('/admin/users')}>Người Dùng</Link>
          <Link to="/admin/profile"    className={getNavLinkClass('/admin/profile')}>Tài Khoản</Link>
          <Link to="/admin/settings"   className={getNavLinkClass('/admin/settings')}>Cài Đặt</Link>
        </nav>
      </aside>

      <div className="admin-main">
        {/* ✅ Ẩn topbar khi hideTopbar=true (dùng cho trang Profile) */}
        {!hideTopbar && (
          <header className="admin-topbar">
            <div className="topbar-left">
              <h2>{title}</h2>
            </div>
            <div className="topbar-right">
              <div className="admin-menu-container">
                <button
                  className="admin-menu-btn"
                  onClick={() => setMenuOpen(!menuOpen)}
                  title="Menu Admin"
                >
                  👤 {user?.name || user?.fullName || 'Admin'}
                </button>
                {menuOpen && (
                  <div className="admin-dropdown">
                    <div className="dropdown-item email">{user?.email}</div>
                    <hr />
                    <button className="dropdown-item logout-btn" onClick={handleLogout}>
                      Đăng Xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}