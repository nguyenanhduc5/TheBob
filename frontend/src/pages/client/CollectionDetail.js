import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collectionsAPI } from '../../api/app';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/Collection.css';
import '../../styles/Products.css';

const getVariants = (product) => product?.variants || product?.productVariants || [];

export default function CollectionDetail() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const { t } = usePreferences();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    collectionsAPI.getOne(collectionId)
      .then((payload) => {
        if (mounted) setCollection(payload?.data ?? payload);
      })
      .catch((requestError) => {
        console.error('Failed to load collection:', requestError);
        if (mounted) setError(requestError.message || t('collection.notFound'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [collectionId, t]);

  const handleProductClick = (product) => {
    navigate(`/product/${product.slug || product.id}`);
  };

  if (loading) return <div className="collection-loading">{t('collection.loading')}</div>;

  if (!collection || error) {
    return (
      <div className="collections-page">
        <Link to="/collections" className="back-to-collections">{t('collection.back')}</Link>
        <div className="collection-empty">
          <h3>{error || t('collection.notFound')}</h3>
          <p>{t('collection.invalid')}</p>
        </div>
      </div>
    );
  }

  const products = Array.isArray(collection.products) ? collection.products : [];

  return (
    <div className="collection-detail-page">
      <Link to="/collections" className="back-to-collections">{t('collection.all')}</Link>

      <section
        className="collection-hero"
        style={{ backgroundImage: `url(${collection.imageUrl || '/placeholder.jpg'})` }}
      >
        <div className="collection-hero-content">
          <span className="collection-hero-tag">{collection.subtitle || 'THEBOB COLLECTION'}</span>
          <h1 className="collection-hero-title">{collection.name}</h1>
          <p className="collection-hero-desc">{collection.description}</p>
        </div>
      </section>

      {products.length === 0 ? (
        <div className="collection-empty">
          <h3>{t('collection.comingSoon')}</h3>
          <p>{t('collection.noProducts')}</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => {
            const colors = new Map();
            getVariants(product).forEach((variant) => {
              const colorId = variant.colorId ?? variant.ColorId;
              const name = variant.color ?? variant.Color;
              const hexCode = variant.hexCode ?? variant.HexCode;
              if (colorId && hexCode && !colors.has(String(colorId))) {
                colors.set(String(colorId), { id: colorId, name, hexCode });
              }
            });
            const productColors = [...colors.values()];
            const stock = Number(product.totalStock ?? product.stock ?? 0);
            const price = Number(product.price ?? product.minPrice ?? 0);

            return (
              <article key={product.id} className="product-card">
                <button type="button" className="product-image-container collection-product-image" onClick={() => handleProductClick(product)}>
                  <img src={product.mainImageUrl || '/placeholder.jpg'} alt={product.name} className="product-image" />
                  {product.isFeatured && <span className="badge-featured">{t('product.featured')}</span>}
                  {stock === 0 && <span className="badge-sold-out">{t('product.soldOut')}</span>}
                </button>
                <div className="product-info">
                  <button type="button" className="product-name collection-product-name" onClick={() => handleProductClick(product)}>{product.name}</button>
                  <div className="product-card-colors collection-product-colors">
                    {productColors.slice(0, 4).map((color) => (
                      <span key={color.id} title={color.name} style={{ backgroundColor: color.hexCode }} />
                    ))}
                    {productColors.length > 4 && <small>+{productColors.length - 4}</small>}
                  </div>
                  <div className="product-price">{price.toLocaleString('vi-VN')} VNĐ</div>
                  <button type="button" onClick={() => handleProductClick(product)} className="btn-add-to-cart">
                    {t('product.details')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
