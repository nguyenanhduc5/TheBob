import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/PaymentFeedback.css';

export default function PaymentSuccess() {
  const navigate = useNavigate();

  return (
    <div className="payment-feedback-container">
      <div className="feedback-card success">
        <div className="feedback-icon-wrapper success">
          <svg className="feedback-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1>Thanh toán thành công!</h1>
        <p>Cảm ơn bạn. Giao dịch chuyển khoản của bạn đã được xác nhận thành công.</p>
        <p className="sub-text">Đơn hàng của bạn đã chuyển sang trạng thái <strong>Đang xử lý</strong> và sẽ sớm được giao.</p>
        
        <div className="feedback-actions">
          <button onClick={() => navigate('/products')} className="btn-feedback primary">
            Tiếp tục mua sắm
          </button>
          <button onClick={() => navigate('/user/profile')} className="btn-feedback secondary">
            Xem đơn hàng của tôi
          </button>
        </div>
      </div>
    </div>
  );
}
