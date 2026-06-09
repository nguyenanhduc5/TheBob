import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import '../styles/ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { addNotification } = useNotification();

  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);

  const { token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setReviewLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/reviews/product/${id}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      } else {
        setReviews([]);
      }
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
      const response = await fetch(`${process.env.REACT_APP_API_URL}/products/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);

        const variants = data.productVariants || [];
        const firstAvailableVariant = variants.find((variant) => variant.stock > 0) || variants[0];
        const availableSizes = Array.from(new Set(variants.map((variant) => variant.size).filter(Boolean)));

        if (firstAvailableVariant?.size) {
          setSelectedSize(firstAvailableVariant.size);
        } else if (availableSizes.length > 0) {
          setSelectedSize(availableSizes[0]);
        }

        const availableColors = Array.from(new Set(variants.map((variant) => variant.color).filter(Boolean)));

        if (firstAvailableVariant?.color) {
          setSelectedColor(firstAvailableVariant.color);
        } else if (availableColors.length > 0) {
          setSelectedColor(availableColors[0]);
        }
      } else {
        addNotification('Sản phẩm không tồn tại', 'error');
        navigate('/products');
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      addNotification('Lỗi khi tải sản phẩm', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, id, navigate]);

  useEffect(() => {
    fetchProduct();
    fetchReviews();
  }, [fetchProduct, fetchReviews]);

  useEffect(() => {
    if (product) {
      setInWishlist(isInWishlist(product.id));
    }
  }, [product, isInWishlist]);

  const handleAddToCart = () => {
    if (!selectedSize) {
      addNotification('Vui lòng chọn kích thước', 'warning');
      return;
    }

    if (!selectedVariant) {
      addNotification('Biáº¿n thá»ƒ nÃ y khÃ´ng kháº£ dá»¥ng', 'warning');
      return;
    }

    if (selectedVariant.stock < quantity) {
      addNotification('Sá»‘ lÆ°á»£ng chá»n vÆ°á»£t quÃ¡ tá»“n kho', 'warning');
      return;
    }

    const cartItem = {
      id: product.id,
      variantId: selectedVariant.id,
      name: product.name,
      sku: selectedVariant.sku || product.sku,
      mainImageUrl: product.mainImageUrl,
      price: selectedVariant.price,
      stock: selectedVariant.stock,
      selectedSize,
      selectedColor,
      quantity,
    };

    addToCart(cartItem);
    addNotification(`${product.name} đã được thêm vào giỏ hàng!`, 'success');
  };

  const handleWishlistToggle = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
      setInWishlist(false);
      addNotification('Đã xóa khỏi danh sách yêu thích', 'info');
    } else {
      addToWishlist(product);
      setInWishlist(true);
      addNotification('Đã thêm vào danh sách yêu thích', 'success');
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewComment.trim()) {
      addNotification('Vui lòng nhập bình luận đánh giá', 'warning');
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/reviews`, {
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

      if (!response.ok) {
        throw new Error('Không gửi được đánh giá');
      }

      setReviewRating(5);
      setReviewComment('');
      await fetchReviews();
      addNotification('Cảm ơn bạn đã gửi đánh giá!', 'success');
    } catch (error) {
      console.error('Failed to submit review:', error);
      addNotification('Gửi đánh giá thất bại, vui lòng thử lại.', 'error');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-page">Đang tải sản phẩm...</div>;
  }

  if (!product) {
    return <div className="error-page">Sản phẩm không tồn tại</div>;
  }

  const images = product.images && product.images.length > 0
    ? product.images.map(img => img.url)
    : [product.mainImageUrl || '/placeholder.jpg'];

  const variants = product.productVariants || [];
  const selectedVariant = variants.find((variant) =>
    variant.size === selectedSize && (!selectedColor || variant.color === selectedColor)
  ) || variants.find((variant) => variant.size === selectedSize) || variants[0];
  const displayPrice = selectedVariant?.price ?? product.price ?? 0;
  const displayStock = selectedVariant?.stock ?? product.stock ?? variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
  const displayColor = selectedColor || selectedVariant?.color || product.color || '';
  const sizeOptions = Array.from(new Set(variants.map((variant) => variant.size).filter(Boolean)))
    .map((sizeValue) => ({ sizeValue }));
  const colorOptions = Array.from(new Set(
    variants
      .filter((variant) => !selectedSize || variant.size === selectedSize)
      .map((variant) => variant.color)
      .filter(Boolean)
  ));


  return (
    <div className="product-detail-page">
      <div className="breadcrumb">
        <button onClick={() => navigate('/products')}>Sản Phẩm</button>
        <span> / </span>
        <span>{product.name}</span>
      </div>

      <div className="product-detail-container">
        {/* Image Gallery */}
        <div className="product-gallery">
          <div className="main-image-container">
            <div className="main-image">
              <img
                src={images[activeImageIndex]}
                alt={product.name}
              />
              {product.isFeatured && <span className="badge-featured">Nổi Bật</span>}
            </div>
            {images.length > 1 && (
              <>
                <button
                  className="arrow-button prev-arrow"
                  onClick={() => setActiveImageIndex((activeImageIndex - 1 + images.length) % images.length)}
                  title="Ảnh trước"
                >
                  ‹
                </button>
                <button
                  className="arrow-button next-arrow"
                  onClick={() => setActiveImageIndex((activeImageIndex + 1) % images.length)}
                  title="Ảnh tiếp theo"
                >
                  ›
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="thumbnail-list">
              {images.map((img, index) => (
                <button
                  key={index}
                  className={`thumbnail ${index === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(index)}
                >
                  <img src={img} alt={`${product.name} - ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="product-details">
          <div className="product-header">
            <h1>{product.name}</h1>
            <button
              className={`btn-wishlist ${inWishlist ? 'active' : ''}`}
              onClick={handleWishlistToggle}
              title={inWishlist ? 'Xóa khỏi danh sách yêu thích' : 'Thêm vào danh sách yêu thích'}
            >
              ❤️
            </button>
          </div>

          <div className="product-meta">
            <span className="brand">Thương hiệu: {product.brand}</span>
            <span className="sku">Mã: {product.sku}</span>
            <span className="category">
              {product.category ? product.category.name : 'Không xác định'}
            </span>
          </div>

          <div className="product-rating">
            <span className="stars">⭐ {Number(product.rating ?? 0).toFixed(1)}</span>
            <span className="reviews">({product.reviewCount ?? 0} đánh giá)</span>
          </div>

          <div className="product-price">
            <span className="price">{displayPrice.toLocaleString('vi-VN')} VNĐ</span>
            <span className={`stock ${displayStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {displayStock > 0 ? `Còn ${displayStock} sản phẩm` : 'Hết hàng'}
            </span>
          </div>

          <div className="product-description">
            <h3>Mô Tả</h3>
            <p>{product.description}</p>
          </div>

          <div className="product-details-info">
            <div className="detail-item">
              <span className="label">Chất Liệu:</span>
              <span className="value">{product.material}</span>
            </div>
            <div className="detail-item">
              <span className="label">Màu Sắc:</span>
              <span className="value">{displayColor || 'Không xác định'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Hướng Dẫn Chăm Sóc:</span>
              <span className="value">{product.careInstructions}</span>
            </div>
          </div>

          {/* Options */}
          <div className="product-options">
            {sizeOptions.length > 0 && (
              <div className="option-group">
                <label>Kích Thước</label>
                <div className="size-options">
                  {sizeOptions.map((size) => (
                    <button
                      key={size.sizeValue}
                      className={`size-button ${selectedSize === size.sizeValue ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedSize(size.sizeValue);
                        const firstColorForSize = variants.find((variant) => variant.size === size.sizeValue)?.color;
                        if (firstColorForSize) {
                          setSelectedColor(firstColorForSize);
                        }
                      }}
                    >
                      {size.sizeValue}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colorOptions.length > 0 && (
              <div className="option-group">
                <label>Màu Sắc</label>
                <div className="color-options">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      className={`color-button ${selectedColor === color ? 'active' : ''}`}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="option-group">
              <label>Số Lượng</label>
              <div className="quantity-selector">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <input type="number" value={quantity} readOnly />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={quantity >= displayStock}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="product-actions">
            <button
              onClick={handleAddToCart}
              className="btn-add-to-cart-large"
              disabled={!selectedVariant || displayStock <= 0}
            >
              {selectedVariant && displayStock > 0 ? 'Thêm vào giỏ hàng' : 'Hết hàng'}
            </button>
            <button
              onClick={() => navigate('/products')}
              className="btn-continue-shopping"
            >
              Tiếp tục mua sắm
            </button>
          </div>

          <div className="reviews-section">
            <div className="reviews-header">
              <div>
                <h2>Đánh giá & Nhận xét</h2>
                <p>{reviews.length} đánh giá cho sản phẩm này</p>
              </div>
            </div>

            {reviewLoading ? (
              <p className="reviews-loading">Đang tải đánh giá...</p>
            ) : (
              <div className="reviews-list">
                {reviews.length === 0 ? (
                  <div className="reviews-empty">Chưa có đánh giá nào cho sản phẩm này.</div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="review-card">
                      <div className="review-card-header">
                        <span className="review-username">{review.username}</span>
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
                      <p className="review-comment">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {token ? (
              <form className="review-form" onSubmit={handleSubmitReview}>
                <h3>Viết đánh giá của bạn</h3>
                <div className="review-form-row">
                  <label htmlFor="reviewRating">Đánh giá</label>
                  <select
                    id="reviewRating"
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((star) => (
                      <option key={star} value={star}>
                        {star} sao
                      </option>
                    ))}
                  </select>
                </div>

                <div className="review-form-row">
                  <label htmlFor="reviewComment">Bình luận</label>
                  <textarea
                    id="reviewComment"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={5}
                    className="review-textarea"
                    placeholder="Viết cảm nhận của bạn về sản phẩm..."
                  />
                </div>

                <button
                  className="review-submit"
                  type="submit"
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </form>
            ) : (
              <div className="review-placeholder">
                🔒 Vui lòng Đăng nhập để viết bình luận đánh giá sản phẩm này.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
