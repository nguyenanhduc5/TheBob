import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [formState, setFormState] = useState({ email: '', password: '' });

  useEffect(() => {
    if (isAuthenticated()) {
      if (isAdmin()) navigate('/admin');
      else navigate('/');
    }
  }, [isAuthenticated, isAdmin, navigate]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setFormState({ ...formState, [field]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    // Validate inputs
    if (!formState.email || !formState.password) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formState.email,
          password: formState.password,
        }),
      });

      const result = await response.json();
      console.log("LOGIN RESPONSE:", result);
      if (!response.ok) {
        setErrorMessage(result.message || 'Đăng nhập thất bại');
        setLoading(false);
        return;
      }

      // Save user and token
      const { data } = result;
      login(data, data.token);

      addNotification('Đăng nhập thành công!', 'success');
      
      // Redirect based on role
      if (data.role === 'Admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h2>Đăng nhập</h2>
        <p>Nhập email và mật khẩu để truy cập tài khoản của bạn.</p>
        <form onSubmit={handleSubmit}>
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
            Mật khẩu
            <input
              type="password"
              value={formState.password}
              onChange={handleChange('password')}
              placeholder="Mật khẩu"
              disabled={loading}
            />
          </label>
          {errorMessage && <div className="auth-error">{errorMessage}</div>}
          <button type="submit" className="btn btn-primary full-width" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        <div className="auth-footer">
          <span>Chưa có tài khoản?</span>
          <button type="button" className="link-button" onClick={() => navigate('/register')} disabled={loading}>
            Đăng ký
          </button>
        </div>
      </div>
    </section>
  );
}
