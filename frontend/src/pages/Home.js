import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendationAPI } from '../api/app';
import '../styles/Home.css';
import '../styles/Products.css'; // Reuse product card styles

const heroImage = 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/homy.jpg';
const bannerItems = [
  {
    title: 'WHY THEBOB',
    description: 'Minimal basics, premium texture, effortless wear.',
    image: 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/TEE%20BLUE.jpg',
  },
  {
    title: 'PREMIUM ESSENTIALS',
    description: 'New arrivals designed for daily comfort.',
    image: 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/black.jpg',
  },
  {
    title: 'LIMITED OUTLET',
    description: 'Selected pieces with a modern, urban edge.',
    image: 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/cool.jpg',
  },
];

const extraBanners = [
  {
    title: 'BEST SELLERS',
    description: 'Top picks từ bộ sưu tập THEBOB, luôn cháy hàng.',
    image: 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/flower.jpg',
  },
  {
    title: 'NEW SEASON',
    description: 'Những món đồ mới nhất cho phong cách tối giản.',
    image: 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/japan.jpg',
  },
];

const wideBanner = {
  title: 'DISCOVER THEBOB',
  description: 'The modern wardrobe for everyday life, crafted with premium fabrics and thoughtful design.',
  image: 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/king.jpg',
};

export default function Home() {
  const navigate = useNavigate();
  const [personalized, setPersonalized] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = !!localStorage.getItem('thebob-token');

  useEffect(() => {
    async function fetchHomeData() {
      try {
        setLoading(true);
        const trendingData = await recommendationAPI.getTrending(4);
        setTrending(trendingData || []);

        if (isLoggedIn) {
          const personalizedData = await recommendationAPI.getPersonalized(4);
          setPersonalized(personalizedData || []);
        }
      } catch (err) {
        console.error('Failed to fetch home recommendations:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHomeData();
  }, [isLoggedIn]);

  return (
    <div className="bob-container">
      {/* 1. HERO BANNER CHÍNH */}
      <section className="bob-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="bob-hero-copy">
          <span className="bob-label">NEW COLLECTION</span>
          <h1 className="bob-title-xl">PHONG CÁCH MỚI CHO NGÀY BÌNH THƯỜNG</h1>
          <p className="bob-desc">CHẤT LIỆU PREMIUM, THIẾT KẾ TỐI GIẢN.</p>
          <button 
            className="bob-btn-light" 
            onClick={() => navigate('/products')} 
          >
            KHÁM PHÁ NGAY
          </button>
        </div>
      </section>

      {/* 2. LƯỚI BANNER 3 CỘT KHÍT NHAU */}
      <section className="bob-banner-grid">
        {bannerItems.map((banner) => (
          <article key={banner.title} className="bob-banner-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="bob-banner-copy">
              <h2 className="bob-title-md">{banner.title.toUpperCase()}</h2>
              <p className="bob-desc-sm">{banner.description.toUpperCase()}</p>
            </div>
          </article>
        ))}
      </section>

      {/* 2.5 RECOMMENDATIONS - PERSONALIZED */}
      {isLoggedIn && personalized.length > 0 && (
        <section className="products-page" style={{ padding: '60px 5%', background: '#fafafa' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 300, letterSpacing: '0.1em', margin: '0 0 10px 0' }}>DÀNH RIÊNG CHO BẠN</h2>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>Gợi ý cá nhân hóa dựa trên hành vi duyệt web và mua sắm của bạn</p>
          </div>
          <div className="products-grid">
            {personalized.map((product) => (
              <div key={product.id} className="product-card" style={{ background: '#fff' }}>
                <div className="product-image-container" onClick={() => navigate(`/products/${product.id}`)}>
                  <img src={product.mainImageUrl || '/placeholder.jpg'} alt={product.name} className="product-image" />
                </div>
                <div className="product-info">
                  <h3 className="product-name" onClick={() => navigate(`/products/${product.id}`)}>{product.name}</h3>
                  <div className="product-price">{product.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button onClick={() => navigate(`/products/${product.id}`)} className="btn-add-to-cart">Xem chi tiết</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. LƯỚI BANNER ĐÔI 2 CỘT KHÍT NHAU */}
      <section className="bob-split-grid">
        {extraBanners.map((banner) => (
          <article key={banner.title} className="bob-split-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="bob-split-copy">
              <h3 className="bob-title-sm">{banner.title.toUpperCase()}</h3>
              <p className="bob-desc-xs">{banner.description.toUpperCase()}</p>
            </div>
          </article>
        ))}
      </section>

      {/* 3.5 RECOMMENDATIONS - TRENDING */}
      {trending.length > 0 && (
        <section className="products-page" style={{ padding: '60px 5%' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 300, letterSpacing: '0.1em', margin: '0 0 10px 0' }}>XU HƯỚNG MUA SẮM</h2>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>Những sản phẩm đang được yêu thích nhất thời gian qua</p>
          </div>
          <div className="products-grid">
            {trending.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-image-container" onClick={() => navigate(`/products/${product.id}`)}>
                  <img src={product.mainImageUrl || '/placeholder.jpg'} alt={product.name} className="product-image" />
                </div>
                <div className="product-info">
                  <h3 className="product-name" onClick={() => navigate(`/products/${product.id}`)}>{product.name}</h3>
                  <div className="product-price">{product.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button onClick={() => navigate(`/products/${product.id}`)} className="btn-add-to-cart">Xem chi tiết</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. WIDE BANNER TRÀN KHUNG PHÍA DƯỚI */}
      <section className="bob-wide-banner" style={{ backgroundImage: `url(${wideBanner.image})` }}>
        <div className="bob-wide-content">
          <span className="bob-label">NEW DROP</span>
          <h2 className="bob-title-lg">{wideBanner.title.toUpperCase()}</h2>
          <button className="bob-btn-dark" onClick={() => navigate('/products')}>
            XEM CHI TIẾT
          </button>
        </div>
      </section>
    </div>
  );
}