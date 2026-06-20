import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, ordersAPI } from '../api/app';
import AdminLayout from '../components/AdminLayout';
import './Profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token, updateUser, logout, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const initialMenu = searchParams.get('menu') || 'account';
  const [activeMenu, setActiveMenu] = useState(initialMenu);
  const [loading, setLoading] = useState(false);

  // User orders state
  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Sync menu state if query parameter changes
  useEffect(() => {
    const menu = searchParams.get('menu');
    if (menu) {
      setActiveMenu(menu);
    }
  }, [searchParams]);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) return;
      setLoading(true);

      try {
        const result = await authAPI.getProfile();
        const profile = result?.data;
        if (profile) {
          setFormData({
            name: profile.name || '',
            email: profile.email || '',
            phone: profile.phone || '',
            address: profile.address || '',
          });
          updateUser(profile);
        }
      } catch (error) {
        console.error('Fetch profile error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token, updateUser]);

  const fetchUserOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const data = await ordersAPI.getUserOrders();
      setUserOrders(data);
    } catch (error) {
      console.error('Failed to fetch user orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  // Fetch orders when active menu changes to orders
  useEffect(() => {
    if (activeMenu === 'orders') {
      fetchUserOrders();
    }
  }, [activeMenu, fetchUserOrders]);

  // Listen to real-time status updates from SignalR (Header.js event)
  useEffect(() => {
    const handleOrderStatusUpdate = (event) => {
      console.log('Profile page received real-time order update event:', event.detail);
      fetchUserOrders();
    };

    window.addEventListener('order-status-updated', handleOrderStatusUpdate);
    return () => {
      window.removeEventListener('order-status-updated', handleOrderStatusUpdate);
    };
  }, [fetchUserOrders]);

  const handleInputChange = (field) => (e) => {
    setFormData({
      ...formData,
      [field]: e.target.value,
    });
  };

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      addNotification('Vui lòng nhập tên và số điện thoại', 'warning');
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      const result = await authAPI.updateProfile({
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
      });

      const updatedProfile = result?.data;
      updateUser(updatedProfile);
      setSuccessMessage('Cập nhật thông tin thành công!');
      addNotification('Cập nhật thông tin thành công!', 'success');
    } catch (error) {
      console.error('Update profile error:', error);
      addNotification(error.message || 'Lỗi kết nối server. Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setSuccessMessage('Tính năng đổi mật khẩu sẽ được cập nhật sớm!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleLogout = () => {
    logout();
    addNotification('Đã đăng xuất thành công!', 'info');
    navigate('/');
  };

  return (
    <>
      {isAdmin() ? (
        // Admin Layout
        <AdminLayout title="Hồ Sơ Admin">
          <div className="admin-profile-section">
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {successMessage && <div className="success-message">{successMessage}</div>}
              
              <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginBottom: '24px', color: '#1a202c' }}>Thông Tin Hồ Sơ</h2>
                
                <form onSubmit={handleUpdateInfo} className="account-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" value={formData.email} disabled className="disabled-input" />
                    </div>
                  </div>

                  <div className="form-row two-cols">
                    <div className="form-group">
                      <label>Họ Tên *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={handleInputChange('name')}
                        placeholder="Nguyễn Anh Đức"
                      />
                    </div>
                  </div>

                  <div className="form-row two-cols">
                    <div className="form-group">
                      <label>Điện Thoại *</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange('phone')}
                        placeholder="0977699624"
                      />
                    </div>
                    <div className="form-group">
                      <label>Địa Chỉ</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={handleInputChange('address')}
                        placeholder="123 Đường ABC, Quận 1"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="submit" className="btn-update" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                      Cập Nhật Thông Tin
                    </button>
                    <button 
                      type="button" 
                      onClick={() => navigate('/admin')}
                      style={{ 
                        background: '#e2e8f0',
                        color: '#2d3748',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Quay Lại
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </AdminLayout>
      ) : (
        // User Layout
        <>
          {isAdmin() && (
            <div style={{ padding: '16px 32px', background: '#f7f7f7', borderBottom: '1px solid #e2e8f0' }}>
              <button
                onClick={() => navigate('/admin')}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                }}
              >
                ← Quay lại Bảng Điều Khiển
              </button>
            </div>
          )}
          <section className="account-page-container">
      <div className="account-page">
        {/* Sidebar */}
        <aside className="account-sidebar">
          <div className="sidebar-header">MEMBER</div>
          <nav className="sidebar-menu">
            <button
              className={`menu-item ${activeMenu === 'account' ? 'active' : ''}`}
              onClick={() => setActiveMenu('account')}
            >
              <span className="menu-icon">👤</span>
              Tài khoản của tôi
            </button>
            <button
              className={`menu-item ${activeMenu === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveMenu('orders')}
            >
              <span className="menu-icon">📦</span>
              Đơn hàng
            </button>
            <button
              className={`menu-item ${activeMenu === 'password' ? 'active' : ''}`}
              onClick={() => setActiveMenu('password')}
            >
              <span className="menu-icon">🔐</span>
              Đổi mật khẩu
            </button>
            <button
              className="menu-item logout"
              onClick={handleLogout}
            >
              <span className="menu-icon">🚪</span>
              Đăng xuất
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="account-main">
          {activeMenu === 'account' && (
            <div className="account-section">
              <h2>CẬP NHẬT THÔNG TIN TÀI KHOẢN</h2>
              {successMessage && <div className="success-message">{successMessage}</div>}
              <form onSubmit={handleUpdateInfo} className="account-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Email của bạn</label>
                    <input type="email" value={formData.email} disabled className="disabled-input" />
                  </div>
                </div>

                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>*Họ tên</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange('name')}
                      placeholder="Nguyễn Anh Đức"
                    />
                  </div>
                </div>

                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>*Điện thoại</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange('phone')}
                      placeholder="0908474355"
                    />
                  </div>
                  <div className="form-group address-group">
                    <label>Địa chỉ giao hàng</label>
                    <textarea
                      rows={4}
                      value={formData.address}
                      onChange={handleInputChange('address')}
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, thành phố"
                    />
                    <small>Nhập địa chỉ chi tiết để giao hàng chính xác hơn.</small>
                  </div>
                </div>

                <div className="form-error" style={{ marginTop: '10px' }}>* Trường bắt buộc</div>

                <button type="submit" className="btn-update" disabled={loading}>
                  {loading ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
                </button>
              </form>
            </div>
          )}

          {activeMenu === 'orders' && (
            <div className="account-section">
              <h2>ĐƠN HÀNG CỦA TÔI</h2>
              {ordersLoading ? (
                <p>Đang tải danh sách đơn hàng...</p>
              ) : userOrders.length === 0 ? (
                <p>Bạn chưa có đơn hàng nào.</p>
              ) : (
                <div className="orders-history-list">
                  {userOrders.map((order) => (
                    <div key={order.id} className="order-history-card">
                      <div className="order-history-header">
                        <div className="order-header-info">
                          <span className="order-id">Mã đơn: <strong>#{order.id}</strong></span>
                          <span className="order-date"> | Ngày đặt: {new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <span className={`status-badge ${order.status.toLowerCase()}`}>
                          {order.status === 'Pending' ? 'Chờ xử lý' :
                           order.status === 'Processing' ? 'Đang xử lý' :
                           order.status === 'Shipped' ? 'Đang giao' :
                           order.status === 'Delivered' ? 'Đã giao' :
                           order.status === 'Cancelled' ? 'Đã hủy' : order.status}
                        </span>
                      </div>

                      <div className="order-history-items-container">
                        <table className="order-history-items-table">
                          <thead>
                            <tr>
                              <th>Sản phẩm</th>
                              <th style={{ textAlign: 'center' }}>Size</th>
                              <th style={{ textAlign: 'center' }}>Màu</th>
                              <th style={{ textAlign: 'right' }}>Đơn giá</th>
                              <th style={{ textAlign: 'center' }}>Số lượng</th>
                              <th style={{ textAlign: 'right' }}>Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items && order.items.map((item) => (
                              <tr key={item.id}>
                                <td className="order-item-prod-cell">
                                  {item.imageUrl && (
                                    <img 
                                      src={item.imageUrl} 
                                      alt={item.productName} 
                                      className="order-item-thumb" 
                                    />
                                  )}
                                  <span className="order-item-name">{item.productName}</span>
                                </td>
                                <td style={{ textAlign: 'center' }} className="order-item-meta-cell">{item.size || '-'}</td>
                                <td style={{ textAlign: 'center' }} className="order-item-meta-cell">{item.color || '-'}</td>
                                <td style={{ textAlign: 'right' }}>{item.price.toLocaleString('vi-VN')} VNĐ</td>
                                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                  {(item.price * item.quantity).toLocaleString('vi-VN')} VNĐ
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="order-history-footer">
                        <div className="order-footer-summary">
                          <span>Phí giao hàng: {order.shippingAmount === 0 ? 'Miễn phí' : `${order.shippingAmount.toLocaleString('vi-VN')} VNĐ`}</span>
                          <span className="order-footer-total">Tổng tiền: <strong>{order.totalAmount.toLocaleString('vi-VN')} VNĐ</strong></span>
                        </div>
                        <button 
                          className="btn-view-detail"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          Chi tiết đơn hàng
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeMenu === 'password' && (
            <div className="account-section">
              <h2>ĐỔI MẬT KHẨU</h2>
              {successMessage && <div className="success-message">{successMessage}</div>}
              <form onSubmit={handleChangePassword} className="account-form">
                <div className="form-group">
                  <label>Mật khẩu hiện tại</label>
                  <input type="password" placeholder="Nhập mật khẩu hiện tại" />
                </div>

                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input type="password" placeholder="Nhập mật khẩu mới" />
                </div>

                <div className="form-group">
                  <label>Xác nhận mật khẩu mới</label>
                  <input type="password" placeholder="Xác nhận mật khẩu mới" />
                </div>

                <button type="submit" className="btn-update">
                  Cập nhật mật khẩu
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </section>
        </>
      )}
    </>
  );
}
