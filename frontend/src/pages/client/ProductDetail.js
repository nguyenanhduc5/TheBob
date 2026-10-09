import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { recommendationAPI } from '../../api/app';
import { useCart } from '../../context/CartContext';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { buildProductGalleryImages } from '../../utils/productGallery';
import '../../styles/ProductDetail.css';
import '../../styles/Products.css';

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
  const { slug, id } = useParams();
  const identifier = slug || id;
  const navigate = useNavigate();
  const { addToCart, cartItems } = useCart();
  const { addNotification } = useNotification();
  // FIX: Giữ addNotification stable để tránh re-render vô hạn
  const addNotificationRef = useRef(addNotification);
  useEffect(() => { addNotificationRef.current = addNotification; }, [addNotification]);
  const { token } = useAuth();
  const { t } = usePreferences();

  const [product, setProduct] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImageIndexRef = useRef(0);
  const selectedColorIdRef = useRef('');
  const galleryImagesRef = useRef(null);
  const mainImageRef = useRef(null);
  const galleryScrollLockRef = useRef(false);
  const galleryScrollTimerRef = useRef(null);
  const galleryWheelDeltaRef = useRef(0);
  const galleryTouchStartYRef = useRef(null);
  const galleryTouchStartIndexRef = useRef(0);
  const [thumbnailFrameWidth, setThumbnailFrameWidth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState([]);
  const [fbt, setFbt] = useState([]);

  const productIdForTracking = product?.id || identifier;

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
      if (productIdForTracking) {
        recommendationAPI.trackView(productIdForTracking, sessionId, durationSeconds)
          .catch(err => console.error('Failed to track view:', err));
      }
    };
  }, [productIdForTracking]);

  // Fetch recommendations
  useEffect(() => {
    async function fetchRecommendations() {
      if (!productIdForTracking) return;
      try {
        const relatedData = await recommendationAPI.getRelated(productIdForTracking, 4);
        setRelated(relatedData || []);

        const fbtData = await recommendationAPI.getFrequentlyBought(String(productIdForTracking), 4);
        setFbt(fbtData || []);
      } catch (err) {
        console.error("Failed to fetch product recommendations:", err);
      }
    }
    fetchRecommendations();
  }, [productIdForTracking]);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/products/${identifier}`);
      if (!response.ok) {
        addNotificationRef.current(t('product.notFound'), 'error');
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
      addNotificationRef.current(t('product.fetchError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [identifier, navigate, t]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const variants = useMemo(() => getVariants(product), [product]);

  const colorImagesById = useMemo(() => {
    const groups = Array.isArray(product?.colorImages)
      ? product.colorImages
      : Array.isArray(product?.ColorImages)
        ? product.ColorImages
        : [];

    return new Map(
      groups.map((group) => [
        normalizeId(group.colorId ?? group.ColorId),
        getImageUrls(group.images ?? group.Images ?? group.imageUrls ?? group.ImageUrls),
      ])
    );
  }, [product]);

  const colorOptions = useMemo(() => {
    return uniqueById(
      variants.map((variant) => {
        const hasStock = selectedSizeId
          ? variants.some(item => normalizeId(item.colorId) === normalizeId(variant.colorId) && normalizeId(item.sizeId) === normalizeId(selectedSizeId) && item.stock > 0 && item.isAvailable)
          : variants.some(item => normalizeId(item.colorId) === normalizeId(variant.colorId) && item.stock > 0 && item.isAvailable);
          
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
          ? variants.some(item => normalizeId(item.sizeId) === normalizeId(variant.sizeId) && normalizeId(item.colorId) === normalizeId(selectedColorId) && item.stock > 0 && item.isAvailable)
          : variants.some(item => normalizeId(item.sizeId) === normalizeId(variant.sizeId) && item.stock > 0 && item.isAvailable);

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

  const galleryImages = useMemo(
    () => buildProductGalleryImages(product, variants, colorOptions, colorImagesById),
    [colorImagesById, colorOptions, product, variants]
  );

  const productImages = useMemo(
    () => galleryImages.map((image) => image.url),
    [galleryImages]
  );

  const selectColorForImage = useCallback((index) => {
    const colorId = galleryImages[index]?.colorId;
    if (!colorId || normalizeId(selectedColorIdRef.current) === normalizeId(colorId)) return;
    selectedColorIdRef.current = colorId;
    setSelectedColorId(colorId);
    setQuantity(1);
  }, [galleryImages]);

  useEffect(() => {
    selectedColorIdRef.current = selectedColorId;
  }, [selectedColorId]);

  useEffect(() => {
    if (activeImageIndexRef.current < productImages.length) return;
    activeImageIndexRef.current = 0;
    setActiveImageIndex(0);
    selectColorForImage(0);
  }, [productImages.length, selectColorForImage]);

  const scheduleGalleryUnlock = useCallback((delay = 520) => {
    window.clearTimeout(galleryScrollTimerRef.current);
    galleryScrollTimerRef.current = window.setTimeout(() => {
      galleryScrollLockRef.current = false;
    }, delay);
  }, []);

  const scrollToImage = useCallback((index) => {
    galleryScrollLockRef.current = true;
    galleryWheelDeltaRef.current = 0;
    scheduleGalleryUnlock();
    activeImageIndexRef.current = index;
    setActiveImageIndex(index);
    selectColorForImage(index);
  }, [scheduleGalleryUnlock, selectColorForImage]);

  const moveToAdjacentImage = useCallback((direction) => {
    const nextIndex = activeImageIndex + direction;
    if (nextIndex < 0 || nextIndex >= productImages.length) return false;
    if (galleryScrollLockRef.current) return true;

    scrollToImage(nextIndex);
    return true;
  }, [activeImageIndex, productImages.length, scrollToImage]);

  const handleGalleryWheel = useCallback((event) => {
    if (event.ctrlKey || event.deltaY === 0) return;
    if (galleryScrollLockRef.current) {
      event.preventDefault();
      scheduleGalleryUnlock(420);
      return;
    }

    const direction = event.deltaY > 0 ? 1 : -1;
    const nextIndex = activeImageIndex + direction;
    if (nextIndex < 0 || nextIndex >= productImages.length) {
      galleryWheelDeltaRef.current = 0;
      return;
    }

    event.preventDefault();
    galleryWheelDeltaRef.current += event.deltaY;
    if (Math.abs(galleryWheelDeltaRef.current) < 24) return;

    const accumulatedDirection = galleryWheelDeltaRef.current > 0 ? 1 : -1;
    galleryWheelDeltaRef.current = 0;
    moveToAdjacentImage(accumulatedDirection);
  }, [activeImageIndex, moveToAdjacentImage, productImages.length, scheduleGalleryUnlock]);

  useEffect(() => {
    const gallery = galleryImagesRef.current;
    if (!gallery) return undefined;

    gallery.addEventListener('wheel', handleGalleryWheel, { passive: false });
    return () => gallery.removeEventListener('wheel', handleGalleryWheel);
  }, [handleGalleryWheel]);

  const handleGalleryTouchStart = useCallback((event) => {
    galleryTouchStartYRef.current = event.touches[0]?.clientY ?? null;
    galleryTouchStartIndexRef.current = activeImageIndexRef.current;
  }, []);

  const handleGalleryTouchEnd = useCallback((event) => {
    const startY = galleryTouchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY;
    galleryTouchStartYRef.current = null;
    if (startY === null || endY === undefined) return;

    const distance = startY - endY;
    if (Math.abs(distance) < 50) return;
    const targetIndex = galleryTouchStartIndexRef.current + (distance > 0 ? 1 : -1);
    if (targetIndex >= 0 && targetIndex < productImages.length) scrollToImage(targetIndex);
  }, [productImages.length, scrollToImage]);

  const syncThumbnailFrameWidth = useCallback(() => {
    const image = mainImageRef.current;
    const container = image?.closest('.main-image-container');
    if (!image || !container || !image.naturalWidth || !image.naturalHeight) return;

    const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
    if (!containerWidth || !containerHeight) return;

    const scale = Math.min(
      containerWidth / image.naturalWidth,
      containerHeight / image.naturalHeight
    );
    const displayedWidth = Math.min(containerWidth, image.naturalWidth * scale);
    setThumbnailFrameWidth((currentWidth) => (
      currentWidth !== null && Math.abs(currentWidth - displayedWidth) < 0.5
        ? currentWidth
        : displayedWidth
    ));
  }, []);

  useEffect(() => {
    const container = galleryImagesRef.current?.querySelector('.main-image-container');
    if (!container) return undefined;

    syncThumbnailFrameWidth();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(syncThumbnailFrameWidth);
    resizeObserver?.observe(container);
    window.addEventListener('resize', syncThumbnailFrameWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncThumbnailFrameWidth);
    };
  }, [activeImageIndex, syncThumbnailFrameWidth]);

  useEffect(() => () => {
    window.clearTimeout(galleryScrollTimerRef.current);
  }, []);

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
    () => variants.reduce((sum, variant) => sum + (variant.isAvailable ? variant.stock : 0), 0),
    [variants]
  );

  const selectedColorName = colorOptions.find((color) => normalizeId(color.id) === normalizeId(selectedColorId))?.name || '';
  const selectedSizeName = sizeOptions.find((size) => normalizeId(size.id) === normalizeId(selectedSizeId))?.name || '';
  const displayStock = selectedVariant
    ? (selectedVariant.isAvailable ? selectedVariant.stock : 0)
    : totalStock;

  const handleColorSelect = (colorId) => {
    if (normalizeId(selectedColorId) !== normalizeId(colorId)) {
      setSelectedColorId(colorId);
      setQuantity(1);
    }
    const imageIndex = galleryImages.findIndex(
      (image) => normalizeId(image.colorId) === normalizeId(colorId)
    );
    if (imageIndex >= 0) scrollToImage(imageIndex);
  };

  const handleAddToCart = () => {
    if (!token) {
      addNotification(t('product.add.login'), 'warning');
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (!selectedColorId) {
      addNotification(t('product.chooseColor'), 'warning');
      return;
    }

    if (!selectedSizeId) {
      addNotification(t('product.chooseSize'), 'warning');
      return;
    }

    if (!selectedVariant) {
      addNotification(t('product.variant.unavailable'), 'warning');
      return;
    }

    if (selectedVariant.stock <= 0) {
      addNotification(t('product.variant.soldOut'), 'warning');
      return;
    }

    if (!selectedVariant.isAvailable) {
      addNotification(t('product.variant.unavailable'), 'warning');
      return;
    }

  const alreadyInCart = cartItems.find(
  i => i.variantId === selectedVariant.id
)?.quantity ?? 0;
const totalQty = alreadyInCart + quantity;
if (totalQty > selectedVariant.stock) {
  addNotification(t('product.stock.remaining', { count: selectedVariant.stock }), 'warning');
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
      mainImageUrl: galleryImages.find(
        (image) => normalizeId(image.colorId) === normalizeId(selectedColorId)
      )?.url || productImages[0],
      price: productPrice,
      stock: selectedVariant.stock,
      selectedSize: selectedSizeName,
      selectedColor: selectedColorName,
    },
    quantity
  );
  // ✅ Chỉ hiện success khi KHÔNG có lỗi
  addNotification(t('product.add.success', { name: product.name }), 'success');
}
 catch (error) {
  // ✅ Bắt lỗi → hiện toast thay vì crash
  addNotification(
    error?.message || t('product.add.error'),
    'warning'
  );
}
  };



  if (loading && !product) return <div className="loading-page">{t('product.loading')}</div>;
  if (!product) return <div className="error-page">{t('product.notFound')}</div>;

  return (
    <div className={`product-detail-page ${loading ? 'grid-loading' : ''}`}>
      <div className="product-detail-container">
        <div className="product-gallery">
          <div
            className="product-gallery-images"
            ref={galleryImagesRef}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          >
            <div
              className="main-image-container active"
              data-image-index={activeImageIndex}
              data-color-id={galleryImages[activeImageIndex]?.colorId || undefined}
            >
                <div className="main-image">
                  <img
                    key={`${productImages[activeImageIndex]}-${activeImageIndex}`}
                    ref={mainImageRef}
                    src={productImages[activeImageIndex]}
                    alt={`${toText(product.name)} - ảnh ${activeImageIndex + 1}`}
                    onLoad={syncThumbnailFrameWidth}
                  />
                  {activeImageIndex === 0 && product.isFeatured && <span className="badge-featured">{t('product.featured')}</span>}
                </div>
                {productImages.length > 1 && (
                  <>
                    <button
                      className="arrow-button prev-arrow"
                      onClick={(event) => {
                        event.stopPropagation();
                        scrollToImage((activeImageIndex - 1 + productImages.length) % productImages.length);
                      }}
                      title={t('product.previousImage')}
                      aria-label={t('product.viewPreviousImage')}
                    >
                      ‹
                    </button>
                    <button
                      className="arrow-button next-arrow"
                      onClick={(event) => {
                        event.stopPropagation();
                        scrollToImage((activeImageIndex + 1) % productImages.length);
                      }}
                      title={t('product.nextImage')}
                      aria-label={t('product.viewNextImage')}
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
          </div>
          {productImages.length > 1 && (
            <div
              className="thumbnail-list"
              style={thumbnailFrameWidth ? { width: `${thumbnailFrameWidth}px`, maxWidth: '100%' } : undefined}
            >
              {productImages.map((img, index) => (
                <button
                  type="button"
                  key={`${img}-${index}`}
                  className={`thumbnail ${index === activeImageIndex ? 'active' : ''}`}
                  onClick={() => scrollToImage(index)}
                  aria-label={t('product.viewImage', { number: index + 1 })}
                  aria-current={index === activeImageIndex ? 'true' : undefined}
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
            <span className="brand">{t('product.brand')} {toText(product.brandName ?? product.brand, t('product.unknown'))}</span>
            <span className="sku">{t('product.sku')} {selectedVariant?.sku || toText(product.sku, '-')}</span>
            <span className="category">{toText(product.categoryName ?? product.category, t('product.unknown'))}</span>
          </div>



          {/* KHU VỰC GIÁ TIỀN & TỔNG KHO - TÁCH KHỐI ĐỂ TỰ ĐỘNG XUỐNG DÒNG */}
          <div className="product-price-block">
            <div className="price-display">
              {productPrice.toLocaleString('vi-VN')} VND
            </div>
          <div className={`stock-badge ${displayStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
  {selectedVariant
    ? (displayStock > 0 ? t('product.stock.available', { count: displayStock }) : t('product.stock.soldOut'))
    : totalStock === 0
      ? t('product.stock.allSoldOut')
      : t('product.stock.total', { count: totalStock })}
</div>
          </div>

          <div className="product-description">
            <h3>{t('product.description')}</h3>
            <p>{toText(product.description)}</p>
          </div>

          <div className="product-details-info">
            <div className="detail-item">
              <span className="label">{t('product.material')}</span>
              <span className="value">{toText(product.material, t('product.unknown'))}</span>
            </div>
            <div className="detail-item">
              <span className="label">{t('product.color')}</span>
              <span className="value">{selectedColorName || t('product.unselected')}</span>
            </div>
            <div className="detail-item">
              <span className="label">{t('product.care')}</span>
              <span className="value">{toText(product.careInstructions, t('product.unknown'))}</span>
            </div>
          </div>

          <div className="product-options">
            {colorOptions.length > 0 && (
              <div className="option-group">
                <label>{t('product.color')}</label>
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
                <label>{t('product.size')}</label>
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
              <label>{t('product.quantity')}</label>
              <div className="quantity-selector">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                  −
                </button>
                <input type="number" value={quantity} readOnly />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={!selectedVariant || !selectedVariant.isAvailable || quantity >= selectedVariant.stock}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="product-actions">
            <button
              onClick={handleAddToCart}
              className="btn-add-to-cart-large"
              disabled={selectedVariant && (selectedVariant.stock <= 0 || !selectedVariant.isAvailable)}
            >
              {selectedVariant && (selectedVariant.stock <= 0 || !selectedVariant.isAvailable)
                ? t('product.stock.soldOut')
                : t('product.addToCart')}
            </button>
            <button onClick={() => navigate('/products')} className="btn-continue-shopping">
              {t('product.continueShopping')}
            </button>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together */}
      {fbt.length > 0 && (
        <section className="rec-section">
          <div className="rec-section-header">
            <span className="rec-section-label">Bundle</span>
            <h2 className="rec-section-title">{t('product.related.frequentlyBought')}</h2>
          </div>
          <div className="rec-grid">
            {fbt.map((item) => (
              <div key={item.id} className="rec-card" onClick={() => navigate(`/product/${item.slug || item.id}`)}>
                <div className="rec-card-img">
                  <img src={item.mainImageUrl || '/placeholder.jpg'} alt={item.name} />
                </div>
                <div className="rec-card-info">
                  <h3 className="rec-card-name">{item.name}</h3>
                  <div className="rec-card-price">{item.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button className="rec-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/product/${item.slug || item.id}`); }}>{t('product.viewDetails')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Products */}
      {related.length > 0 && (
        <section className="rec-section rec-section--alt">
          <div className="rec-section-header">
            <span className="rec-section-label">You May Also Like</span>
            <h2 className="rec-section-title">{t('product.related.title')}</h2>
          </div>
          <div className="rec-grid">
            {related.map((item) => (
              <div key={item.id} className="rec-card" onClick={() => navigate(`/product/${item.slug || item.id}`)}>
                <div className="rec-card-img">
                  <img src={item.mainImageUrl || '/placeholder.jpg'} alt={item.name} />
                </div>
                <div className="rec-card-info">
                  <h3 className="rec-card-name">{item.name}</h3>
                  <div className="rec-card-price">{item.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button className="rec-card-btn" onClick={(e) => { e.stopPropagation(); navigate(`/product/${item.slug || item.id}`); }}>{t('product.viewDetails')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
