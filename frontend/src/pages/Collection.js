import { Link } from 'react-router-dom';
import '../styles/Collection.css'; // File CSS cho trang danh mục

import flowerImg from '../images/flower.jpg';
import smileImg from '../images/smile.jpg';
import cuaImg from '../images/cua.jpg';
import makeroomImg from '../images/makeroom.jpg';

const collections = [
  { 
    id: 'summer26-2', 
    name: 'SUMMER26 DROP 2', 
    subtitle: 'PREMIUM COTTON ESSENTIALS',
    description: 'Trải nghiệm sự thoải mái tuyệt đối với các thiết kế tối giản, phom dáng rộng rãi phóng khoáng cho ngày hè năng động.',
    image: flowerImg,
    label: 'NEW DROP'
  },
  { 
    id: 'summer26-1', 
    name: 'SUMMER26 DROP 1', 
    subtitle: 'STREET MINIMALISM',
    description: 'Sự kết hợp hoàn hảo giữa thời trang đường phố và phong cách tối giản. Đơn giản nhưng không bao giờ đơn điệu.',
    image: smileImg,
    label: 'HOT SELLER'
  },
  { 
    id: 'igifms', 
    name: '“IGIFMS” COLLECTION', 
    subtitle: 'URBAN APPAREL CONCEPT',
    description: 'Lấy cảm hứng từ nhịp sống đô thị hiện đại, mang đậm chất riêng cá tính với chất liệu dày dặn cao cấp.',
    image: cuaImg,
    label: 'LIMITED'
  },
  { 
    id: 'legacy', 
    name: 'SSMA "LEGACY" DROP', 
    subtitle: 'VINTAGE STREETWEAR',
    description: 'Những mảnh ghép di sản mang phong cách retro nguyên bản, khẳng định cái tôi thời trang khác biệt và thời thượng.',
    image: makeroomImg,
    label: 'LEGACY CLASSIC'
  },
];

export default function CollectionList() {
  return (
    <div className="collections-page">
      <div className="collections-header">
        <span className="collections-tag">THEBOB CONCEPT</span>
        <h1>BỘ SƯU TẬP</h1>
        <p>Những thiết kế được giám tuyển đặc biệt, mang ngôn ngữ tối giản tinh tế và chất lượng vượt trội từ THEBOB.</p>
      </div>

      <div className="collections-grid-custom">
        {collections.map((col) => (
          <Link to={`/collections/${col.id}`} key={col.id} className="collection-card-custom">
            <div className="collection-card-image-wrapper">
              <img src={col.image} alt={col.name} className="collection-card-image" />
              {col.label && <span className="collection-card-badge">{col.label}</span>}
              <div className="collection-card-overlay-hover">
                <span className="collection-card-btn">KHÁM PHÁ NGAY →</span>
              </div>
            </div>
            <div className="collection-card-info">
              <span className="collection-card-subtitle">{col.subtitle}</span>
              <h3 className="collection-card-title">{col.name}</h3>
              <p className="collection-card-desc">{col.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}