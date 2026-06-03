import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotification } from '../context/NotificationContext';
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

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product) {
      setInWishlist(isInWishlist(product.id));
    }
  }, [product, isInWishlist]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5110/api/products/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0].sizeValue);
        }
        if (data.color) {
          setSelectedColor(data.color);
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
  };

  const handleAddToCart = () => {
    if (!selectedSize) {
      addNotification('Vui lòng chọn kích thước', 'warning');
      return;
    }

    const cartItem = {
      ...product,
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

  if (loading) {
    return <div className="loading-page">Đang tải sản phẩm...</div>;
  }

  if (!product) {
    return <div className="error-page">Sản phẩm không tồn tại</div>;
  }

  const images = product.images && product.images.length > 0
    ? product.images.map(img => img.url)
    : [product.mainImageUrl];

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
          <div className="main-image">
            <img
              src={images[activeImageIndex]}
              alt={product.name}
            />
            {product.isFeatured && <span className="badge-featured">Nổi Bật</span>}
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
            <span className="stars">⭐ {product.rating.toFixed(1)}</span>
            <span className="reviews">({product.reviewCount} đánh giá)</span>
          </div>

          <div className="product-price">
            <span className="price">{product.price.toLocaleString('vi-VN')} VNĐ</span>
            <span className={`stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}
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
              <span className="value">{product.color}</span>
            </div>
            <div className="detail-item">
              <span className="label">Hướng Dẫn Chăm Sóc:</span>
              <span className="value">{product.careInstructions}</span>
            </div>
          </div>

          {/* Options */}
          <div className="product-options">
            {product.sizes && product.sizes.length > 0 && (
              <div className="option-group">
                <label>Kích Thước</label>
                <div className="size-options">
                  {product.sizes.map((size) => (
                    <button
                      key={size.id}
                      className={`size-button ${selectedSize === size.sizeValue ? 'active' : ''}`}
                      onClick={() => setSelectedSize(size.sizeValue)}
                    >
                      {size.sizeValue}
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
                  disabled={quantity >= product.stock}
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
              disabled={product.stock <= 0}
            >
              {product.stock > 0 ? 'Thêm vào giỏ hàng' : 'Hết hàng'}
            </button>
            <button
              onClick={() => navigate('/products')}
              className="btn-continue-shopping"
            >
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
