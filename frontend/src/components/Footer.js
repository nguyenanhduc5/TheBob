import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-section">
          <h4>ABOUT US</h4>
          <p>THEBOB - Premium minimal fashion for everyday life.</p>
        </div>
        <div className="footer-section">
          <h4>POLICY</h4>
          <ul>
            <li><a href="#exchange">EXCHANGE POLICY</a></li>
            <li><a href="#shipping">SHIPPING & PAYMENT</a></li>
            <li><a href="#privacy">PRIVACY POLICY</a></li>
          </ul>
        </div>
        <div className="footer-section">
          <h4>CONTACT</h4>
          <p>Email: contact@thebob.com</p>
          <p>Phone: +84 977 699 624</p>
        </div>
        <div className="footer-section">
          <h4>FOLLOW US</h4>
          <div className="social-links">
           <a href="https://www.instagram.com/12_bob_/" target="_blank">Instagram</a>
            <a href="https://www.facebook.com/anh.duc.843605?locale=vi_VN" target="_blank">Facebook</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2026 THEBOB. All rights reserved.</p>
      </div>
    </footer>
  );
}
