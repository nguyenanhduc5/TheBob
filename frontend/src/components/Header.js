import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import '../styles/Header.css';

export default function Header() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { cartItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <button className="hamburger" onClick={() => setMobileMenuOpen((open) => !open)}>
          <span />
          <span />
          <span />
        </button>

        <button className="logo" onClick={() => handleNavigate('/')}>
          THEBOB
        </button>

        <div className="header-actions">
          <button className="icon-button" onClick={() => handleNavigate('/products')}>
            🔍
          </button>
          <button className="icon-button cart-icon" onClick={() => handleNavigate('/cart')}>
            🛒
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
          <button className="icon-button user-icon" onClick={handleUserIconClick}>
            👤
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
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
