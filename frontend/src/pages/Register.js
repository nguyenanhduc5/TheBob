import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export default function Register() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { addNotification } = useNotification();
  const [formState, setFormState] = useState({ 
    username: '', 
    email: '', 
    name: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setFormState({ ...formState, [field]: e.target.value });
  };

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const username = formState.username.trim();
    const email = formState.email.trim().toLowerCase();
    const name = formState.name.trim();
    const phone = formState.phone.trim();
    const address = formState.address.trim();
    const password = formState.password;
    const confirmPassword = formState.confirmPassword;

    // --- VALIDATION ---

    // 1. Check required fields
    if (!username || !email || !name || !phone || !password || !confirmPassword) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin');
      setLoading(false);
      return;
    }

    // 2. Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Định dạng email không hợp lệ');
      setLoading(false);
      return;
    }

    // 3. Check phone format
    const phoneRegex = /^(0|\+84)\d{9,10}$/;
    if (!phoneRegex.test(phone)) {
      setErrorMessage('Định dạng số điện thoại không hợp lệ');
      setLoading(false);
      return;
    }

    // 4. Check password length
    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự');
      setLoading(false);
      return;
    }

    // 5. Check password match
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu không khớp');
      setLoading(false);
      return;
    }

    // 6. Check username length
    if (username.length < 3) {
      setErrorMessage('Tên đăng nhập phải có ít nhất 3 ký tự');
      setLoading(false);
      return;
    }

    try {
      // Call backend register API
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          name,
          phone,
          address,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.message || 'Đăng ký thất bại');
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const { data } = result;
      login(data, data.token);

      addNotification('Đăng ký thành công!', 'success');
      navigate('/');
    } catch (error) {
      console.error('Register error:', error);
      setErrorMessage('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h2>Đăng ký</h2>
        <p>Tạo tài khoản mới để quản lý thông tin và đơn hàng.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Tên đăng nhập
            <input
              type="text"
              value={formState.username}
              onChange={handleChange('username')}
              placeholder="Nhập tên đăng nhập (ít nhất 3 ký tự)"
              disabled={loading}
            />
          </label>

          <label>
            Tên đầy đủ
            <input
              type="text"
              value={formState.name}
              onChange={handleChange('name')}
              placeholder="Nhập họ và tên"
              disabled={loading}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={formState.email}
              onChange={handleChange('email')}
              placeholder="Nhập email"
              disabled={loading}
            />
          </label>

          <label>
            Số điện thoại
            <input
              type="tel"
              value={formState.phone}
              onChange={handleChange('phone')}
              placeholder="Nhập số điện thoại"
              disabled={loading}
            />
          </label>

          <label>
            Địa chỉ (tuỳ chọn)
            <input
              type="text"
              value={formState.address}
              onChange={handleChange('address')}
              placeholder="Nhập địa chỉ giao hàng"
              disabled={loading}
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={formState.password}
              onChange={handleChange('password')}
              placeholder="Mật khẩu (ít nhất 6 ký tự)"
              disabled={loading}
            />
          </label>

          <label>
            Xác nhận mật khẩu
            <input
              type="password"
              value={formState.confirmPassword}
              onChange={handleChange('confirmPassword')}
              placeholder="Nhập lại mật khẩu"
              disabled={loading}
            />
          </label>

          {errorMessage && <div className="auth-error">{errorMessage}</div>}
          
          <button type="submit" className="btn btn-primary full-width" disabled={loading}>
            {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Đã có tài khoản?</span>
          <button type="button" className="link-button" onClick={() => navigate('/login')} disabled={loading}>
            Đăng nhập
          </button>
        </div>
      </div>
    </section>
  );
}