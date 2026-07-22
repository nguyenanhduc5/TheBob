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
  const { 
    addNotification, 
    dbNotifications, 
    dbUnreadCount, 
    fetchDbNotifications, 
    markDbAsRead, 
    markAllDbAsRead 
  } = useNotification();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  // Use refs to keep stable references to notification helpers for the SignalR callback
  const addNotificationRef = useRef(addNotification);
  const fetchDbNotificationsRef = useRef(fetchDbNotifications);
  
  useEffect(() => {
    addNotificationRef.current = addNotification;
    fetchDbNotificationsRef.current = fetchDbNotifications;
  }, [addNotification, fetchDbNotifications]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
          'Paid': 'Đã thanh toán',
          'Processing': 'Đang xử lý',
          'Shipped': 'Đang giao hàng',
          'Delivered': 'Đã giao hàng',
          'Cancelled': 'Đã hủy',
        };
        const statusVietnamese = statusMap[statusText] || statusText;

        addNotificationRef.current(`Đơn hàng #${orderId} của bạn đã chuyển sang trạng thái: [${statusVietnamese}]`, 'info');
        fetchDbNotificationsRef.current();

        // Dispatch browser custom event so Profile.js can reload immediately
        const event = new CustomEvent('order-status-updated', { detail: { orderId, statusText } });
        window.dispatchEvent(event);
      });

      connection.on('ReceivePaymentSuccess', (orderId, message) => {
        console.log(`Received payment success for order ${orderId}: ${message}`);
        addNotificationRef.current(message, 'success');
        fetchDbNotificationsRef.current();

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
  const hideHeaderPages = ['/login', '/register', '/admin', '/admin/products', '/admin/categories', '/admin/orders', '/admin/payments', '/admin/users', '/admin/profile', '/admin/settings'];
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
            className="header-link-button"
            onClick={() => handleNavigate('/blog')}
            aria-label="Blog"
          >
            BLOG
          </button>
          <button
            className="icon-button cart-icon"
            onClick={() => handleNavigate('/cart')}
            aria-label="View cart"
          >
            🛒
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
          <div className="notification-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              className="icon-button notification-icon"
              onClick={() => {
                setShowNotifDropdown(prev => !prev);
                fetchDbNotifications();
              }}
              aria-label="Notifications"
            >
              🔔
              {dbUnreadCount > 0 && (
                <span className="cart-badge" style={{ backgroundColor: '#e53e3e' }}>
                  {dbUnreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Thông báo mới nhận</span>
                  {dbUnreadCount > 0 && (
                    <button className="notif-mark-all" onClick={markAllDbAsRead}>
                      Đánh dấu tất cả đã đọc
                    </button>
                  )}
                </div>

                <div className="notif-list">
                  {dbNotifications.length === 0 ? (
                    <div className="notif-empty">Không có thông báo mới</div>
                  ) : (
                    dbNotifications.slice(0, 10).map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.isRead ? 'unread' : ''}`}
                        onClick={async () => {
                          if (!notif.isRead) {
                            await markDbAsRead(notif.id);
                          }
                          // If notification message contains order ID, navigate to it!
                          const orderIdMatch = notif.message.match(/#(\d+)/);
                          if (orderIdMatch) {
                            navigate(`/orders/${orderIdMatch[1]}`);
                            setShowNotifDropdown(false);
                          } else if (notif.message.toLowerCase().includes('voucher') || notif.message.toLowerCase().includes('coupon')) {
                            navigate('/my-vouchers');
                            setShowNotifDropdown(false);
                          }
                        }}
                      >
                        <div className="notif-icon-circle">
                          {notif.type === 'Success' ? '✅' : notif.type === 'Warning' ? '⚠️' : '📢'}
                        </div>
                        <div className="notif-content">
                          <p className="notif-message">{notif.message}</p>
                          <span className="notif-time">
                            {new Date(notif.createdAt).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {!notif.isRead && <span className="notif-unread-dot" />}
                      </div>
                    ))
                  )}
                </div>
                <div className="notif-footer">
                  <button 
                    onClick={() => {
                      setShowNotifDropdown(false);
                      navigate('/user/profile');
                    }}
                  >
                    Xem tất cả thông báo
                  </button>
                </div>
              </div>
            )}
          </div>
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
          <button onClick={() => handleNavigate('/collections')} className="mobile-nav-item">COLLECTION</button>
          <a href="#about" className="mobile-nav-item">ABOUT US</a>
          <button onClick={() => handleNavigate('/blog')} className="mobile-nav-item">BLOG</button>
        </nav>
      </div>

    </header>
  );
}
