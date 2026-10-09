import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendationAPI } from '../../api/app';
import FeaturedBlogSection from '../../components/blog/FeaturedBlogSection';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/Home.css';
import '../../styles/Products.css'; // Reuse product card styles

import homyImg from '../../images/homy.jpg';
import teeBlueImg from '../../images/TEE BLUE.jpg';
import blackImg from '../../images/black.jpg';
import coolImg from '../../images/cool.jpg';
import flowerImg from '../../images/flower.jpg';
import japanImg from '../../images/japan.jpg';
import kingImg from '../../images/king.jpg';

const heroImage = homyImg;
const bannerItems = [
  {
    titleKey: 'home.banner.why',
    descriptionKey: 'home.banner.whyDescription',
    image: teeBlueImg,
  },
  {
    titleKey: 'home.banner.essentials',
    descriptionKey: 'home.banner.essentialsDescription',
    image: blackImg,
  },
  {
    titleKey: 'home.banner.outlet',
    descriptionKey: 'home.banner.outletDescription',
    image: coolImg,
  },
];

const extraBanners = [
  {
    titleKey: 'home.banner.bestsellers',
    descriptionKey: 'home.banner.bestsellersDescription',
    image: flowerImg,
  },
  {
    titleKey: 'home.banner.season',
    descriptionKey: 'home.banner.seasonDescription',
    image: japanImg,
  },
];

const wideBanner = {
  description: 'The modern wardrobe for everyday life, crafted with premium fabrics and thoughtful design.',
  image: kingImg,
};

export default function Home() {
  const navigate = useNavigate();
  const { t } = usePreferences();
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
          <h1 className="bob-title-xl">{t('home.hero.title')}</h1>
          <p className="bob-desc">{t('home.hero.description')}</p>
          <button 
            className="bob-btn-light" 
            onClick={() => navigate('/products')} 
          >
            {t('home.hero.action')}
          </button>
        </div>
      </section>

      {/* 2. LƯỚI BANNER 3 CỘT KHÍT NHAU */}
      <section className="bob-banner-grid">
        {bannerItems.map((banner) => (
          <article key={banner.titleKey} className="bob-banner-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="bob-banner-copy">
              <h2 className="bob-title-md">{t(banner.titleKey).toUpperCase()}</h2>
              <p className="bob-desc-sm">{t(banner.descriptionKey).toUpperCase()}</p>
            </div>
          </article>
        ))}
      </section>

      {/* 2.5 RECOMMENDATIONS - PERSONALIZED */}
      {isLoggedIn && personalized.length > 0 && (
        <section className="rec-section rec-section--alt">
          <div className="rec-section-header">
            <span className="rec-section-label">{t('home.personalized.label')}</span>
            <h2 className="rec-section-title">{t('home.personalized.title')}</h2>
            <p className="rec-section-sub">{t('home.personalized.description')}</p>
          </div>
          <div className="rec-grid">
            {personalized.map((product) => (
              <div key={product.id} className="rec-card" onClick={() => navigate(`/product/${product.slug || product.id}`)}>
                <div className="rec-card-img">
                  <img src={product.mainImageUrl || '/placeholder.jpg'} alt={product.name} />
                </div>
                <div className="rec-card-info">
                  <h3 className="rec-card-name">{product.name}</h3>
                  <div className="rec-card-price">{product.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button className="rec-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.slug || product.id}`); }}>{t('home.product.details')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. LƯỚI BANNER ĐÔI 2 CỘT KHÍT NHAU */}
      <section className="bob-split-grid">
        {extraBanners.map((banner) => (
          <article key={banner.titleKey} className="bob-split-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="bob-split-copy">
              <h3 className="bob-title-sm">{t(banner.titleKey).toUpperCase()}</h3>
              <p className="bob-desc-xs">{t(banner.descriptionKey).toUpperCase()}</p>
            </div>
          </article>
        ))}
      </section>

      {/* 3.5 RECOMMENDATIONS - TRENDING */}
      {trending.length > 0 && (
        <section className="rec-section">
          <div className="rec-section-header">
            <span className="rec-section-label">{t('home.trending.label')}</span>
            <h2 className="rec-section-title">{t('home.trending.title')}</h2>
            <p className="rec-section-sub">{t('home.trending.description')}</p>
          </div>
          <div className="rec-grid">
            {trending.map((product) => (
              <div key={product.id} className="rec-card" onClick={() => navigate(`/product/${product.slug || product.id}`)}>
                <div className="rec-card-img">
                  <img src={product.mainImageUrl || '/placeholder.jpg'} alt={product.name} />
                </div>
                <div className="rec-card-info">
                  <h3 className="rec-card-name">{product.name}</h3>
                  <div className="rec-card-price">{product.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button className="rec-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.slug || product.id}`); }}>{t('home.product.details')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3.6 FEATURED BLOG POSTS */}
      <FeaturedBlogSection />

      {/* 4. WIDE BANNER TRÀN KHUNG PHÍA DƯỚI */}
      <section className="bob-wide-banner" style={{ backgroundImage: `url(${wideBanner.image})` }}>
        <div className="bob-wide-content">
          <span className="bob-label">{t('home.wide.label')}</span>
          <h2 className="bob-title-lg">{t('home.wide.title')}</h2>
          <button className="bob-btn-dark" onClick={() => navigate('/products')}>
            {t('home.wide.action')}
          </button>
        </div>
      </section>
    </div>
  );
}
