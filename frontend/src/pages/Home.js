import '../styles/Home.css';
import img1 from '../image/flower.jpg';

const heroImage = 'https://pos.nvncdn.com/0406df-94299/bn/20260616_MKS0LDOj.jpg?v=1781597314';
const bannerItems = [
  {
    title: 'WHY THEBOB',
    description: 'Minimal basics, premium texture, effortless wear.',
    image: 'https://gemini.google.com/eb9f0f02-f307-4abd-a430-444a4fefbd61',
  },
  {
    title: 'PREMIUM ESSENTIALS',
    description: 'New arrivals designed for daily comfort.',
    image: 'https://pos.nvncdn.com/0406df-94299/art/20250207_C9iXu9hp.jpeg?v=1738899615',
  },
  {
    title: 'LIMITED OUTLET',
    description: 'Selected pieces with a modern, urban edge.',
    image: 'https://pos.nvncdn.com/0406df-94299/art/20240729_9WK15bbB.jpeg?v=1722245453',
  },
];

const extraBanners = [
  {
    title: 'BEST SELLERS',
    description: 'Top picks từ bộ sưu tập THEBOB, luôn cháy hàng.',
    image: 'https://pos.nvncdn.com/0406df-94299/ps/20260128_SbSswZ26Q9.jpeg?v=1769572605',
  },
  {
    title: 'NEW SEASON',
    description: 'Những món đồ mới nhất cho phong cách tối giản.',
    image: 'https://pos.nvncdn.com/0406df-94299/art/SSMA-LEGACY-DROP.jpg?v=1781240952',
  },
];

const wideBanner = {
  title: 'DISCOVER THEBOB',
  description: 'The modern wardrobe for everyday life, crafted with premium fabrics and thoughtful design.',
  image: 'https://pos.nvncdn.com/0406df-94299/ps/SUMMER26-SPIRIT-T-SHIRT-PINK-1.jpg?v=1780916477',
};

export default function Home() {
  return (
    <div className="bob-container">
      {/* 1. HERO BANNER CHÍNH */}
      <section className="bob-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="bob-hero-copy">
          <span className="bob-label">NEW COLLECTION</span>
          <h1 className="bob-title-xl">PHONG CÁCH MỚI CHO NGÀY BÌNH THƯỜNG</h1>
          <p className="bob-desc">CHẤT LIỆU PREMIUM, THIẾT KẾ TỐI GIẢN.</p>
          <button className="bob-btn-light">KHÁM PHÁ NGAY</button>
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

      {/* 4. WIDE BANNER TRÀN KHUNG PHÍA DƯỚI */}
      <section className="bob-wide-banner" style={{ backgroundImage: `url(${wideBanner.image})` }}>
        <div className="bob-wide-content">
          <span className="bob-label">NEW DROP</span>
          <h2 className="bob-title-lg">{wideBanner.title.toUpperCase()}</h2>
          <button className="bob-btn-dark">XEM CHI TIẾT</button>
        </div>
      </section>
    </div>
  );
}