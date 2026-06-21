import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import { ORDER_HUB_URL } from '../api/app';
import * as signalR from '@microsoft/signalr';
import '../styles/Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, isAdmin } = useAuth();
  const { cartItems } = useCart();
  const { addNotification, unreadCount, incrementUnread, resetUnread } = useNotification();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Use refs to keep stable references to notification helpers for the SignalR callback
  const addNotificationRef = useRef(addNotification);
  const incrementUnreadRef = useRef(incrementUnread);
  
  useEffect(() => {
    addNotificationRef.current = addNotification;
    incrementUnreadRef.current = incrementUnread;
  }, [addNotification, incrementUnread]);

  useEffect(() => {
    let connection = null;

    if (token) {
      connection = new signalR.HubConnectionBuilder()
        .withUrl(ORDER_HUB_URL, {
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
        incrementUnreadRef.current();

        // Dispatch browser custom event so Profile.js can reload immediately
        const event = new CustomEvent('order-status-updated', { detail: { orderId, statusText } });
        window.dispatchEvent(event);
      });

      connection.on('ReceivePaymentSuccess', (orderId, message) => {
        console.log(`Received payment success for order ${orderId}: ${message}`);
        addNotificationRef.current(message, 'success');
        incrementUnreadRef.current();

        // Dispatch browser custom event so PaymentPage.js can receive it in real-time
        const event = new CustomEvent('payment-success-received', { detail: { orderId, message } });
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
