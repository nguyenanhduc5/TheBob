import '../styles/Home.css';

const heroImage = 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1600&q=80';
const bannerItems = [
  {
    title: 'WHY THEBOB',
    description: 'Minimal basics, premium texture, effortless wear.',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'PREMIUM ESSENTIALS',
    description: 'New arrivals designed for daily comfort.',
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'LIMITED OUTLET',
    description: 'Selected pieces with a modern, urban edge.',
    image: 'https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=900&q=80',
  },
];

const extraBanners = [
  {
    title: 'BEST SELLERS',
    description: 'Top picks từ bộ sưu tập THEBOB, luôn cháy hàng.',
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'NEW SEASON',
    description: 'Những món đồ mới nhất cho phong cách tối giản.',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
  },
];

const wideBanner = {
  title: 'DISCOVER THEBOB',
  description: 'The modern wardrobe for everyday life, crafted with premium fabrics and thoughtful design.',
  image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1600&q=80',
};

export default function Home() {
  return (
    <>
      <section className="zara-hero">
        <div className="hero-media" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="hero-copy">
          <span className="zara-label">NEW COLLECTION</span>
          <h1 className="zara-title-xl">PHONG CÁCH MỚI CHO NGÀY BÌNH THƯỜNG</h1>
          <p>CHẤT LIỆU PREMIUM, THIẾT KẾ TỐI GIẢN.</p>
          <button className="zara-btn-light">KHÁM PHÁ NGAY</button>
        </div>
      </section>

      <section className="zara-banner-grid">
        {bannerItems.map((banner) => (
          <article key={banner.title} className="banner-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="banner-copy">
              <h2 className="zara-title-md">{banner.title.toUpperCase()}</h2>
              <p className="zara-desc-sm">{banner.description.toUpperCase()}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="zara-split-grid">
        {extraBanners.map((banner) => (
          <article key={banner.title} className="split-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="split-copy">
              <h3 className="zara-title-sm">{banner.title.toUpperCase()}</h3>
              <p className="zara-desc-xs">{banner.description.toUpperCase()}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="zara-wide-banner" style={{ backgroundImage: `url(${wideBanner.image})` }}>
        <div className="wide-content">
          <span className="zara-label">NEW DROP</span>
          <h2 className="zara-title-lg">{wideBanner.title.toUpperCase()}</h2>
          <button className="zara-btn-dark">XEM NGAY</button>
        </div>
      </section>
    </>
  );
}
