import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import AdminLayout from '../components/AdminLayout';
import './Profile.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export default function Profile() {
  const navigate = useNavigate();
  const { user, token, updateUser, logout, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [activeMenu, setActiveMenu] = useState('account');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    birthDate: user?.birthDate || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) return;
      setLoading(true);

      try {
        console.log("PROFILE TOKEN:", token);
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
          
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          const profile = result.data;
          if (profile) {
            setFormData({
              name: profile.name || '',
              email: profile.email || '',
              birthDate: user?.birthDate || '',
              phone: profile.phone || '',
              address: profile.address || '',
            });
            updateUser(profile);
          }
        }
      } catch (error) {
        console.error('Fetch profile error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token, updateUser, user?.birthDate]);

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
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        addNotification(result.message || 'Không thể cập nhật thông tin', 'error');
      } else {
        const updatedProfile = result.data;
        updateUser(updatedProfile);
        setSuccessMessage('Cập nhật thông tin thành công!');
        addNotification('Cập nhật thông tin thành công!', 'success');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      addNotification('Lỗi kết nối server. Vui lòng thử lại.', 'error');
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
                    <div className="form-group">
                      <label>Ngày Sinh</label>
                      <input
                        type="date"
                        value={formData.birthDate}
                        onChange={handleInputChange('birthDate')}
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
                  <div className="form-group">
                    <label>*Ngày sinh</label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={handleInputChange('birthDate')}
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
              <p>Bạn chưa có đơn hàng nào.</p>
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
