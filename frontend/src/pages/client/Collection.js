import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionsAPI } from '../../api/app';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/Collection.css';

export default function CollectionList() {
  const { t } = usePreferences();
  const [collections, setCollections] = useState([]);
  const [layoutMode, setLayoutMode] = useState('staggered');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      collectionsAPI.getAll(),
      collectionsAPI.getLayout().catch(() => ({ layoutMode: 'staggered' })),
    ])
      .then(([items, layout]) => {
        if (mounted) {
          setCollections(items);
          setLayoutMode(layout?.layoutMode === 'two-column' ? 'two-column' : 'staggered');
        }
      })
      .catch((requestError) => {
        console.error('Failed to load collections:', requestError);
        if (mounted) setError(requestError.message || 'Không thể tải bộ sưu tập.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="collections-page collections-list-page">
      <div className="collections-header">
        <div>
          <span className="collections-tag">{t('collection.list.tag')}</span>
          <h1>{t('collection.list.title').split('\n').map((line) => <span key={line}>{line}<br /></span>)}</h1>
        </div>
        <p>{t('collection.list.description')}</p>
      </div>

      {loading ? (
        <div className="collection-loading">{t('collection.loading')}</div>
      ) : error ? (
        <div className="collection-empty"><h3>{error}</h3></div>
      ) : collections.length === 0 ? (
        <div className="collection-empty">
          <h3>{t('collection.comingSoon')}</h3>
          <p>{t('collection.noProducts')}</p>
        </div>
      ) : (
        <div className={`collections-grid-custom collections-grid-custom--${layoutMode}`}>
          {collections.map((collection, index) => {
            const layoutPosition = (index % 4) + 1;
            const groupStartRow = Math.floor(index / 4) * 4 + 1;
            const rowOffset = [0, 0, 1, 2][layoutPosition - 1];
            const rowSpan = layoutPosition === 2 ? 1 : 2;

            return (
            <Link
              to={`/collections/${collection.slug || collection.id}`}
              key={collection.id}
              className={`collection-card-custom collection-card-custom--${layoutPosition}${index >= 4
                ? ' collection-card-custom--continued'
                : ''}`}
              style={{
                '--collection-grid-row': `${groupStartRow + rowOffset} / span ${rowSpan}`,
              }}
            >
              <div className="collection-card-heading">
                <span className="collection-card-subtitle">{collection.subtitle || 'THEBOB COLLECTION'}</span>
                <h2 className="collection-card-title">{collection.name}</h2>
                <p className="collection-card-desc">{collection.description}</p>
              </div>
              <div className="collection-card-image-wrapper">
                <img
                  src={collection.imageUrl || '/placeholder.jpg'}
                  alt={collection.name}
                  className="collection-card-image"
                  loading="lazy"
                />
              </div>
              <span className="collection-card-badge">{collection.productCount || 0} sản phẩm</span>
              <span className="collection-card-arrow" aria-hidden="true">↗</span>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
