import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-section">
          <h4>CONTACT</h4>
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
          <h4>FOLLOW US</h4>
          <div className="social-links">
           <a href="https://www.instagram.com/12_bob_/" target="_blank" rel="noreferrer noopener">Instagram</a>
            <a href="https://www.facebook.com/anh.duc.843605?locale=vi_VN" target="_blank" rel="noreferrer noopener">Facebook</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2026 THEBOB. All rights reserved.</p>
      </div>
    </footer>
  );
}
