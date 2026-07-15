import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { productsAPI } from '../api/app';
import '../styles/Collection.css';
import '../styles/Products.css'; // Reuse product card styles

import flowerImg from '../images/flower.jpg';
import smileImg from '../images/smile.jpg';
import cuaImg from '../images/cua.jpg';
import makeroomImg from '../images/makeroom.jpg';

const collectionMetadata = {
  'summer26-2': {
    name: 'SUMMER26 DROP 2',
    subtitle: 'PREMIUM COTTON ESSENTIALS',
    description: 'Trải nghiệm sự thoải mái tuyệt đối với các thiết kế tối giản, phom dáng rộng rãi phóng khoáng cho ngày hè năng động.',
    image: flowerImg,
    productIds: [10, 24, 15] // SHORT, TEE PLUS, TEE MESSI
  },
  'summer26-1': {
    name: 'SUMMER26 DROP 1',
    subtitle: 'STREET MINIMALISM',
    description: 'Sự kết hợp hoàn hảo giữa thời trang đường phố và phong cách tối giản. Đơn giản nhưng không bao giờ đơn điệu.',
    image: smileImg,
    productIds: [20, 7] // TEE BLUE, Quần
  },
  'igifms': {
    name: '“IGIFMS” COLLECTION',
    subtitle: 'URBAN APPAREL CONCEPT',
    description: 'Lấy cảm hứng từ nhịp sống đô thị hiện đại, mang đậm chất riêng cá tính với chất liệu dày dặn cao cấp.',
    image: cuaImg,
    productIds: [21, 23] // SOMI, LONG SLEEVE
  },
  'legacy': {
    name: 'SSMA "LEGACY" DROP',
    subtitle: 'VINTAGE STREETWEAR',
    description: 'Những mảnh ghép di sản mang phong cách retro nguyên bản, khẳng định cái tôi thời trang khác biệt và thời thượng.',
    image: makeroomImg,
    productIds: [22, 19, 18, 16] // Jacket Black, Jacket, HODDIE, TEE ASIAN
  }
};

export default function CollectionDetail() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const colInfo = collectionMetadata[collectionId];

  useEffect(() => {
    async function loadProducts() {
      if (!colInfo) {
        setLoading(false);
        return;
      }
      try {
        const allProducts = await productsAPI.getProducts();
        // Filter products that are in the collection's productIds list
        const filtered = allProducts.filter(p => colInfo.productIds.includes(p.id));
        setProducts(filtered);
      } catch (err) {
        console.error('Failed to load products for collection:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [collectionId, colInfo]);

  if (!colInfo) {
    return (
      <div className="collections-page">
        <Link to="/collections" className="back-to-collections">
          ← Quay lại danh sách
        </Link>
        <div className="collection-empty">
          <h3>Không tìm thấy bộ sưu tập</h3>
          <p>Đường dẫn không hợp lệ hoặc bộ sưu tập này không tồn tại.</p>
        </div>
      </div>
    );
  }

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  return (
    <div className="collection-detail-page">
      <Link to="/collections" className="back-to-collections">
        ← Tất cả bộ sưu tập
      </Link>

      {/* Hero Banner */}
      <section 
        className="collection-hero" 
        style={{ backgroundImage: `url(${colInfo.image})` }}
      >
        <div className="collection-hero-content">
          <span className="collection-hero-tag">{colInfo.subtitle}</span>
          <h1 className="collection-hero-title">{colInfo.name}</h1>
          <p className="collection-hero-desc">{colInfo.description}</p>
        </div>
      </section>

      {/* Product List */}
      {loading ? (
        <div className="collection-loading">
          Đang tải sản phẩm...
        </div>
      ) : products.length === 0 ? (
        <div className="collection-empty">
          <h3>Sản phẩm sắp ra mắt</h3>
          <p>Hiện tại chưa có sản phẩm nào thuộc bộ sưu tập này được mở bán.</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => {
            const colorsMap = new Map();
            (product.variants || product.productVariants || []).forEach(v => {
              const cId = v.colorId ?? v.ColorId;
              const cName = v.color ?? v.Color;
              const cHex = v.hexCode ?? v.HexCode;
              if (cId && cHex && !colorsMap.has(cId)) {
                colorsMap.set(cId, { id: cId, name: cName, hexCode: cHex });
              }
            });
            const productColors = Array.from(colorsMap.values());

            return (
              <div key={product.id} className="product-card">
                <div
                  className="product-image-container"
                  onClick={() => handleProductClick(product.id)}
                >
                  <img
                    src={product.mainImageUrl || '/placeholder.jpg'}
                    alt={product.name}
                    className="product-image"
                  />
                  {product.isFeatured && <span className="badge-featured">Nổi Bật</span>}
                  {(product.productVariants ?? []).reduce(
                    (sum, v) => sum + (Number(v.stock ?? v.Stock) || 0), 0
                  ) === 0 && (
                    <span className="badge-sold-out">Hết Hàng</span>
                  )}
                </div>
                <div className="product-info">
                  <h3 className="product-name" onClick={() => handleProductClick(product.id)}>
                    {product.name}
                  </h3>
                  <div className="product-card-colors" style={{ display: 'flex', gap: '6px', alignItems: 'center', height: '20px', margin: '8px 0' }}>
                    {productColors.slice(0, 3).map(color => (
                      <span 
                        key={color.id} 
                        title={color.name}
                        style={{ 
                          width: '12px', 
                          height: '12px', 
                          borderRadius: '50%', 
                          backgroundColor: color.hexCode, 
                          border: '1px solid #ccc',
                          display: 'inline-block'
                        }} 
                      />
                    ))}
                    {productColors.length > 3 && (
                      <span style={{ fontSize: '0.72rem', color: '#666', fontWeight: '500' }}>
                        +{productColors.length - 3}
                      </span>
                    )}
                  </div>
                  <div className="product-price">
                    {product.price !== undefined && product.price !== null
                      ? product.price.toLocaleString('vi-VN')
                      : product.productVariants?.[0]?.price
                      ? product.productVariants[0].price.toLocaleString('vi-VN')
                      : '0'}{' '}
                    VNĐ
                  </div>
                  <button
                    onClick={() => handleProductClick(product.id)}
                    className="btn-add-to-cart"
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
