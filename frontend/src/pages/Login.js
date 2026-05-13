import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addNotification } = useNotification();
  const [formState, setFormState] = useState({ email: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (field) => (e) => {
    setFormState({ ...formState, [field]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Validate inputs
    if (!formState.email || !formState.password) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    // Check in localStorage
    const accounts = JSON.parse(localStorage.getItem('thebob-accounts')) || [];
    const user = accounts.find((acc) => acc.email === formState.email && acc.password === formState.password);

    if (user) {
      // Save current user
      const { password, ...userWithoutPassword } = user;
      login(userWithoutPassword);
      
      addNotification('Đăng nhập thành công!', 'success');
      // Redirect to home
      navigate('/');
    } else {
      setErrorMessage('Email hoặc mật khẩu không chính xác');
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
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              value={formState.password}
              onChange={handleChange('password')}
              placeholder="Mật khẩu"
            />
          </label>
          {errorMessage && <div className="auth-error">{errorMessage}</div>}
          <button type="submit" className="btn btn-primary full-width">
            Đăng nhập
          </button>
        </form>
        <div className="auth-footer">
          <span>Chưa có tài khoản?</span>
          <button type="button" className="link-button" onClick={() => navigate('/register')}>
            Đăng ký
          </button>
        </div>
      </div>
    </section>
  );
}
