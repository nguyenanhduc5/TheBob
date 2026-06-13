import React, { memo, useCallback, useMemo } from 'react';
import { formatPrice } from './ProductTable';

const createClientId = () => `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyVariant = () => ({
  clientId: createClientId(),
  id: null,
  colorId: '',
  sizeId: '',
  sku: '',
  price: '',
  stock: 0,
  isAvailable: true,
  images: [],
});

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getLookupName = (map, id) => map.get(String(id))?.name || '-';

function VariantImageEditor({ images, onChange }) {
  const normalizedImages = useMemo(() => (Array.isArray(images) ? images : []), [images]);

  const updateImage = useCallback(
    (index, url) => {
      onChange(normalizedImages.map((image, imageIndex) => (imageIndex === index ? { ...image, url } : image)));
    },
    [normalizedImages, onChange]
  );

  const addImage = useCallback(() => {
    onChange([...normalizedImages, { id: null, url: '', sortOrder: normalizedImages.length }]);
  }, [normalizedImages, onChange]);

  const removeImage = useCallback(
    (index) => {
      onChange(normalizedImages.filter((_, imageIndex) => imageIndex !== index));
    },
    [normalizedImages, onChange]
  );

  return (
    <div className="pm-variant-images">
      {normalizedImages.map((image, index) => (
        <div className="pm-variant-image-row" key={`${image.id || 'new'}-${index}`}>
          <input
            type="url"
            value={image.url || ''}
            onChange={(event) => updateImage(index, event.target.value)}
            placeholder="URL ảnh riêng của biến thể"
          />
          {image.url ? <img src={image.url} alt={`Ảnh biến thể ${index + 1}`} loading="lazy" /> : null}
          <button className="pm-mini-button pm-danger" type="button" onClick={() => removeImage(index)}>
            Xóa
          </button>
        </div>
      ))}
      <button className="pm-mini-button" type="button" onClick={addImage}>
        Thêm ảnh biến thể
      </button>
    </div>
  );
}

function VariantManager({ variants, colors, sizes, colorMap, sizeMap, errors, onChange }) {
  const safeVariants = useMemo(() => (Array.isArray(variants) ? variants : []), [variants]);

  const addVariant = useCallback(() => {
    onChange([...safeVariants, emptyVariant()]);
  }, [onChange, safeVariants]);

  const updateVariant = useCallback(
    (index, patch) => {
      onChange(safeVariants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)));
    },
    [onChange, safeVariants]
  );

  const removeVariant = useCallback(
    (index) => {
      onChange(safeVariants.filter((_, variantIndex) => variantIndex !== index));
    },
    [onChange, safeVariants]
  );

  const totalStock = useMemo(
    () => safeVariants.reduce((sum, variant) => sum + toNumber(variant.stock), 0),
    [safeVariants]
  );

  return (
    <section className="pm-form-section">
      <div className="pm-section-heading">
        <div>
          <h3>Biến thể</h3>
          <p>Tổng tồn kho: {totalStock}</p>
        </div>
        <button className="pm-button pm-button-secondary" type="button" onClick={addVariant}>
          Thêm biến thể
        </button>
      </div>

      {errors?.variants ? <div className="pm-error">{errors.variants}</div> : null}

      <div className="pm-variant-list">
        {safeVariants.map((variant, index) => (
          <div className="pm-variant-row" key={variant.clientId || variant.id || index}>
            <div className="pm-variant-grid">
              <label className="pm-field">
                <span>Màu</span>
                <select
                  value={variant.colorId ?? ''}
                  onChange={(event) => updateVariant(index, { colorId: event.target.value })}
                  className={errors?.[`variants.${index}.colorId`] ? 'is-invalid' : ''}
                >
                  <option value="">Chọn màu</option>
                  {colors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pm-field">
                <span>Size</span>
                <select
                  value={variant.sizeId ?? ''}
                  onChange={(event) => updateVariant(index, { sizeId: event.target.value })}
                  className={errors?.[`variants.${index}.sizeId`] ? 'is-invalid' : ''}
                >
                  <option value="">Chọn size</option>
                  {sizes.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pm-field">
                <span>SKU</span>
                <input
                  value={variant.sku || ''}
                  onChange={(event) => updateVariant(index, { sku: event.target.value })}
                  className={errors?.[`variants.${index}.sku`] ? 'is-invalid' : ''}
                  placeholder="VD: TBOB-TEE-BLK-M"
                />
              </label>
              <label className="pm-field">
                <span>Giá</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={variant.price ?? ''}
                  onChange={(event) => updateVariant(index, { price: event.target.value })}
                  className={errors?.[`variants.${index}.price`] ? 'is-invalid' : ''}
                />
              </label>
              <label className="pm-field">
                <span>Tồn kho</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={variant.stock ?? 0}
                  onChange={(event) => updateVariant(index, { stock: event.target.value })}
                  className={errors?.[`variants.${index}.stock`] ? 'is-invalid' : ''}
                />
              </label>
              <label className="pm-switch">
                <input
                  type="checkbox"
                  checked={variant.isAvailable !== false}
                  onChange={(event) => updateVariant(index, { isAvailable: event.target.checked })}
                />
                <span>Đang bán</span>
              </label>
            </div>

            <div className="pm-variant-summary">
              <span>{getLookupName(colorMap, variant.colorId)}</span>
              <span>{getLookupName(sizeMap, variant.sizeId)}</span>
              <strong>{formatPrice(variant.price || 0)}</strong>
              <button className="pm-mini-button pm-danger" type="button" onClick={() => removeVariant(index)}>
                Xóa biến thể
              </button>
            </div>

            <VariantImageEditor
              images={variant.images}
              onChange={(images) => updateVariant(index, { images })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default memo(VariantManager);
