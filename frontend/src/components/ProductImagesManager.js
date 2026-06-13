import React, { memo, useCallback, useMemo, useState } from 'react';

const normalizeUrl = (value) => (typeof value === 'string' ? value.trim() : '');

function ProductImagesManager({ mainImageUrl, images, onMainImageChange, onImagesChange, title = 'Album ảnh sản phẩm' }) {
  const [draftUrl, setDraftUrl] = useState('');

  const normalizedImages = useMemo(
    () =>
      (Array.isArray(images) ? images : [])
        .map((image, index) => ({
          id: image?.id ?? null,
          url: normalizeUrl(image?.url ?? image),
          sortOrder: Number.isFinite(Number(image?.sortOrder)) ? Number(image.sortOrder) : index,
        }))
        .filter((image) => image.url),
    [images]
  );

  const addImage = useCallback(() => {
    const url = normalizeUrl(draftUrl);
    if (!url) return;

    onImagesChange([...normalizedImages, { id: null, url, sortOrder: normalizedImages.length }]);
    setDraftUrl('');
  }, [draftUrl, normalizedImages, onImagesChange]);

  const removeImage = useCallback(
    (index) => {
      onImagesChange(normalizedImages.filter((_, imageIndex) => imageIndex !== index));
    },
    [normalizedImages, onImagesChange]
  );

  const makeMainImage = useCallback(
    (url) => {
      onMainImageChange(url);
    },
    [onMainImageChange]
  );

  return (
    <section className="pm-form-section">
      <div className="pm-section-heading">
        <h3>{title}</h3>
      </div>

      <div className="pm-grid-two">
        <label className="pm-field">
          <span>Ảnh đại diện</span>
          <input
            type="url"
            value={mainImageUrl || ''}
            onChange={(event) => onMainImageChange(event.target.value)}
            placeholder="https://example.com/main.jpg"
          />
        </label>
        <div className="pm-image-preview pm-main-preview">
          {mainImageUrl ? <img src={mainImageUrl} alt="Ảnh đại diện" loading="lazy" /> : <span>Chưa có ảnh đại diện</span>}
        </div>
      </div>

      <div className="pm-inline-add">
        <input
          type="url"
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addImage();
            }
          }}
          placeholder="Thêm URL ảnh album"
        />
        <button className="pm-button pm-button-secondary" type="button" onClick={addImage}>
          Thêm ảnh
        </button>
      </div>

      <div className="pm-image-grid">
        {normalizedImages.map((image, index) => (
          <div className="pm-image-card" key={`${image.url}-${index}`}>
            <img src={image.url} alt={`Ảnh sản phẩm ${index + 1}`} loading="lazy" />
            <div className="pm-image-actions">
              <button className="pm-mini-button" type="button" onClick={() => makeMainImage(image.url)}>
                Đặt đại diện
              </button>
              <button className="pm-mini-button pm-danger" type="button" onClick={() => removeImage(index)}>
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default memo(ProductImagesManager);
