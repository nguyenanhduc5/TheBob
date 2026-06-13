import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import '../styles/Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { cartItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hide header on admin pages
  const hideHeaderPages = ['/login', '/register', '/admin', '/admin/products', '/admin/categories', '/admin/orders', '/admin/users', '/admin/profile', '/admin/settings'];
  if (hideHeaderPages.some(page => location.pathname.startsWith(page))) {
    return null;
  }

  const handleUserIconClick = () => {
    if (user) {
      const profilePath = isAdmin() ? '/admin/profile' : '/user/profile';
      navigate(profilePath);
    } else {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const handleNavigate = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <header className="main-header">
      <div className="top-banner">OUTLET</div>
      <div className="header-container">
        <button
          className="hamburger"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          <span />
          <span />
          <span />
        </button>

        <button className="logo" onClick={() => handleNavigate('/')}>
          THEBOB
        </button>

        <div className="header-actions">
          <button
            className="icon-button"
            onClick={() => handleNavigate('/products')}
            aria-label="Search products"
          >
            🔍
          </button>
          <button
            className="icon-button cart-icon"
            onClick={() => handleNavigate('/cart')}
            aria-label="View cart"
          >
            🛒
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
          <button
            className="icon-button user-icon"
            onClick={handleUserIconClick}
            aria-label="Account"
          >
            👤
          </button>
        </div>
      </div>

      <div id="mobile-menu" className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <nav className="mobile-nav">
          <button onClick={() => handleNavigate('/products')} className="mobile-nav-item">
            SHOP
          </button>
          <a href="#collection" className="mobile-nav-item">COLLECTION</a>
          <a href="#about" className="mobile-nav-item">ABOUT US</a>
          <a href="#outlet" className="mobile-nav-item">OUTLET</a>
        </nav>
      </div>

    </header>
  );
}
