import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI, blogAPI } from '../../api/app';
import '../../styles/Products.css';

export default function BlogProductCard({ productId, blogPostId, source = 'Direct' }) {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let isMounted = true;
    setLoading(true);

    productsAPI.getProduct(productId)
      .then((res) => {
        const data = res?.data || res;
        if (isMounted) {
          setProduct(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const handleClick = () => {
    if (!product) return;
    // Fire-and-forget click tracking
    if (blogPostId) {
      blogAPI.trackClick(blogPostId, source, productId).catch(() => {});
    }
    navigate(`/products/${product.id || productId}`);
  };

  if (loading) {
    return (
      <div className="blog-product-card blog-product-card--loading">
        <span>Đang tải thông tin sản phẩm...</span>
      </div>
    );
  }

  if (error || !product) {
    return null; // Skip invalid or deleted product
  }

  // Calculate price and stock dynamically from real-time API response
  const variants = product.productVariants || [];
  const minPrice = variants.length > 0 ? Math.min(...variants.map(v => v.price)) : (product.price || 0);
  const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const isOutOfStock = totalStock <= 0;

  return (
    <div className="blog-product-card" onClick={handleClick}>
      <div className="blog-product-card__image-wrap">
        <img
          src={product.mainImageUrl || '/placeholder.jpg'}
          alt={product.name}
          className="blog-product-card__image"
        />
        {isOutOfStock && <span className="blog-product-card__badge-out">Hết hàng</span>}
      </div>
      <div className="blog-product-card__info">
        <h4 className="blog-product-card__title">{product.name}</h4>
        <div className="blog-product-card__price-row">
          <span className="blog-product-card__price">
            {minPrice.toLocaleString('vi-VN')} VNĐ
          </span>
          <span className="blog-product-card__stock">
            {isOutOfStock ? 'Hết hàng' : `Còn ${totalStock} sp`}
          </span>
        </div>
        <button className="blog-product-card__btn" type="button">
          Xem chi tiết →
        </button>
      </div>
    </div>
  );
}
