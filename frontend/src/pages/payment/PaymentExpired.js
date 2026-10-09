import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/PaymentFeedback.css';

export default function PaymentExpired() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <div className="payment-feedback-container">
      <div className="feedback-card error">
        <div className="feedback-icon-wrapper warning">
          <svg className="feedback-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z" stroke="currentColor" strokeWidth="2.6" />
          </svg>
        </div>
        <h1>{t('payment.expired')}</h1>
        <p>{t('payment.expired.description')}</p>
        <p className="sub-text">{t('payment.expired.detail')}</p>

        <div className="feedback-actions">
          <button onClick={() => navigate('/checkout')} className="btn-feedback primary error">
            {t('payment.createAgain')}
          </button>
          <button onClick={() => navigate('/')} className="btn-feedback secondary">
            {t('payment.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
