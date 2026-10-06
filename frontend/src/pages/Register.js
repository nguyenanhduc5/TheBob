import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export default function Register() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { addNotification } = useNotification();

  // Step: 1 = nhập thông tin, 2 = nhập OTP
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form data
  const [formState, setFormState] = useState({
    username: '',
    email: '',
    name: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });

  // OTP
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (isAuthenticated()) navigate('/');
  }, [isAuthenticated, navigate]);

  // Đếm ngược OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const formatCountdown = () => {
    const m = Math.floor(countdown / 60);
    const s = countdown % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleChange = (field) => (e) => {
    setFormState({ ...formState, [field]: e.target.value });
    setErrorMessage('');
  };

  // Validate form bước 1
  const validateForm = () => {
    const { username, email, name, phone, password, confirmPassword } = formState;

    if (!username.trim() || !email.trim() || !name.trim() || !phone.trim() || !password || !confirmPassword) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin');
      return false;
    }
    if (username.trim().length < 3) {
      setErrorMessage('Tên đăng nhập phải có ít nhất 3 ký tự');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Định dạng email không hợp lệ');
      return false;
    }
    const phoneRegex = /^(0|\+84)\d{9,10}$/;
    if (!phoneRegex.test(phone.trim())) {
      setErrorMessage('Số điện thoại không hợp lệ (VD: 0912345678)');
      return false;
    }
    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu không khớp');
      return false;
    }
    return true;
  };

  // Bước 1: Gửi OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formState.email.trim().toLowerCase() })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.message || 'Gửi OTP thất bại');
        return;
      }

      // Chuyển sang bước 2
      setStep(2);
      setCountdown(300); // 5 phút
      setOtpDigits(['', '', '', '', '', '']);
      addNotification(`Mã OTP đã gửi về ${formState.email}`, 'success');

      // Focus vào ô OTP đầu tiên
      setTimeout(() => otpRefs.current[0]?.focus(), 100);

    } catch (error) {
      setErrorMessage('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý nhập OTP từng ô
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Chỉ cho nhập số

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // Chỉ lấy 1 ký tự
    setOtpDigits(newDigits);
    setErrorMessage('');

    // Auto focus ô tiếp theo
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  // Xử lý Backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Paste OTP
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...otpDigits];
    pasted.split('').forEach((char, i) => {
      if (i < 6) newDigits[i] = char;
    });
    setOtpDigits(newDigits);
    // Focus ô cuối có giá trị
    const lastIndex = Math.min(pasted.length, 5);
    otpRefs.current[lastIndex]?.focus();
  };

  // Gửi lại OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formState.email.trim().toLowerCase() })
      });
      const result = await response.json();
      if (!response.ok) {
        setErrorMessage(result.message || 'Gửi lại OTP thất bại');
        return;
      }
      setCountdown(300);
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      addNotification('Đã gửi lại mã OTP', 'success');
    } catch {
      setErrorMessage('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Bước 2: Xác nhận OTP + đăng ký
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const otpCode = otpDigits.join('');
    if (otpCode.length < 6) {
      setErrorMessage('Vui lòng nhập đủ 6 số OTP');
      return;
    }

    if (countdown <= 0) {
      setErrorMessage('Mã OTP đã hết hạn. Vui lòng gửi lại.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formState.username.trim(),
          email: formState.email.trim().toLowerCase(),
          name: formState.name.trim(),
          phone: formState.phone.trim(),
          address: formState.address.trim(),
          password: formState.password,
          otpCode
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.message || 'Đăng ký thất bại');
        return;
      }

      const { data } = result;
      login(data, data.token);
      addNotification('Đăng ký thành công! Chào mừng bạn đến với THEBOB 🎉', 'success');
      navigate('/');

    } catch (error) {
      setErrorMessage('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">

        {/* ===== BƯỚC 1: NHẬP THÔNG TIN ===== */}
        {step === 1 && (
          <>
            <h2>Đăng ký</h2>
            <p>Tạo tài khoản mới để quản lý thông tin và đơn hàng.</p>

            <form onSubmit={handleSendOtp}>
              <label>
                Tên đăng nhập
                <input
                  type="text"
                  value={formState.username}
                  onChange={handleChange('username')}
                  placeholder="Ít nhất 3 ký tự"
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
                  placeholder="Nhập email để nhận mã OTP"
                  disabled={loading}
                />
              </label>

              <label>
                Số điện thoại
                <input
                  type="tel"
                  value={formState.phone}
                  onChange={handleChange('phone')}
                  placeholder="VD: 0912345678"
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
                  placeholder="Ít nhất 6 ký tự"
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

              {errorMessage && (
                <div className="auth-error">{errorMessage}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary full-width"
                disabled={loading}
              >
                {loading ? '⏳ Đang gửi mã OTP...' : 'Gửi mã xác minh'}
              </button>
            </form>

            <div className="auth-footer">
              <span>Đã có tài khoản?</span>
              <button
                type="button"
                className="link-button"
                onClick={() => navigate('/login')}
                disabled={loading}
              >
                Đăng nhập
              </button>
            </div>
          </>
        )}

        {/* ===== BƯỚC 2: NHẬP OTP ===== */}
        {step === 2 && (
          <>
            <h2>Xác minh Email</h2>
            <p>
              Mã OTP đã được gửi đến <strong>{formState.email}</strong>.<br />
              Vui lòng kiểm tra hộp thư (kể cả thư mục Spam).
            </p>

            <form onSubmit={handleRegister}>
              {/* Ô nhập OTP */}
              <div style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
                margin: '24px 0'
              }}>
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => otpRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    disabled={loading}
                    style={{
                      width: 48,
                      height: 56,
                      fontSize: 24,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: `2px solid ${digit ? '#000' : '#ddd'}`,
                      borderRadius: 8,
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                  />
                ))}
              </div>

              {/* Đếm ngược */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                {countdown > 0 ? (
                  <p style={{ color: '#666', fontSize: 14 }}>
                    Mã hết hạn sau: <strong style={{ color: '#e00' }}>{formatCountdown()}</strong>
                  </p>
                ) : (
                  <p style={{ color: '#e00', fontSize: 14 }}>
                    Mã OTP đã hết hạn
                  </p>
                )}
              </div>

              {errorMessage && (
                <div className="auth-error">{errorMessage}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary full-width"
                disabled={loading || otpDigits.join('').length < 6}
              >
                {loading ? '⏳ Đang xác minh...' : 'Xác minh & Tạo tài khoản'}
              </button>
            </form>

            {/* Gửi lại OTP */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                className="link-button"
                onClick={handleResendOtp}
                disabled={loading || countdown > 0}
                style={{
                  opacity: countdown > 0 ? 0.5 : 1,
                  cursor: countdown > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {countdown > 0
                  ? `Gửi lại sau ${formatCountdown()}`
                  : '🔄 Gửi lại mã OTP'
                }
              </button>
            </div>

            {/* Quay lại */}
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setStep(1);
                  setErrorMessage('');
                  setOtpDigits(['', '', '', '', '', '']);
                }}
                disabled={loading}
              >
                ← Quay lại chỉnh sửa thông tin
              </button>
            </div>
          </>
        )}

      </div>
    </section>
  );
}