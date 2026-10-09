import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import PreferencesControls from './PreferencesControls';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Icons } from '../icons';
import './AdminLayout.css';

const {
  dashboard: DashboardIcon,
  product: ProductIcon,
  category: CategoryIcon,
  orders: OrdersIcon,
  cash: CashIcon,
  promotion: PromotionIcon,
  users: UsersIcon,
  chat: ChatIcon,
  faq: FaqIcon,
  blog: BlogIcon,
  account: AccountIcon,
  settings: SettingsIcon,
  bag: BagIcon,
  user: UserIcon,
  close: CloseIcon,
  menu: MenuIcon,
} = Icons;

const AdminLayoutWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { t } = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = useMemo(() => {
    const titles = [
      ['/admin/products', 'admin.products'],
      ['/admin/categories', 'admin.categories'],
      ['/admin/orders', 'admin.orders'],
      ['/admin/payments', 'admin.payments'],
      ['/admin/promotions', 'admin.promotions'],
      ['/admin/users', 'admin.users'],
      ['/admin/chat', 'admin.support'],
      ['/admin/faqs', 'admin.faqs'],
      ['/admin/blog', 'admin.blog'],
      ['/admin/profile', 'admin.account'],
      ['/admin/settings', 'admin.settings'],
    ];
    const titleKey = titles.find(([path]) => location.pathname.startsWith(path))?.[1] || 'admin.overview';
    return t(titleKey);
  }, [location.pathname, t]);

  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const getNavLinkClass = useCallback((path) => {
    const isActive = path === '/admin'
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
    return isActive ? 'nav-item active' : 'nav-item';
  }, [location.pathname]);

  // Memoize sidebar to prevent re-render
  const sidebarContent = useMemo(() => (
    <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="admin-brand">THEBOB</div>
      <div className="admin-nav-label">{t('admin.section')}</div>
      <nav className="admin-nav">
        <Link to="/admin" className={getNavLinkClass('/admin')}>
          <DashboardIcon size={18} /> {t('admin.dashboard')}
        </Link>
        <Link to="/admin/products" className={getNavLinkClass('/admin/products')}>
          <ProductIcon size={18} /> {t('admin.products')}
        </Link>
        <Link to="/admin/categories" className={getNavLinkClass('/admin/categories')}>
          <CategoryIcon size={18} /> {t('admin.categories')}
        </Link>
        <Link to="/admin/orders" className={getNavLinkClass('/admin/orders')}>
          <OrdersIcon size={18} /> {t('admin.orders')}
        </Link>
        <Link to="/admin/payments" className={getNavLinkClass('/admin/payments')}>
          <CashIcon size={18} /> {t('admin.payments')}
        </Link>
        <Link to="/admin/promotions" className={getNavLinkClass('/admin/promotions')}>
          <PromotionIcon size={18} /> {t('admin.promotions')}
        </Link>
        <Link to="/admin/users" className={getNavLinkClass('/admin/users')}>
          <UsersIcon size={18} /> {t('admin.users')}
        </Link>
        <Link to="/admin/chat" className={getNavLinkClass('/admin/chat')}>
          <ChatIcon size={18} /> {t('admin.chat')}
        </Link>
        <Link to="/admin/faqs" className={getNavLinkClass('/admin/faqs')}>
          <FaqIcon size={18} /> {t('admin.faqs')}
        </Link>
        <Link to="/admin/blog" className={getNavLinkClass('/admin/blog')}>
          <BlogIcon size={18} /> {t('admin.blog')}
        </Link>
        <Link to="/admin/profile" className={getNavLinkClass('/admin/profile')}>
          <AccountIcon size={18} /> {t('admin.account')}
        </Link>
        <Link to="/admin/settings" className={getNavLinkClass('/admin/settings')}>
          <SettingsIcon size={18} /> {t('admin.settings')}
        </Link>
      </nav>
      <Link to="/" className="admin-store-link">
        <BagIcon size={17} />
        <span>{t('admin.viewStore')}</span>
        <span className="admin-store-arrow" aria-hidden="true">↗</span>
      </Link>
    </aside>
  ), [sidebarOpen, getNavLinkClass, t]);

  // Memoize topbar to prevent re-render
  const topbarContent = useMemo(() => (
    <header className="admin-topbar">
      <div className="topbar-left">
        <span className="topbar-eyebrow">THEBOB / {t('admin.section')}</span>
        <h2>{pageTitle}</h2>
      </div>
      <div className="topbar-right">
        <PreferencesControls />
        <div className="admin-menu-container">
          <button
            className="admin-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            title={t('admin.adminAccount')}
            aria-expanded={menuOpen}
          >
            <span className="admin-avatar"><UserIcon size={17} /></span>
            <span>{user?.fullName || 'Admin'}</span>
            <span className="admin-menu-chevron" aria-hidden="true">⌄</span>
          </button>
          {menuOpen && (
            <div className="admin-dropdown">
              <div className="dropdown-item email">{user?.email}</div>
              <hr />
              <button
                className="dropdown-item logout-btn"
                onClick={handleLogout}
              >
                {t('admin.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  ), [menuOpen, user, handleLogout, pageTitle, t]);

  return (
    <div className="admin-wrapper">
      <button
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? t('header.menu.hide') : t('header.menu.show')}
        aria-label={sidebarOpen ? t('header.menu.hide') : t('header.menu.show')}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
      </button>

      {sidebarOpen && (
        <button
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label={t('header.menu.hide')}
        />
      )}
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
