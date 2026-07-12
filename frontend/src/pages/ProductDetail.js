import { useCallback, useEffect, useMemo, useRef, useState } from 'react';import { useParams, useNavigate } from 'react-router-dom';
import { recommendationAPI } from '../api/app';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import '../styles/ProductDetail.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return toText(value.name, fallback);
  const text = String(value).trim();
  return text || fallback;
};

const normalizeId = (value) => String(value ?? '');

const isKnownName = (value) => {
  const text = toText(value).trim();
  return Boolean(text && text.toUpperCase() !== 'UNKNOWN');
};

const getVariants = (product) => {
  const variants = Array.isArray(product?.variants)
    ? product.variants
    : Array.isArray(product?.productVariants)
      ? product.productVariants
      : [];

  return variants
    .map((variant) => ({
      id: variant.id ?? variant.Id,
      colorId: variant.colorId ?? variant.ColorId,
      sizeId: variant.sizeId ?? variant.SizeId,
      colorName: toText(variant.color ?? variant.Color),
      sizeName: toText(variant.size ?? variant.Size),
      hexCode: toText(variant.hexCode ?? variant.HexCode),
      sku: toText(variant.sku ?? variant.Sku),
      price: toNumber(variant.price ?? variant.Price),
      stock: toNumber(variant.stock ?? variant.Stock),
      isAvailable: (variant.isAvailable ?? variant.IsAvailable) !== false,
      images: Array.isArray(variant.images)
        ? variant.images
        : Array.isArray(variant.Images)
          ? variant.Images
          : [],
    }))
    .filter((variant) => variant.id && variant.colorId && variant.sizeId && isKnownName(variant.colorName) && isKnownName(variant.sizeName));
};

const getImageUrls = (images) =>
  (Array.isArray(images) ? images : [])
    .map((image) => toText(image?.url ?? image?.Url ?? image))
    .filter(Boolean);

const uniqueById = (items) => {
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(String(item.id))) map.set(String(item.id), item);
  });
  return [...map.values()];
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
 const { addToCart, cartItems } = useCart();
  const { addNotification } = useNotification();
  // FIX: Giữ addNotification stable để tránh re-render vô hạn
const addNotificationRef = useRef(addNotification);
useEffect(() => { addNotificationRef.current = addNotification; }, [addNotification]);
  const { token } = useAuth();

  const [product, setProduct] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState([]);
  const [fbt, setFbt] = useState([]);

  // View tracking
  useEffect(() => {
    const sessionId = localStorage.getItem('thebob-session-id') || 'session_' + Math.random().toString(36).substring(2);
    if (!localStorage.getItem('thebob-session-id')) {
      localStorage.setItem('thebob-session-id', sessionId);
    }
    const startTime = Date.now();

    return () => {
      const endTime = Date.now();
      const durationSeconds = Math.round((endTime - startTime) / 1000);
      recommendationAPI.trackView(id, sessionId, durationSeconds)
        .catch(err => console.error('Failed to track view:', err));
    };
  }, [id]);

  // Fetch recommendations
  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const relatedData = await recommendationAPI.getRelated(id, 4);
        setRelated(relatedData || []);

        const fbtData = await recommendationAPI.getFrequentlyBought(String(id), 4);
        setFbt(fbtData || []);
      } catch (err) {
        console.error("Failed to fetch product recommendations:", err);
      }
    }
    fetchRecommendations();
  }, [id]);

  const fetchProduct = useCallback(async () => {
  setLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/products/${id}`);
    if (!response.ok) {
      addNotificationRef.current('Sản phẩm không tồn tại', 'error');
      navigate('/products');
      return;
    }
    setProduct(await response.json());
    setSelectedColorId('');
    setSelectedSizeId('');
    setActiveImageIndex(0);
    setQuantity(1);
  } catch (error) {
    console.error('Failed to fetch product:', error);
    addNotificationRef.current('Lỗi khi tải sản phẩm', 'error');
  } finally {
    setLoading(false);
  }
}, [id, navigate]); // ✅ Bỏ addNotification khỏi deps

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const variants = useMemo(() => getVariants(product), [product]);

  const colorOptions = useMemo(() => {
    return uniqueById(
      variants.map((variant) => {
        const hasStock = selectedSizeId
          ? variants.some(item => normalizeId(item.colorId) === normalizeId(variant.colorId) && normalizeId(item.sizeId) === normalizeId(selectedSizeId) && item.stock > 0)
          : variants.some(item => normalizeId(item.colorId) === normalizeId(variant.colorId) && item.stock > 0);
          
        return {
          id: variant.colorId,
          name: variant.colorName,
          hexCode: variant.hexCode,
          hasStock,
        };
      })
    );
  }, [variants, selectedSizeId]);

  const sizeOptions = useMemo(() => {
    return uniqueById(
      variants.map((variant) => {
        const hasStock = selectedColorId
          ? variants.some(item => normalizeId(item.sizeId) === normalizeId(variant.sizeId) && normalizeId(item.colorId) === normalizeId(selectedColorId) && item.stock > 0)
          : variants.some(item => normalizeId(item.sizeId) === normalizeId(variant.sizeId) && item.stock > 0);

        return {
          id: variant.sizeId,
          name: variant.sizeName,
          disabled: !hasStock,
        };
      })
    );
  }, [variants, selectedColorId]);

  const selectedVariant = useMemo(
    () =>
      variants.find(
        (variant) =>
          normalizeId(variant.colorId) === normalizeId(selectedColorId) &&
          normalizeId(variant.sizeId) === normalizeId(selectedSizeId)
      ),
    [variants, selectedColorId, selectedSizeId]
  );

 const productImages = useMemo(() => {
    const mainImage = toText(product?.mainImageUrl);
    const otherImages = getImageUrls(product?.images).filter((img) => img !== mainImage);
    // Ảnh bìa (mainImage) luôn đứng đầu, sau đó mới tới các ảnh phụ
    const baseImages = mainImage ? [mainImage, ...otherImages] : otherImages;
    const fallbackImages = baseImages.length > 0 ? baseImages : ['/placeholder.jpg'];

    if (!selectedColorId) return fallbackImages;

    const colorImages = variants
      .filter((variant) => normalizeId(variant.colorId) === normalizeId(selectedColorId))
      .flatMap((variant) => getImageUrls(variant.images));

    return colorImages.length > 0 ? [...new Set(colorImages)] : fallbackImages;
  }, [variants, product, selectedColorId]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedColorId]);

  // Reset conflicting selections if combination becomes invalid
  useEffect(() => {
    if (selectedColorId && selectedSizeId) {
      const isValid = variants.some(
        (v) =>
          normalizeId(v.colorId) === normalizeId(selectedColorId) &&
          normalizeId(v.sizeId) === normalizeId(selectedSizeId) &&
          v.stock > 0 &&
          v.isAvailable !== false
      );
      if (!isValid) {
        setSelectedSizeId('');
      }
    }
  }, [selectedColorId, selectedSizeId, variants]);

  const productPrice = useMemo(() => {
    if (selectedVariant) return selectedVariant.price;
    const directPrice = toNumber(product?.price ?? product?.minPrice);
    if (directPrice > 0) return directPrice;
    return toNumber(variants.find((variant) => variant.price > 0)?.price);
  }, [selectedVariant, variants, product]);

  const totalStock = useMemo(
    () => variants.reduce((sum, variant) => sum + variant.stock, 0),
    [variants]
  );

  const selectedColorName = colorOptions.find((color) => normalizeId(color.id) === normalizeId(selectedColorId))?.name || '';
  const selectedSizeName = sizeOptions.find((size) => normalizeId(size.id) === normalizeId(selectedSizeId))?.name || '';
  const displayStock = selectedVariant?.stock ?? totalStock;

  const handleColorSelect = (colorId) => {
    if (normalizeId(selectedColorId) !== normalizeId(colorId)) {
      setSelectedColorId(colorId);
      setQuantity(1);
    }
  };

  const handleAddToCart = () => {
    if (!token) {
      addNotification('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!', 'warning');
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (!selectedColorId) {
      addNotification('Vui lòng chọn màu sắc', 'warning');
      return;
    }

    if (!selectedSizeId) {
      addNotification('Vui lòng chọn kích thước', 'warning');
      return;
    }

    if (!selectedVariant) {
      addNotification('Biến thể này không khả dụng', 'warning');
      return;
    }

    if (selectedVariant.stock <= 0) {
      addNotification('Biến thể này đã hết hàng', 'warning');
      return;
    }

  const alreadyInCart = cartItems.find(
  i => i.variantId === selectedVariant.id
)?.quantity ?? 0;
const totalQty = alreadyInCart + quantity;
if (totalQty > selectedVariant.stock) {
  addNotification(`Chỉ còn ${selectedVariant.stock} sản phẩm trong kho`, 'warning');
  return;
}

  // ✅ SAU KHI FIX
try {
  addToCart(
    {
      id: product.id,
      variantId: selectedVariant.id,
      productId: product.id,
      colorId: selectedVariant.colorId,
      sizeId: selectedVariant.sizeId,
      name: product.name,
      sku: selectedVariant.sku || product.sku,
      mainImageUrl: productImages[0],
      price: productPrice,
      stock: selectedVariant.stock,
      selectedSize: selectedSizeName,
      selectedColor: selectedColorName,
    },
    quantity
  );
  // ✅ Chỉ hiện success khi KHÔNG có lỗi
  addNotification(`${product.name} đã được thêm vào giỏ hàng! 🛒`, 'success');
}
 catch (error) {
  // ✅ Bắt lỗi → hiện toast thay vì crash
  addNotification(
    error?.message || 'Không thể thêm vào giỏ hàng. Vui lòng thử lại.',
    'warning'
  );
}
  };



  if (loading && !product) return <div className="loading-page">Đang tải sản phẩm...</div>;
  if (!product) return <div className="error-page">Sản phẩm không tồn tại</div>;

  return (
    <div className={loading ? 'grid-loading' : ''}>
      <div className="product-detail-container">
        <div className="product-gallery">
          <div className="main-image-container">
            <div className="main-image">
              <img src={productImages[activeImageIndex]} alt={toText(product.name)} />
              {product.isFeatured && <span className="badge-featured">Nổi Bật</span>}
            </div>
            {productImages.length > 1 && (
              <>
                <button
                  className="arrow-button prev-arrow"
                  onClick={() => setActiveImageIndex((activeImageIndex - 1 + productImages.length) % productImages.length)}
                  title="Ảnh trước"
                >
                  ‹
                </button>
                <button
                  className="arrow-button next-arrow"
                  onClick={() => setActiveImageIndex((activeImageIndex + 1) % productImages.length)}
                  title="Ảnh tiếp theo"
                >
                  ›
                </button>
              </>
            )}
          </div>
          {productImages.length > 1 && (
            <div className="thumbnail-list">
              {productImages.map((img, index) => (
                <button
                  key={`${img}-${index}`}
                  className={`thumbnail ${index === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(index)}
                >
                  <img src={img} alt={`${toText(product.name)} - ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-details">
          <div className="product-header">
            <h1>{toText(product.name)}</h1>
          </div>

          <div className="product-meta">
            <span className="brand">Thương hiệu: {toText(product.brandName ?? product.brand, 'Không xác định')}</span>
            <span className="sku">Mã: {selectedVariant?.sku || toText(product.sku, '-')}</span>
            <span className="category">{toText(product.categoryName ?? product.category, 'Không xác định')}</span>
          </div>



          {/* KHU VỰC GIÁ TIỀN & TỔNG KHO - TÁCH KHỐI ĐỂ TỰ ĐỘNG XUỐNG DÒNG */}
          <div className="product-price-block">
            <div className="price-display">
              {productPrice.toLocaleString('vi-VN')} VND
            </div>
          <div className={`stock-badge ${displayStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
  {selectedVariant
    ? (displayStock > 0 ? `Còn ${displayStock} sản phẩm` : '🚫 Hết hàng')
    : totalStock === 0
      ? '🚫 Sản phẩm đã hết hàng'
      : `Tổng kho: ${totalStock}`}
</div>
          </div>

          <div className="product-description">
            <h3>Mô Tả</h3>
            <p>{toText(product.description)}</p>
          </div>

          <div className="product-details-info">
            <div className="detail-item">
              <span className="label">Chất Liệu:</span>
              <span className="value">{toText(product.material, 'Không xác định')}</span>
            </div>
            <div className="detail-item">
              <span className="label">Màu Sắc:</span>
              <span className="value">{selectedColorName || 'Chưa chọn'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Hướng Dẫn Chăm Sóc:</span>
              <span className="value">{toText(product.careInstructions, 'Không xác định')}</span>
            </div>
          </div>

          <div className="product-options">
            {colorOptions.length > 0 && (
              <div className="option-group">
                <label>Màu Sắc</label>
                <div className="color-options">
                  {colorOptions.map((color) => (
                    <button
                      key={color.id}
                      className={`color-button ${normalizeId(selectedColorId) === normalizeId(color.id) ? 'active' : ''} ${!color.hasStock ? 'low-opacity' : ''}`}
                      onClick={() => handleColorSelect(color.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      {color.hexCode && (
                        <span 
                          style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: color.hexCode, 
                            border: '1px solid #ccc',
                            display: 'inline-block'
                          }} 
                        />
                      )}
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizeOptions.length > 0 && (
              <div className="option-group">
                <label>Kích Thước</label>
                <div className="size-options">
                  {sizeOptions.map((size) => (
                    <button
                      key={size.id}
                      className={`size-button ${normalizeId(selectedSizeId) === normalizeId(size.id) ? 'active' : ''}`}
                      onClick={() => {
                        if (!size.disabled) {
                          setSelectedSizeId(size.id);
                          setQuantity(1);
                        }
                      }}
                      disabled={size.disabled}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="option-group">
              <label>Số Lượng</label>
              <div className="quantity-selector">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                  −
                </button>
                <input type="number" value={quantity} readOnly />
                <button onClick={() => setQuantity(quantity + 1)} disabled={!selectedVariant || quantity >= selectedVariant.stock}>
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="product-actions">
            <button
              onClick={handleAddToCart}
              className="btn-add-to-cart-large"
              disabled={selectedVariant && selectedVariant.stock <= 0}
            >
              {selectedVariant && selectedVariant.stock <= 0 ? 'Hết hàng' : 'Thêm vào giỏ hàng'}
            </button>
            <button onClick={() => navigate('/products')} className="btn-continue-shopping">
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together */}
      {fbt.length > 0 && (
        <div className="recommendations-section-custom" style={{ padding: '60px 10%', borderTop: '1px solid #eee' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 300, letterSpacing: '0.05em', marginBottom: '30px', textAlign: 'center' }}>
            THƯỜNG MUA CÙNG NHAU
          </h2>
          <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '30px' }}>
            {fbt.map((item) => (
              <div key={item.id} className="product-card" style={{ border: '1px solid #eee', padding: '15px', background: '#fff' }}>
                <div className="product-image-container" onClick={() => navigate(`/products/${item.id}`)} style={{ cursor: 'pointer' }}>
                  <img src={item.mainImageUrl || '/placeholder.jpg'} alt={item.name} className="product-image" style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                </div>
                <div className="product-info" style={{ marginTop: '15px' }}>
                  <h3 className="product-name" onClick={() => navigate(`/products/${item.id}`)} style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 400, minHeight: '40px' }}>{item.name}</h3>
                  <div className="product-price" style={{ fontWeight: 600, margin: '8px 0', fontSize: '1.1rem' }}>{item.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button onClick={() => navigate(`/products/${item.id}`)} className="btn-add-to-cart" style={{ width: '100%', padding: '12px' }}>Xem chi tiết</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Products */}
      {related.length > 0 && (
        <div className="recommendations-section-custom" style={{ padding: '60px 10%', borderTop: '1px solid #eee', background: '#fafafa' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 300, letterSpacing: '0.05em', marginBottom: '30px', textAlign: 'center' }}>
            SẢN PHẨM LIÊN QUAN
          </h2>
          <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '30px' }}>
            {related.map((item) => (
              <div key={item.id} className="product-card" style={{ border: '1px solid #eee', padding: '15px', background: '#fff' }}>
                <div className="product-image-container" onClick={() => navigate(`/products/${item.id}`)} style={{ cursor: 'pointer' }}>
                  <img src={item.mainImageUrl || '/placeholder.jpg'} alt={item.name} className="product-image" style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                </div>
                <div className="product-info" style={{ marginTop: '15px' }}>
                  <h3 className="product-name" onClick={() => navigate(`/products/${item.id}`)} style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 400, minHeight: '40px' }}>{item.name}</h3>
                  <div className="product-price" style={{ fontWeight: 600, margin: '8px 0', fontSize: '1.1rem' }}>{item.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button onClick={() => navigate(`/products/${item.id}`)} className="btn-add-to-cart" style={{ width: '100%', padding: '12px' }}>Xem chi tiết</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}