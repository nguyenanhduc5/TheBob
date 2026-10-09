import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const { t } = usePreferences();
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

    const email = formState.email.trim().toLowerCase();
    const password = formState.password;

    // Validate inputs
    if (!email || !password) {
      setErrorMessage(t('auth.error.required'));
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage(t('auth.error.email'));
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
          email,
          password,
        }),
      });

      const result = await response.json();
      console.log("LOGIN RESPONSE:", result);
      if (!response.ok) {
        setErrorMessage(result.message || t('auth.error.login'));
        setLoading(false);
        return;
      }

      // Save user, token and refresh token
      const { data } = result;
      login(data, data.token, data.refreshToken);

      addNotification('Đăng nhập thành công!', 'success');
      
      // Redirect based on role
      if (data.role === 'Admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage(t('auth.error.server'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h2>{t('auth.login.title')}</h2>
        <p>{t('auth.login.description')}</p>
        <form onSubmit={handleSubmit}>
          <label>
            {t('auth.email')}
            <input
              type="email"
              value={formState.email}
              onChange={handleChange('email')}
              placeholder={t('auth.emailPlaceholder')}
              disabled={loading}
            />
          </label>
          <label>
            {t('auth.password')}
            <input
              type="password"
              value={formState.password}
              onChange={handleChange('password')}
              placeholder={t('auth.passwordPlaceholder')}
              disabled={loading}
            />
          </label>
          {errorMessage && <div className="auth-error">{errorMessage}</div>}
          <button type="submit" className="btn btn-primary full-width" disabled={loading}>
            {loading ? t('auth.login.loading') : t('auth.login.submit')}
          </button>
        </form>
        <div className="auth-footer">
          <span>{t('auth.login.noAccount')}</span>
          <button type="button" className="link-button" onClick={() => navigate('/register')} disabled={loading}>
            {t('auth.register')}
          </button>
        </div>
      </div>
    </section>
  );
}
