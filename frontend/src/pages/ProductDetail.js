import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
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
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addNotification } = useNotification();
  const { token } = useAuth();

  const [product, setProduct] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setReviewLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reviews/product/${id}`);
      setReviews(response.ok ? await response.json() : []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setReviews([]);
    } finally {
      setReviewLoading(false);
    }
  }, [id]);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`);
      if (!response.ok) {
        addNotification('San pham khong ton tai', 'error');
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
      addNotification('Loi khi tai san pham', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, id, navigate]);

  useEffect(() => {
    fetchProduct();
    fetchReviews();
  }, [fetchProduct, fetchReviews]);

  useEffect(() => {
    if (product) setInWishlist(isInWishlist(product.id));
  }, [product, isInWishlist]);

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
    const baseImages = getImageUrls(product?.images);
    const fallbackImages = baseImages.length > 0 ? baseImages : [toText(product?.mainImageUrl) || '/placeholder.jpg'];

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

    if (selectedVariant.stock < quantity) {
      addNotification('Số lượng chọn vượt quá tồn kho', 'warning');
      return;
    }

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

    addNotification(`${product.name} đã được thêm vào giỏ hàng!`, 'success');
  };

  const handleWishlistToggle = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
      setInWishlist(false);
      addNotification('Da xoa khoi danh sach yeu thich', 'info');
    } else {
      addToWishlist(product);
      setInWishlist(true);
      addNotification('Da them vao danh sach yeu thich', 'success');
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewComment.trim()) {
      addNotification('Vui long nhap binh luan danh gia', 'warning');
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: Number(id),
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });

      if (!response.ok) throw new Error('Khong gui duoc danh gia');

      setReviewRating(5);
      setReviewComment('');
      await fetchReviews();
      addNotification('Cam on ban da gui danh gia!', 'success');
    } catch (error) {
      console.error('Failed to submit review:', error);
      addNotification('Gui danh gia that bai, vui long thu lai.', 'error');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) return <div className="loading-page">Dang tai san pham...</div>;
  if (!product) return <div className="error-page">San pham khong ton tai</div>;

  return (
    <>
    <div className="zara-page">
      <div className="zara-detail-container">
        <div className="zara-detail-gallery">
          {productImages.map((img, index) => (
            <img key={index} src={img} alt={product.name} className="zara-gallery-img" />
          ))}
        </div>

        <div className="zara-detail-info">
          <div className="zara-sticky-content">
            <h1 className="zara-detail-title">{toText(product.name).toUpperCase()}</h1>
            <div className="zara-detail-price">
              {productPrice.toLocaleString('vi-VN')} VNĐ
            </div>
            
            <p className="zara-detail-desc">{toText(product.description)}</p>

            <div className="zara-options-section">
              {colorOptions.length > 0 && (
                <div className="zara-option-group">
                  <label>MÀU SẮC</label>
                  <div className="zara-color-list">
                    {colorOptions.map((color) => (
                      <button
                        key={color.id}
                        className={`zara-btn-option ${normalizeId(selectedColorId) === normalizeId(color.id) ? 'active' : ''}`}
                        onClick={() => handleColorSelect(color.id)}
                      >
                        {color.name.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sizeOptions.length > 0 && (
                <div className="zara-option-group">
                  <label>KÍCH THƯỚC</label>
                  <div className="zara-size-list">
                    {sizeOptions.map((size) => (
                      <button
                        key={size.id}
                        className={`zara-btn-option ${normalizeId(selectedSizeId) === normalizeId(size.id) ? 'active' : ''}`}
                        disabled={size.disabled}
                        onClick={() => setSelectedSizeId(size.id)}
                      >
                        {size.name.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleAddToCart} 
              className="zara-btn-dark full-width"
              disabled={selectedVariant && selectedVariant.stock <= 0}
            >
              {selectedVariant && selectedVariant.stock <= 0 ? 'HẾT HÀNG' : 'THÊM VÀO GIỎ HÀNG'}
            </button>

            <button onClick={handleWishlistToggle} className="zara-btn-text full-width" style={{ marginTop: '10px' }}>
              {inWishlist ? 'XÓA KHỎI DANH SÁCH YÊU THÍCH' : 'THÊM VÀO DANH SÁCH YÊU THÍCH'}
            </button>
          </div>
        </div>
      </div>
      <div className="zara-breadcrumbs" style={{ padding: '20px 0' }}>
        <button onClick={() => navigate('/products')}>San Pham</button>
        <span> / </span>
        <span>{toText(product.name)}</span>
      </div>
    </div>

      <div className="product-detail-container">
        <div className="product-gallery">
          <div className="main-image-container">
            <div className="main-image">
              <img src={productImages[activeImageIndex]} alt={toText(product.name)} />
              {product.isFeatured && <span className="badge-featured">Noi Bat</span>}
            </div>
            {productImages.length > 1 && (
              <>
                <button
                  className="arrow-button prev-arrow"
                  onClick={() => setActiveImageIndex((activeImageIndex - 1 + productImages.length) % productImages.length)}
                  title="Anh truoc"
                >
                  ‹
                </button>
                <button
                  className="arrow-button next-arrow"
                  onClick={() => setActiveImageIndex((activeImageIndex + 1) % productImages.length)}
                  title="Anh tiep theo"
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
            <button
              className={`btn-wishlist ${inWishlist ? 'active' : ''}`}
              onClick={handleWishlistToggle}
              title={inWishlist ? 'Xoa khoi danh sach yeu thich' : 'Them vao danh sach yeu thich'}
            >
              ♥
            </button>
          </div>

          <div className="product-meta">
            <span className="brand">Thuong hieu: {toText(product.brandName ?? product.brand, 'Khong xac dinh')}</span>
            <span className="sku">Ma: {selectedVariant?.sku || toText(product.sku, '-')}</span>
            <span className="category">{toText(product.categoryName ?? product.category, 'Khong xac dinh')}</span>
          </div>

          <div className="product-rating">
            <span className="stars">★ {Number(product.rating ?? 0).toFixed(1)}</span>
            <span className="reviews">({product.reviewCount ?? 0} danh gia)</span>
          </div>

          <div className="product-price">
            <span className="price">{productPrice.toLocaleString('vi-VN')} VND</span>
            <span className={`stock-badge ${displayStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {selectedVariant ? (displayStock > 0 ? `Còn ${displayStock} sản phẩm` : 'Hết hàng') : `Tổng kho: ${totalStock}`}
            </span>
          </div>

          <div className="product-description">
            <h3>Mo Ta</h3>
            <p>{toText(product.description)}</p>
          </div>

          <div className="product-details-info">
            <div className="detail-item">
              <span className="label">Chat Lieu:</span>
              <span className="value">{toText(product.material, 'Khong xac dinh')}</span>
            </div>
            <div className="detail-item">
              <span className="label">Mau Sac:</span>
              <span className="value">{selectedColorName || 'Chua chon'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Huong Dan Cham Soc:</span>
              <span className="value">{toText(product.careInstructions, 'Khong xac dinh')}</span>
            </div>
          </div>

          <div className="product-options">
            {colorOptions.length > 0 && (
              <div className="option-group">
                <label>Mau Sac</label>
                <div className="color-options">
                  {colorOptions.map((color) => (
                    <button
                      key={color.id}
                      className={`color-button ${normalizeId(selectedColorId) === normalizeId(color.id) ? 'active' : ''} ${!color.hasStock ? 'low-opacity' : ''}`}
                      onClick={() => handleColorSelect(color.id)}
                    >
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

          <div className="reviews-section">
            <div className="reviews-header">
              <div>
                <h2>Danh gia & Nhan xet</h2>
                <p>{reviews.length} danh gia cho san pham nay</p>
              </div>
            </div>

            {reviewLoading ? (
              <p className="reviews-loading">Dang tai danh gia...</p>
            ) : (
              <div className="reviews-list">
                {reviews.length === 0 ? (
                  <div className="reviews-empty">Chua co danh gia nao cho san pham nay.</div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="review-card">
                      <div className="review-card-header">
                        <span className="review-username">{toText(review.username, 'Khach hang')}</span>
                        <span className="review-date">
                          {new Date(review.createdAt).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="review-stars">
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </div>
                      <p className="review-comment">{toText(review.comment)}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {token ? (
              <form className="review-form" onSubmit={handleSubmitReview}>
                <h3>Viet danh gia cua ban</h3>
                <div className="review-form-row">
                  <label htmlFor="reviewRating">Danh gia</label>
                  <select id="reviewRating" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <option key={star} value={star}>
                        {star} sao
                      </option>
                    ))}
                  </select>
                </div>

                <div className="review-form-row">
                  <label htmlFor="reviewComment">Binh luan</label>
                  <textarea
                    id="reviewComment"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    rows={5}
                    className="review-textarea"
                    placeholder="Viet cam nhan cua ban ve san pham..."
                  />
                </div>

                <button className="review-submit" type="submit" disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'Dang gui...' : 'Gui danh gia'}
                </button>
              </form>
            ) : (
              <div className="review-placeholder">Vui long dang nhap de viet binh luan danh gia san pham nay.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
