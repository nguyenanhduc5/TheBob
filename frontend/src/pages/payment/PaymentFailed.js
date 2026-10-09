import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/PaymentFeedback.css';

export default function PaymentFailed() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <div className="payment-feedback-container">
      <div className="feedback-card error">
        <div className="feedback-icon-wrapper error">
          <svg className="feedback-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1>{t('payment.failed')}</h1>
        <p>{t('payment.failed.description')}</p>
        <p className="sub-text">{t('payment.failed.detail')}</p>
        
        <div className="feedback-actions">
          <button onClick={() => navigate('/checkout')} className="btn-feedback primary error">
            {t('payment.retry')}
          </button>
          <button onClick={() => navigate('/')} className="btn-feedback secondary">
            {t('payment.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
