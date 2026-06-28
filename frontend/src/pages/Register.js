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
  
  // Registration form states
  const [formState, setFormState] = useState({ 
    username: '', 
    email: '', 
    name: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });
  
  const [step, setStep] = useState(1); // 1: Info Form, 2: OTP Verification
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(300); // 5 minutes countdown
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Refs for OTP inputs
  const inputRefs = useRef([]);

  const handleChange = (field) => (e) => {
    setFormState({ ...formState, [field]: e.target.value });
  };

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Countdown timer effect
  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Focus the first OTP input when moving to step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);
    }
  }, [step]);

  // Format timer into mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle OTP digit changes
  const handleOtpChange = (index, value) => {
    // Only accept numeric inputs
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only keep the last digit
    setOtp(newOtp);

    // Auto-focus next input if a digit is entered
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle Backspace and arrow keys
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // If current box is empty, clear the previous box and focus it
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        if (inputRefs.current[index - 1]) {
          inputRefs.current[index - 1].focus();
        }
      } else {
        // Clear current box
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  // Handle Paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pasteData)) {
      addNotification('Mã OTP phải gồm 6 chữ số', 'error');
      return;
    }

    const digits = pasteData.split('');
    setOtp(digits);
    
    // Focus the last input box
    if (inputRefs.current[5]) {
      inputRefs.current[5].focus();
    }
  };

  // Step 1: Validate info and Send OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const username = formState.username.trim();
    const email = formState.email.trim().toLowerCase();
    const name = formState.name.trim();
    const phone = formState.phone.trim();
    const password = formState.password;
    const confirmPassword = formState.confirmPassword;

    // --- VALIDATION ---
    if (!username || !email || !name || !phone || !password || !confirmPassword) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Định dạng email không hợp lệ');
      setLoading(false);
      return;
    }

    const phoneRegex = /^(0|\+84)\d{9,10}$/;
    if (!phoneRegex.test(phone)) {
      setErrorMessage('Định dạng số điện thoại không hợp lệ');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu không khớp');
      setLoading(false);
      return;
    }

    if (username.length < 3) {
      setErrorMessage('Tên đăng nhập phải có ít nhất 3 ký tự');
      setLoading(false);
      return;
    }

    try {
      // Call backend send-otp API
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.message || 'Không thể gửi mã xác thực');
        setLoading(false);
        return;
      }

      addNotification('Mã OTP đã được gửi đến email của bạn', 'success');
      setStep(2);
      setTimer(300); // 5 minutes
      setOtp(['', '', '', '', '', '']); // Reset OTP input fields
    } catch (error) {
      console.error('Send OTP error:', error);
      setErrorMessage('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (timer > 0) return;
    setResending(true);
    setErrorMessage('');
    
    const email = formState.email.trim().toLowerCase();

    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.message || 'Gửi lại OTP thất bại');
        return;
      }

      addNotification('Mã OTP mới đã được gửi!', 'success');
      setTimer(300); // Reset timer
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setErrorMessage('Lỗi kết nối. Không thể gửi lại mã.');
    } finally {
      setResending(false);
    }
  };

  // Step 2: Submit Register with OTP
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setErrorMessage('Vui lòng nhập đầy đủ mã xác thực gồm 6 chữ số');
      setLoading(false);
      return;
    }

    const { username, email, name, phone, address, password } = formState;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          password,
          otpCode
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

      addNotification('Đăng ký tài khoản thành công!', 'success');
      navigate('/');
    } catch (error) {
      console.error('Register error:', error);
      setErrorMessage('Lỗi đăng ký. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        {step === 1 ? (
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
                {loading ? 'Đang gửi mã OTP...' : 'Tiếp tục & Gửi OTP'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>Xác thực OTP</h2>
            <p>Mã xác thực đã được gửi đến email <strong>{formState.email}</strong>. Vui lòng nhập mã để kích hoạt tài khoản.</p>
            <form onSubmit={handleRegisterSubmit}>
              <div className="otp-container" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="otp-input"
                    disabled={loading}
                    autoComplete="off"
                  />
                ))}
              </div>

              <div className="otp-timer">
                {timer > 0 ? (
                  <span>Mã OTP hết hạn sau <strong style={{ color: '#4F46E5' }}>{formatTime(timer)}</strong></span>
                ) : (
                  <span style={{ color: '#DC2626', fontWeight: 600 }}>Mã OTP đã hết hạn</span>
                )}
              </div>

              {errorMessage && <div className="auth-error">{errorMessage}</div>}

              <button type="submit" className="btn btn-primary full-width" disabled={loading || timer === 0}>
                {loading ? 'Đang xác thực...' : 'Xác nhận & Đăng ký'}
              </button>

              <div className="otp-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={handleResendOtp}
                  disabled={timer > 0 || resending}
                  style={{ opacity: timer > 0 ? 0.5 : 1, cursor: timer > 0 ? 'not-allowed' : 'pointer', background: 'none', border: 'none', font: 'inherit' }}
                >
                  {resending ? 'Đang gửi lại...' : 'Gửi lại mã OTP'}
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setStep(1);
                    setErrorMessage('');
                  }}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', font: 'inherit', color: 'var(--muted)', fontWeight: 500 }}
                >
                  Quay lại sửa thông tin
                </button>
              </div>
            </form>
          </>
        )}

        {step === 1 && (
          <div className="auth-footer">
            <span>Đã có tài khoản?</span>
            <button type="button" className="link-button" onClick={() => navigate('/login')} disabled={loading}>
              Đăng nhập
            </button>
          </div>
        )}
      </div>
    </section>
  );
}