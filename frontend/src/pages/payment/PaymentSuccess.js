import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/PaymentFeedback.css';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <div className="payment-feedback-container">
      <div className="feedback-card success">
        <div className="feedback-icon-wrapper success">
          <svg className="feedback-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1>{t('payment.success')}</h1>
        <p>{t('payment.thanks')}</p>
        <p className="sub-text">{t('payment.processing.description', { status: t('payment.processing') })}</p>
        
        <div className="feedback-actions">
          <button onClick={() => navigate('/products')} className="btn-feedback primary">
            {t('payment.continueShopping')}
          </button>
          <button onClick={() => navigate('/user/profile')} className="btn-feedback secondary">
            {t('payment.myOrders')}
          </button>
        </div>
      </div>
    </div>
  );
}
