import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, ordersAPI } from '../api/app';
import AdminLayout from '../components/AdminLayout';
import './Profile.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  PendingPayment: { label: 'Chờ thanh toán', cls: 'pendingpayment' },
  Pending:        { label: 'Chờ xử lý',       cls: 'pending' },
  Processing:     { label: 'Đang xử lý',       cls: 'processing' },
  Shipped:        { label: 'Đang giao',         cls: 'shipped' },
  Delivered:      { label: 'Đã giao',           cls: 'delivered' },
  Cancelled:      { label: 'Đã hủy',            cls: 'cancelled' },
};

const getInitials = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

// ── Component ──────────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ✅ FIX: lấy cả loading và isAdminUser (boolean) thay vì gọi isAdmin()
  // Trước đây: isAdmin() là function mới mỗi render → gây re-render không cần thiết
  // isAdminUser là boolean stable từ useMemo trong AuthContext
  const { user, token, updateUser, logout, loading: authLoading, isAdminUser } = useAuth();
  const { addNotification } = useNotification();

  const initialMenu = searchParams.get('menu') || 'account';
  const [activeMenu, setActiveMenu] = useState(initialMenu);
  const [pageLoading, setPageLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [formData, setFormData] = useState({
    name:    user?.name    || '',
    email:   user?.email   || '',
    phone:   user?.phone   || '',
    address: user?.address || '',
  });
  const [successMessage, setSuccessMessage] = useState('');

  // Sync URL param → activeMenu
  useEffect(() => {
    const menu = searchParams.get('menu');
    if (menu) setActiveMenu(menu);
  }, [searchParams]);

  // Stable ref cho updateUser
  const updateUserRef = useRef(updateUser);
  useEffect(() => { updateUserRef.current = updateUser; }, [updateUser]);

  // Load profile
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!token) return;
      setPageLoading(true);
      try {
        const result = await authAPI.getProfile();
        const profile = result?.data;
        if (profile && alive) {
          setFormData({
            name:    profile.name    || '',
            email:   profile.email   || '',
            phone:   profile.phone   || '',
            address: profile.address || '',
          });
          updateUserRef.current(profile);
        }
      } catch (err) {
        console.error('Fetch profile error:', err);
      } finally {
        if (alive) setPageLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [token]);

  // Load orders
  const fetchUserOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const data = await ordersAPI.getUserOrders();
      setUserOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeMenu === 'orders') fetchUserOrders();
  }, [activeMenu, fetchUserOrders]);

  // SignalR real-time update
  useEffect(() => {
    const handler = () => fetchUserOrders();
    window.addEventListener('order-status-updated', handler);
    return () => window.removeEventListener('order-status-updated', handler);
  }, [fetchUserOrders]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleInputChange = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      addNotification('Vui lòng nhập họ tên và số điện thoại', 'warning');
      return;
    }
    setIsUpdating(true);
    setSuccessMessage('');
    try {
      const result = await authAPI.updateProfile({
        email:   formData.email,
        name:    formData.name,
        phone:   formData.phone,
        address: formData.address,
      });
      const updated = result?.data;
      if (updated) {
        updateUser(updated);
        setSuccessMessage('Cập nhật thành công!');
        addNotification('Cập nhật thông tin thành công!', 'success');
      } else {
        throw new Error('Phản hồi không hợp lệ.');
      }
    } catch (err) {
      console.error('Update error:', err);
      addNotification(err.response?.data?.message || err.message || 'Lỗi kết nối.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setSuccessMessage('Tính năng đổi mật khẩu sẽ được cập nhật sớm!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleLogout = () => {
    logout();
    addNotification('Đã đăng xuất.', 'info');
    navigate('/');
  };

  // ── Guard: chờ auth load xong trước khi render ────────────────────────────────
  // ✅ FIX quan trọng nhất:
  // Trước đây: authLoading chưa xong → isAdmin() = false → render user layout
  // Khi auth xong: isAdmin() = true → render lại admin layout → giao diện nhảy
  // Fix: chờ authLoading = false mới render, tránh flash sai layout
  if (authLoading || pageLoading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
        <p style={{ color:'#9a9a9a', fontSize:'0.9rem', letterSpacing:'0.08em' }}>
          ĐANG TẢI...
        </p>
      </div>
    );
  }

  // ── Form dùng chung ───────────────────────────────────────────────────────────
  const profileForm = (
    <form onSubmit={handleUpdateInfo} className="account-form">
      <div className="form-row">
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={formData.email} disabled className="disabled-input" />
        </div>
      </div>

      <div className="form-row two-cols">
        <div className="form-group">
          <label>Họ và tên *</label>
          <input
            type="text"
            value={formData.name}
            onChange={handleInputChange('name')}
            placeholder="Nguyễn Anh Đức"
          />
        </div>
        <div className="form-group">
          <label>Số điện thoại *</label>
          <input
            type="tel"
            inputMode="numeric"
            value={formData.phone}
            onChange={handleInputChange('phone')}
            placeholder="0908474355"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Địa chỉ giao hàng</label>
          <textarea
            rows={3}
            value={formData.address}
            onChange={handleInputChange('address')}
            placeholder="Số nhà, đường, phường/xã, quận/huyện, thành phố"
          />
          <span className="form-hint">Địa chỉ mặc định khi đặt hàng.</span>
        </div>
      </div>

      <button type="submit" className="btn-update" disabled={isUpdating}>
        {isUpdating ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
    </form>
  );

  // ── Admin layout ──────────────────────────────────────────────────────────────
  if (isAdminUser) {
    return (
      // ✅ hideTopbar=true → ẩn <header class="admin-topbar"> ở trang này
      <AdminLayout title="Hồ Sơ Admin" hideTopbar>
        <div className="admin-profile-section">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {successMessage && (
              <div className="success-message">✓ {successMessage}</div>
            )}
            <div style={{
              background: 'white', padding: '32px',
              borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ marginBottom: '24px', color: '#1a202c' }}>Thông Tin Hồ Sơ</h2>
              {profileForm}
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  style={{
                    background: '#e2e8f0', color: '#2d3748', border: 'none',
                    padding: '12px 24px', borderRadius: '8px',
                    cursor: 'pointer', fontWeight: '600',
                  }}
                >
                  ← Quay lại Bảng Điều Khiển
                </button>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ── User layout ───────────────────────────────────────────────────────────────
  return (
    <section className="account-page-container">
      <div className="account-page">

        {/* Sidebar */}
        <aside className="account-sidebar">
          <div className="sidebar-header">Tài khoản</div>

          <div className="sidebar-avatar">
            <div className="avatar-circle">{getInitials(formData.name)}</div>
            <span className="avatar-name">{formData.name || 'Thành viên'}</span>
            <span className="avatar-email">{formData.email}</span>
          </div>

          <nav className="sidebar-menu">
            <button
              className={`menu-item ${activeMenu === 'account' ? 'active' : ''}`}
              onClick={() => setActiveMenu('account')}
            >
              <span className="menu-icon">👤</span> Thông tin
            </button>
            <button
              className={`menu-item ${activeMenu === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveMenu('orders')}
            >
              <span className="menu-icon">📦</span> Đơn hàng
            </button>
            <button
              className={`menu-item ${activeMenu === 'password' ? 'active' : ''}`}
              onClick={() => setActiveMenu('password')}
            >
              <span className="menu-icon">🔐</span> Mật khẩu
            </button>
            <button className="menu-item logout" onClick={handleLogout}>
              <span className="menu-icon">🚪</span> Đăng xuất
            </button>
          </nav>
        </aside>

        {/* Main */}
        <main className="account-main">

          {/* TAB: Thông tin */}
          {activeMenu === 'account' && (
            <div className="account-section">
              <p className="account-section-title">Hồ sơ</p>
              <h2>Thông tin tài khoản</h2>
              {successMessage && (
                <div className="success-message">✓ {successMessage}</div>
              )}
              {profileForm}
            </div>
          )}

          {/* TAB: Đơn hàng */}
          {activeMenu === 'orders' && (
            <div className="account-section">
              <p className="account-section-title">Lịch sử</p>
              <h2>Đơn hàng của tôi</h2>

              {ordersLoading ? (
                <p style={{ color:'#9a9a9a', fontSize:'0.85rem', letterSpacing:'0.06em' }}>
                  ĐANG TẢI ĐƠN HÀNG...
                </p>
              ) : userOrders.length === 0 ? (
                <div className="orders-empty-state">
                  <span className="empty-icon">🛍️</span>
                  <p>Bạn chưa có đơn hàng nào.</p>
                  <button className="btn-shop-now" onClick={() => navigate('/products')}>
                    Mua sắm ngay
                  </button>
                </div>
              ) : (
                <div className="orders-history-list">
                  {userOrders.map((order) => {
                    const st = STATUS_MAP[order.status] ?? { label: order.status, cls: 'pending' };
                    return (
                      <div key={order.id} className="order-history-card">
                        <div className="order-history-header">
                          <div className="order-header-info">
                            <span className="order-id">#{order.id}</span>
                            <span className="order-date">
                              {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className={`status-badge ${st.cls}`}>{st.label}</span>
                        </div>

                        <div className="order-history-items-container">
                          <table className="order-history-items-table">
                            <thead>
                              <tr>
                                <th>Sản phẩm</th>
                                <th style={{ textAlign:'center' }}>Size</th>
                                <th style={{ textAlign:'center' }}>Màu</th>
                                <th style={{ textAlign:'right' }}>Đơn giá</th>
                                <th style={{ textAlign:'center' }}>SL</th>
                                <th style={{ textAlign:'right' }}>Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items?.map((item) => (
                                <tr key={item.id}>
                                  <td className="order-item-prod-cell">
                                    {item.imageUrl && (
                                      <img src={item.imageUrl} alt={item.productName} className="order-item-thumb" />
                                    )}
                                    <span className="order-item-name">{item.productName}</span>
                                  </td>
                                  <td style={{ textAlign:'center' }} className="order-item-meta-cell">{item.size || '—'}</td>
                                  <td style={{ textAlign:'center' }} className="order-item-meta-cell">{item.color || '—'}</td>
                                  <td style={{ textAlign:'right' }}>{item.price?.toLocaleString('vi-VN')} đ</td>
                                  <td style={{ textAlign:'center' }}>{item.quantity}</td>
                                  <td style={{ textAlign:'right', fontWeight:'700' }}>
                                    {(item.price * item.quantity)?.toLocaleString('vi-VN')} đ
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="order-history-footer">
                          <div className="order-footer-summary">
                            <span className="order-shipping-label">
                              Phí giao hàng:{' '}
                              {order.shippingAmount === 0
                                ? 'Miễn phí'
                                : `${order.shippingAmount?.toLocaleString('vi-VN')} đ`}
                            </span>
                            <span className="order-footer-total">
                              Tổng cộng: <strong>{order.totalAmount?.toLocaleString('vi-VN')} đ</strong>
                            </span>
                          </div>
                          <button className="btn-view-detail" onClick={() => navigate(`/orders/${order.id}`)}>
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: Mật khẩu */}
          {activeMenu === 'password' && (
            <div className="account-section">
              <p className="account-section-title">Bảo mật</p>
              <h2>Đổi mật khẩu</h2>
              {successMessage && (
                <div className="success-message">✓ {successMessage}</div>
              )}
              <p className="password-section-note">
                Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.
              </p>
              <form onSubmit={handleChangePassword} className="account-form">
                <div className="form-group">
                  <label>Mật khẩu hiện tại</label>
                  <input type="password" placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input type="password" placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label>Xác nhận mật khẩu mới</label>
                  <input type="password" placeholder="••••••••" />
                </div>
                <button type="submit" className="btn-update">Cập nhật mật khẩu</button>
              </form>
            </div>
          )}

        </main>
      </div>
    </section>
  );
}