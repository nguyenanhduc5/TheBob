import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import PreferencesControls from './PreferencesControls';
import './AdminLayout.css';

// ✅ Thêm prop hideTopbar — dùng ở trang Profile admin để ẩn header
export default function AdminLayout({ title, children, hideTopbar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { t } = usePreferences();
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
        title={t('admin.toggleSidebar')}
        aria-label={t('admin.toggleSidebar')}
      >
        ☰
      </button>

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-brand">THEBOB</div>
        <nav className="admin-nav">
          <Link to="/admin"            className={getNavLinkClass('/admin')}>{t('admin.dashboard')}</Link>
          <Link to="/admin/products"   className={getNavLinkClass('/admin/products')}>{t('admin.products')}</Link>
          <Link to="/admin/categories" className={getNavLinkClass('/admin/categories')}>{t('admin.categories')}</Link>
          <Link to="/admin/orders"     className={getNavLinkClass('/admin/orders')}>{t('admin.orders')}</Link>
          <Link to="/admin/promotions" className={getNavLinkClass('/admin/promotions')}>{t('admin.promotions')}</Link>
          <Link to="/admin/users"      className={getNavLinkClass('/admin/users')}>{t('admin.users')}</Link>
          <Link to="/admin/chat"       className={getNavLinkClass('/admin/chat')}>{t('admin.chat')}</Link>
          <Link to="/admin/faqs"       className={getNavLinkClass('/admin/faqs')}>{t('admin.faq')}</Link>
          <Link to="/admin/blog"       className={getNavLinkClass('/admin/blog')}>{t('admin.blog')}</Link>
          <Link to="/admin/profile"    className={getNavLinkClass('/admin/profile')}>{t('admin.account')}</Link>
          <Link to="/admin/settings"   className={getNavLinkClass('/admin/settings')}>{t('admin.settings')}</Link>
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
              <PreferencesControls />
              <div className="admin-menu-container">
                <button
                  className="admin-menu-btn"
                  onClick={() => setMenuOpen(!menuOpen)}
                  title={t('admin.menu')}
                >
                  👤 {user?.name || user?.fullName || 'Admin'}
                </button>
                {menuOpen && (
                  <div className="admin-dropdown">
                    <div className="dropdown-item email">{user?.email}</div>
                    <hr />
                    <button className="dropdown-item logout-btn" onClick={handleLogout}>
                      {t('admin.logout')}
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