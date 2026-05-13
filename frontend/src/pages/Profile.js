import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import './Profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { addNotification } = useNotification();
  const [activeMenu, setActiveMenu] = useState('account');
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    birthDate: user?.birthDate || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (field) => (e) => {
    setFormData({
      ...formData,
      [field]: e.target.value,
    });
  };

  const handleUpdateInfo = (e) => {
    e.preventDefault();
    updateUser(formData);
    addNotification('Cập nhật thông tin thành công!', 'success');
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
                  <div className="form-group">
                    <label>Địa chỉ</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={handleInputChange('address')}
                      placeholder="76 nguyễn sơn phú thọ hoà tân phú"
                    />
                  </div>
                </div>

                <div className="form-error" style={{ marginTop: '10px' }}>* Trường bắt buộc</div>

                <button type="submit" className="btn-update">
                  Cập nhật thông tin
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
  );
}
