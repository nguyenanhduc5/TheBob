import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Tách biệt trạng thái loading để tránh xung đột UI và tránh kẹt nút bấm
  const [pageLoading, setPageLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // User orders state
  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Đồng bộ trạng thái menu khi thay đổi query tham số trên URL
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

  // Sử dụng useRef để bẻ gãy vòng lặp vô hạn (Infinite Loop) do hàm updateUser gây ra
  const updateUserRef = useRef(updateUser);
  useEffect(() => {
    updateUserRef.current = updateUser;
  }, [updateUser]);

  // Tải dữ liệu thông tin cá nhân khi truy cập trang
  useEffect(() => {
    let isCurrent = true;
    const loadProfile = async () => {
      if (!token) return;
      setPageLoading(true);

      try {
        const result = await authAPI.getProfile();
        const profile = result?.data;
        if (profile && isCurrent) {
          setFormData({
            name: profile.name || '',
            email: profile.email || '',
            phone: profile.phone || '',
            address: profile.address || '',
          });
          updateUserRef.current(profile);
        }
      } catch (error) {
        console.error('Fetch profile error:', error);
      } finally {
        if (isCurrent) setPageLoading(false);
      }
    };

    loadProfile();
    return () => {
      isCurrent = false;
    };
  }, [token]);

  const fetchUserOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const data = await ordersAPI.getUserOrders();
      setUserOrders(data || []);
    } catch (error) {
      console.error('Failed to fetch user orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  // Tải danh sách đơn đặt hàng khi tab Đơn hàng hoạt động
  useEffect(() => {
    if (activeMenu === 'orders') {
      fetchUserOrders();
    }
  }, [activeMenu, fetchUserOrders]);

  // Nhận thông báo cập nhật trạng thái đơn hàng thời gian thực từ SignalR
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

  // Hàm xử lý gửi form cập nhật thông tin
  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      addNotification('Vui lòng nhập tên và số điện thoại', 'warning');
      return;
    }

    setIsUpdating(true);
    setSuccessMessage('');

    try {
      const result = await authAPI.updateProfile({
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
      });

      const updatedProfile = result?.data;
      if (updatedProfile) {
        updateUser(updatedProfile);
        setSuccessMessage('Cập nhật thông tin thành công!');
        addNotification('Cập nhật thông tin thành công!', 'success');
      } else {
        throw new Error('Phản hồi từ máy chủ không hợp lệ.');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      addNotification(error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ.', 'error');
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
    addNotification('Đã đăng xuất thành công!', 'info');
    navigate('/');
  };

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  return (
    <>
      {isAdmin() ? (
        /* ==================== ADMIN LAYOUT ==================== */
        <AdminLayout title="Hồ Sơ Admin">
          <div className="admin-profile-section">
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {successMessage && <div className="success-message">{successMessage}</div>}
              
              <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginBottom: '24px', color: '#1a202c' }}>Thông Tin Hồ Sơ</h2>
                
                <form onSubmit={handleUpdateInfo} className="account-form">
                  <div className="form-row full-width">
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
                    <div className="form-group">
                      <label>Điện Thoại *</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange('phone')}
                        placeholder="0977699624"
                      />
                    </div>
                  </div>

                  <div className="form-row full-width">
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
                    <button 
                      type="submit" 
                      className="btn-update" 
                      disabled={isUpdating}
                      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    >
                      {isUpdating ? 'Đang cập nhật...' : 'Cập Nhật Thông Tin'}
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
        /* ==================== USER LAYOUT ==================== */
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
              {/* Cột Sidebar bên trái */}
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

              {/* Vùng nội dung chính bên phải */}
              <main className="account-main">
                {/* TAB 1: Cập nhật tài khoản */}
                {activeMenu === 'account' && (
                  <div className="account-section">
                    <h2>CẬP NHẬT THÔNG TIN TÀI KHOẢN</h2>
                    {successMessage && <div className="success-message">{successMessage}</div>}
                    
                    <form onSubmit={handleUpdateInfo} className="account-form">
                      {/* Dòng 1: Ô Email chiếm trọn 100% bề rộng */}
                      <div className="form-row full-width">
                        <div className="form-group">
                          <label>Email của bạn</label>
                          <input type="email" value={formData.email} disabled className="disabled-input" />
                        </div>
                      </div>

                      {/* Dòng 2: Ô Họ tên và Điện thoại song song chia đôi tỉ lệ 50-50 */}
                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>* Họ tên</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={handleInputChange('name')}
                            placeholder="Nguyễn Anh Đức"
                          />
                        </div>
                      </div>
                       <div className="form-row two-dienthoai">
                        <div className="form-group">
                          <label>* Điện thoại</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={handleInputChange('phone')}
                            placeholder="123456789"
                          />
                        </div>
                       </div>
                      {/* Dòng 3: Ô Địa chỉ giao hàng tách riêng hoàn toàn một dòng 100% bề rộng */}
                      <div className="form-row full-width">
                        <div className="form-group address-group">
                          <label>Địa chỉ giao hàng</label>
                          <textarea
                            rows={3}
                            value={formData.address}
                            onChange={handleInputChange('address')}
                            placeholder="Số nhà, đường, phường/xã, quận/huyện, thành phố"
                          />
                          <small className="form-hint">Nhập địa chỉ chi tiết để giao hàng chính xác hơn.</small>
                        </div>
                      </div>
                      <button type="submit" className="btn-update" disabled={isUpdating}>
                        {isUpdating ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 2: Đơn hàng */}
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
                              <span className={`status-badge ${order.status?.toLowerCase() || 'pending'}`}>
                                {order.status === 'PendingPayment' ? 'Chờ thanh toán' :
                                 order.status === 'Pending' ? 'Chờ xử lý' :
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
                                      <td style={{ textAlign: 'right' }}>{item.price?.toLocaleString('vi-VN')} VNĐ</td>
                                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                        {(item.price * item.quantity)?.toLocaleString('vi-VN')} VNĐ
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="order-history-footer">
                              <div className="order-footer-summary">
                                <span>Phí giao hàng: {order.shippingAmount === 0 ? 'Miễn phí' : `${order.shippingAmount?.toLocaleString('vi-VN')} VNĐ`}</span>
                                <span className="order-footer-total">Tổng tiền: <strong>{order.totalAmount?.toLocaleString('vi-VN')} VNĐ</strong></span>
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

                {/* TAB 3: Đổi mật khẩu */}
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