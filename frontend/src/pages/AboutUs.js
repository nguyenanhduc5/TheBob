import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AboutUs.css';

const heroImage = 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/king.jpg';
const manifestoImage = 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/homy.jpg';
const ctaImage = 'https://raw.githubusercontent.com/nguyenanhduc5/TheBob/main/frontend/src/images/japan.jpg';

const values = [
  {
    icon: '◈',
    title: 'Premium Quality',
    desc: 'Mỗi sản phẩm được chế tác từ chất liệu được tuyển chọn kỹ lưỡng — mềm mại, bền lâu và ngày càng đẹp hơn theo thời gian.',
  },
  {
    icon: '◇',
    title: 'Minimal Design',
    desc: 'Chúng tôi tin vào vẻ đẹp của sự tối giản. Mỗi đường may, mỗi chi tiết đều có chủ đích — không thừa, không thiếu.',
  },
  {
    icon: '○',
    title: 'Everyday Wear',
    desc: 'THEBOB không phải thời trang để ngắm, mà là thời trang để sống. Thiết kế cho mọi khoảnh khắc trong ngày của bạn.',
  },
];

const timeline = [
  {
    year: '2022',
    title: 'Ra đời từ phòng ký túc xá',
    desc: 'THEBOB bắt đầu từ một chiếc tủ áo nhỏ và niềm tin đơn giản: quần áo tốt không nhất thiết phải đắt tiền hay phức tạp.',
  },
  {
    year: '2023',
    title: 'BST đầu tiên ra mắt',
    desc: 'Bộ sưu tập gồm 5 items, bán hết trong 3 ngày. Đó là lúc chúng tôi biết mình đang đi đúng hướng.',
  },
  {
    year: '2024',
    title: 'Mở rộng & phát triển',
    desc: 'Từ 5 đến 50 sản phẩm, từ 1 đến hàng nghìn khách hàng tin tưởng. Chúng tôi mở thêm xưởng sản xuất, cải thiện chất lượng từng khâu.',
  },
  {
    year: '2026',
    title: 'THEBOB hôm nay',
    desc: 'Vẫn giữ cùng triết lý ban đầu — chất liệu tốt, thiết kế tinh gọn, trung thực với khách hàng. Chỉ là quy mô lớn hơn.',
  },
];

const team = [
  {
    name: 'Nguyễn Anh Đức',
    role: 'Founder & Creative Director',
    emoji: '🧑‍🎨',
  },
  {
    name: 'Design Team',
    role: 'Product & Brand Design',
    emoji: '✏️',
  },
  {
    name: 'Production Team',
    role: 'Quality & Manufacturing',
    emoji: '🪡',
  },
];

export default function AboutUs() {
  const navigate = useNavigate();
  const timelineRef = useRef([]);

  // Intersection Observer cho timeline animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.2 }
    );

    timelineRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="about-page">
      {/* SEO */}
      <title>About Us — THEBOB | Premium Minimal Fashion</title>
      <meta name="description" content="Tìm hiểu về THEBOB — thương hiệu thời trang tối giản, chất liệu premium cho cuộc sống hàng ngày." />

      {/* ---- HERO ---- */}
      <section
        className="about-hero"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-label="About THEBOB hero"
      >
        <div className="about-hero-content">
          <span className="about-hero-eyebrow">Our Story</span>
          <h1 className="about-hero-title">Không chỉ là quần áo —<br />Đó là cách sống.</h1>
          <p className="about-hero-subtitle">
            THEBOB được xây dựng trên triết lý đơn giản: ăn mặc tốt không cần phải phức tạp.
            Chất liệu premium, thiết kế tối giản, phù hợp cho mọi khoảnh khắc.
          </p>
        </div>
      </section>

      {/* ---- MANIFESTO ---- */}
      <section className="about-manifesto">
        <div className="about-manifesto-text">
          <span className="section-label">Manifesto</span>
          <h2>Chúng tôi tin vào sự tối giản có chủ đích</h2>
          <p>
            Mỗi bộ sưu tập được tạo ra với một mục tiêu duy nhất: giúp bạn mặc đẹp mà không cần
            nghĩ nhiều. Không trend theo mùa, không phô trương — chỉ là những món đồ thực sự tốt,
            vừa vặn, và bền lâu.
          </p>
          <p>
            THEBOB không theo đuổi fast fashion. Chúng tôi sản xuất có kiểm soát, ưu tiên chất
            lượng hơn số lượng, và luôn minh bạch với khách hàng về những gì chúng tôi làm và
            tại sao.
          </p>
          <p>
            Từ chọn vải đến may thành phẩm — mọi bước đều được kiểm soát kỹ lưỡng để bạn nhận
            được đúng những gì bạn trả tiền.
          </p>
        </div>
        <div className="about-manifesto-image">
          <img src={manifestoImage} alt="THEBOB manifesto — premium minimal fashion" />
        </div>
      </section>

      {/* ---- VALUES ---- */}
      <section className="about-values" aria-label="Our values">
        <div className="about-values-header">
          <span className="section-label">What We Stand For</span>
          <h2>Giá trị cốt lõi</h2>
        </div>
        <div className="about-values-grid">
          {values.map((v) => (
            <div key={v.title} className="about-value-card">
              <span className="about-value-icon">{v.icon}</span>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- TIMELINE ---- */}
      <section className="about-story" aria-label="Brand history">
        <div className="about-story-header">
          <span className="section-label">Our Journey</span>
          <h2>Hành trình của THEBOB</h2>
        </div>
        <div className="about-timeline">
          {timeline.map((item, i) => (
            <div
              key={item.year}
              className="about-timeline-item"
              ref={(el) => (timelineRef.current[i] = el)}
            >
              <div className="about-timeline-year">{item.year}</div>
              <div className="about-timeline-title">{item.title}</div>
              <p className="about-timeline-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- TEAM ---- */}
      <section className="about-team" aria-label="Our team">
        <div className="about-team-header">
          <span className="section-label">The People</span>
          <h2>Đội ngũ THEBOB</h2>
        </div>
        <div className="about-team-grid">
          {team.map((member) => (
            <div key={member.name} className="about-team-card">
              <div className="team-placeholder">{member.emoji}</div>
              <div className="about-team-name">{member.name}</div>
              <div className="about-team-role">{member.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section
        className="about-cta"
        style={{ backgroundImage: `url(${ctaImage})` }}
        aria-label="Shop call to action"
      >
        <div className="about-cta-content">
          <h2>Khám phá bộ sưu tập</h2>
          <button className="about-cta-btn" onClick={() => navigate('/products')}>
            Shop Now
          </button>
        </div>
      </section>
    </div>
  );
}
