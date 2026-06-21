import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/PaymentFeedback.css';

export default function PaymentFailed() {
  const navigate = useNavigate();

  return (
    <div className="payment-feedback-container">
      <div className="feedback-card error">
        <div className="feedback-icon-wrapper error">
          <svg className="feedback-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1>Thanh toán thất bại</h1>
        <p>Giao dịch của bạn không thể hoàn tất.</p>
        <p className="sub-text">Hết thời hạn thực hiện thanh toán hoặc bạn đã chủ động hủy bỏ chuyển khoản.</p>
        
        <div className="feedback-actions">
          <button onClick={() => navigate('/checkout')} className="btn-feedback primary error">
            Thử lại thanh toán
          </button>
          <button onClick={() => navigate('/')} className="btn-feedback secondary">
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
