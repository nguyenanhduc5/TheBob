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
      <section className="hero-section">
        <div className="hero-media" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="hero-copy">
          <span className="hero-label">NEW COLLECTION</span>
          <h1>Phong cách mới cho ngày bình thường.</h1>
          <p>Chất liệu premium, form dáng thoải mái và thiết kế tối giản, phù hợp với mọi hoạt động trong ngày.</p>
          <button className="btn btn-primary">Khám phá ngay</button>
        </div>
      </section>

      <section className="banner-grid">
        {bannerItems.map((banner) => (
          <article key={banner.title} className="banner-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="banner-copy">
              <h2>{banner.title}</h2>
              <p>{banner.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="split-banner-row">
        {extraBanners.map((banner) => (
          <article key={banner.title} className="split-card" style={{ backgroundImage: `url(${banner.image})` }}>
            <div className="split-copy">
              <h3>{banner.title}</h3>
              <p>{banner.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="wide-banner" style={{ backgroundImage: `url(${wideBanner.image})` }}>
        <div className="wide-content">
          <span>NEW DROP</span>
          <h2>{wideBanner.title}</h2>
          <p>{wideBanner.description}</p>
          <button className="btn btn-primary">Xem ngay</button>
        </div>
      </section>
    </>
  );
}
