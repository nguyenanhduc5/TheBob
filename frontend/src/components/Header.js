import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import * as signalR from '@microsoft/signalr';
import '../styles/Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, isAdmin } = useAuth();
  const { cartItems } = useCart();
  const { addNotification } = useNotification();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Use ref to keep a stable reference to addNotification for the SignalR callback
  // This prevents the SignalR effect from restarting when the notification function changes
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  useEffect(() => {
    let connection = null;

    if (token) {
      const baseUrl = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace('/api', '') : 'http://localhost:5110';
      const hubUrl = `${baseUrl}/hubs/order`;

      connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => token
        })
        .withAutomaticReconnect()
        .build();

      connection.start()
        .then(() => {
          if (connection.state === signalR.HubConnectionState.Connected) {
            console.log('SignalR connected successfully to order hub');
          }
        })
        .catch(err => {
          // Bỏ qua lỗi AbortError (thường do React Strict Mode mount/unmount nhanh)
          // Hoặc khi connection bị dừng chủ động trước khi kịp start xong
          if (err.name !== 'AbortError') {
            console.error('SignalR connection failed: ', err);
          }
        });

      connection.on('ReceiveStatusUpdate', (orderId, statusText) => {
        console.log(`Received status update for order ${orderId}: ${statusText}`);

        const statusMap = {
          'Pending': 'Chờ xử lý',
          'Processing': 'Đang xử lý',
          'Shipped': 'Đang giao hàng',
          'Delivered': 'Đã giao hàng',
          'Cancelled': 'Đã hủy',
        };
        const statusVietnamese = statusMap[statusText] || statusText;

        addNotificationRef.current(`Đơn hàng #${orderId} của bạn đã chuyển sang trạng thái: [${statusVietnamese}]`, 'info');
        setUnreadCount(prev => prev + 1);

        // Dispatch browser custom event so Profile.js can reload immediately
        const event = new CustomEvent('order-status-updated', { detail: { orderId, statusText } });
        window.dispatchEvent(event);
      });
    }

    return () => {
      if (connection) {
        connection.stop()
          .then(() => console.log('SignalR connection stopped'))
          .catch(err => console.error('Error stopping SignalR connection: ', err));
      }
    };
  }, [token]);

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
            className="icon-button notification-icon"
            onClick={() => {
              setUnreadCount(0);
              handleNavigate('/user/profile?menu=orders');
            }}
            aria-label="Notifications"
            style={{ position: 'relative' }}
          >
            🔔
            {unreadCount > 0 && <span className="cart-badge" style={{ backgroundColor: '#e53e3e' }}>{unreadCount}</span>}
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
