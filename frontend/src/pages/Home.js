import '../styles/Home.css';


const heroImage = 'https://pos.nvncdn.com/0406df-94299/bn/20260616_MKS0LDOj.jpg?v=1781597314';
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
  image: 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/japan.jpg',
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