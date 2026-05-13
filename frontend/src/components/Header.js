import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Header.css';

const menuItems = ['SHOP', 'COLLECTION', 'ABOUT US', 'OUTLET'];

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleUserIconClick = () => {
    if (user) {
      setShowUserMenu(!showUserMenu);
    } else {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    setMobileMenuOpen(false);
    navigate('/');
  };

  const handleNavigate = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  // Hide header on login/register pages
  const hideHeaderPages = ['/login', '/register'];
  if (hideHeaderPages.includes(location.pathname)) {
    return null;
  }

  return (
    <header className="main-header">
      <div className="top-banner">OUTLET</div>
      <div className="header-container">
        <button className="hamburger" onClick={() => setMobileMenuOpen((open) => !open)}>
          <span />
          <span />
          <span />
        </button>

        <div className="logo">THEBOB</div>

        <div className="header-actions">
          <button className="icon-button" onClick={() => handleNavigate('/')}>
            🔍
          </button>
          <button className="icon-button" onClick={() => handleNavigate('/')}>
            🛒
          </button>
          <button className="icon-button user-icon" onClick={handleUserIconClick}>
            👤
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <nav className="mobile-nav">
          {menuItems.map((item) => (
            <a key={item} onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); }}>
              {item}
            </a>
          ))}
        </nav>
      </div>

      {user && showUserMenu && (
        <div className="user-menu-overlay" onMouseLeave={() => setShowUserMenu(false)}>
          <div className="user-menu">
            <div className="menu-item">{user.name}</div>
            <button className="menu-item" onClick={() => handleNavigate('/user/profile')}>
              Tài khoản của tôi
            </button>
            <button className="menu-item logout" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
