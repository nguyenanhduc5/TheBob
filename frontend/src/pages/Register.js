import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import '../styles/Auth.css';

export default function Register() {
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [formState, setFormState] = useState({ name: '', email: '', phone: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (field) => (e) => {
    setFormState({ ...formState, [field]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    const { name, email, phone, password } = formState;

    // --- LOGIC VALIDATION (PHẠM VI KIỂM TRA) ---
    
    // 1. Kiểm tra trống
    if (!name || !email || !phone || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    // 2. Kiểm tra định dạng Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Định dạng email không hợp lệ');
      return;
    }

    // 3. Kiểm tra số điện thoại (Logic: phải là số, từ 10-11 chữ số)
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(phone)) {
      setErrorMessage('Số điện thoại phải có 10 hoặc 11 chữ số');
      return;
    }

    // 4. Kiểm tra độ dài mật khẩu (Logic: ít nhất 6 ký tự)
    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    // --- LOGIC KIỂM TRA TRÙNG LẶP ---
    const accounts = JSON.parse(localStorage.getItem('thebob-accounts')) || [];
    
    if (accounts.some((acc) => acc.email === email)) {
      setErrorMessage('Email này đã được đăng ký');
      return;
    }
    
    if (accounts.some((acc) => acc.phone === phone)) {
      setErrorMessage('Số điện thoại này đã được đăng ký');
      return;
    }

    // --- LOGIC LƯU TRỮ ---
    const newAccount = {
      name,
      email,
      phone,
      password, // Trong thực tế nên hash mật khẩu, nhưng ở mức local thì lưu thế này
      birthDate: '',
      address: '',
    };

    accounts.push(newAccount);
    localStorage.setItem('thebob-accounts', JSON.stringify(accounts));

    addNotification('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
    navigate('/login');
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h2>Đăng ký</h2>
        <p>Tạo tài khoản mới để quản lý thông tin và đơn hàng.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Họ và tên
            <input
              type="text"
              value={formState.name}
              onChange={handleChange('name')}
              placeholder="Nhập họ và tên"
            />
          </label>

          <label>
            Số điện thoại
            <input
              type="text"
              value={formState.phone}
              onChange={handleChange('phone')}
              placeholder="Nhập số điện thoại"
            />
          </label>

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
              placeholder="Mật khẩu (ít nhất 6 ký tự)"
            />
          </label>

          {errorMessage && <div className="auth-error">{errorMessage}</div>}
          
          <button type="submit" className="btn btn-primary full-width">
            Tạo tài khoản
          </button>
        </form>

        <div className="auth-footer">
          <span>Đã có tài khoản?</span>
          <button type="button" className="link-button" onClick={() => navigate('/login')}>
            Đăng nhập
          </button>
        </div>
      </div>
    </section>
  );
}