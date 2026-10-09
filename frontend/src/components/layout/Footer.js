import './Footer.css';
import { usePreferences } from '../../context/PreferencesContext';

export default function Footer() {
  const { t } = usePreferences();

  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-section">
          <h4>{t('footer.contact')}</h4>
          <p>Email: contact@thebob.com</p>
          <p>Phone: +84 977 699 624</p>
          <p>Address: 828 Su Van Hanh, Ho Chi Minh City, Vietnam</p>
            <div className="footer-map">
    <iframe
      title="THEBOB Location"
      src="https://www.google.com/maps?q=828+Su+Van+Hanh+Ho+Chi+Minh+City+Vietnam&output=embed"
      width="100%"
      height="180"
      style={{ border: 0 }}
      allowFullScreen=""
      loading="lazy"
    ></iframe>
  </div>
        </div>
        <div className="footer-section">
          <h4>{t('footer.about')}</h4>
          <p>{t('footer.aboutText')}</p>
        </div>
        <div className="footer-section">
          <h4>{t('footer.policy')}</h4>
          <ul>
            <li><a href="#exchange">{t('footer.exchange')}</a></li>
            <li><a href="#shipping">{t('footer.shipping')}</a></li>
            <li><a href="#privacy">{t('footer.privacy')}</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>{t('footer.follow')}</h4>
          <div className="social-links">
           <a href="https://www.instagram.com/12_bob_/" target="_blank" rel="noreferrer noopener">Instagram</a>
            <a href="https://www.facebook.com/anh.duc.843605?locale=vi_VN" target="_blank" rel="noreferrer noopener">Facebook</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2026 THEBOB. {t('footer.rights')}</p>
      </div>
    </footer>
  );
}
