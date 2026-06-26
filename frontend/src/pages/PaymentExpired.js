import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/PaymentFeedback.css';

export default function PaymentExpired() {
  const navigate = useNavigate();

  return (
    <div className="payment-feedback-container">
      <div className="feedback-card error">
        <div className="feedback-icon-wrapper warning">
          <svg className="feedback-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z" stroke="currentColor" strokeWidth="2.6" />
          </svg>
        </div>
        <h1>Da het han thanh toan</h1>
        <p>Don hang chuyen khoan da qua thoi gian 15 phut.</p>
        <p className="sub-text">Ban co the quay lai gio hang de tao don thanh toan moi.</p>

        <div className="feedback-actions">
          <button onClick={() => navigate('/checkout')} className="btn-feedback primary error">
            Tao lai thanh toan
          </button>
          <button onClick={() => navigate('/')} className="btn-feedback secondary">
            Ve trang chu
          </button>
        </div>
      </div>
    </div>
  );
}
