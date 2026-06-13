import React, { memo, useCallback, useMemo } from 'react';
import { formatPrice } from './ProductTable';

const createClientId = () => `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeId = (value) => String(value ?? '');

const getLookupName = (map, id) => map.get(String(id))?.name || '-';

const makeVariantKey = (colorId, sizeId) => `${normalizeId(colorId)}:${normalizeId(sizeId)}`;

const makeDefaultSku = (colorMap, sizeMap, colorId, sizeId) => {
  const colorName = getLookupName(colorMap, colorId).replace(/\s+/g, '').toUpperCase();
  const sizeName = getLookupName(sizeMap, sizeId).replace(/\s+/g, '').toUpperCase();
  return `THEBOB-${colorName}-${sizeName}`;
};

const buildMatrix = ({ colorIds, sizeIds, variants, colorMap, sizeMap }) => {
  const existingMap = new Map(
    variants.map((variant) => [makeVariantKey(variant.colorId, variant.sizeId), variant])
  );

  return colorIds.flatMap((colorId) =>
    sizeIds.map((sizeId) => {
      const existing = existingMap.get(makeVariantKey(colorId, sizeId));
      if (existing) return existing;

      return {
        clientId: createClientId(),
        id: null,
        colorId,
        sizeId,
        sku: makeDefaultSku(colorMap, sizeMap, colorId, sizeId),
        stock: 0,
        isAvailable: true,
        images: [],
      };
    })
  );
};

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
            placeholder="URL anh rieng cua bien the"
          />
          {image.url ? <img src={image.url} alt={`Anh bien the ${index + 1}`} loading="lazy" /> : null}
          <button className="pm-mini-button pm-danger" type="button" onClick={() => removeImage(index)}>
            Xoa
          </button>
        </div>
      ))}
      <button className="pm-mini-button" type="button" onClick={addImage}>
        Them anh bien the
      </button>
    </div>
  );
}

function OptionToggleGroup({ title, items, selectedIds, onToggle }) {
  return (
    <div className="pm-option-group">
      <h4>{title}</h4>
      <div className="pm-option-grid">
        {items.map((item) => {
          const id = normalizeId(item.id);
          const checked = selectedIds.includes(id);

          return (
            <label className={`pm-check-option ${checked ? 'is-selected' : ''}`} key={id}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(id)} />
              <span>{item.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function VariantManager({ variants, colors, sizes, colorMap, sizeMap, errors, productPrice, onChange }) {
  const safeVariants = useMemo(() => (Array.isArray(variants) ? variants : []), [variants]);

  const selectedColorIds = useMemo(
    () => [...new Set(safeVariants.map((variant) => normalizeId(variant.colorId)).filter(Boolean))],
    [safeVariants]
  );

  const selectedSizeIds = useMemo(
    () => [...new Set(safeVariants.map((variant) => normalizeId(variant.sizeId)).filter(Boolean))],
    [safeVariants]
  );

  const totalStock = useMemo(
    () => safeVariants.reduce((sum, variant) => sum + toNumber(variant.stock), 0),
    [safeVariants]
  );

  const updateMatrix = useCallback(
    (nextColorIds, nextSizeIds) => {
      onChange(
        buildMatrix({
          colorIds: nextColorIds,
          sizeIds: nextSizeIds,
          variants: safeVariants,
          colorMap,
          sizeMap,
        })
      );
    },
    [colorMap, onChange, safeVariants, sizeMap]
  );

  const toggleColor = useCallback(
    (colorId) => {
      const nextColorIds = selectedColorIds.includes(colorId)
        ? selectedColorIds.filter((id) => id !== colorId)
        : [...selectedColorIds, colorId];

      updateMatrix(nextColorIds, selectedSizeIds);
    },
    [selectedColorIds, selectedSizeIds, updateMatrix]
  );

  const toggleSize = useCallback(
    (sizeId) => {
      const nextSizeIds = selectedSizeIds.includes(sizeId)
        ? selectedSizeIds.filter((id) => id !== sizeId)
        : [...selectedSizeIds, sizeId];

      updateMatrix(selectedColorIds, nextSizeIds);
    },
    [selectedColorIds, selectedSizeIds, updateMatrix]
  );

  const updateVariant = useCallback(
    (index, patch) => {
      onChange(safeVariants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)));
    },
    [onChange, safeVariants]
  );

  return (
    <section className="pm-form-section">
      <div className="pm-section-heading">
        <div>
          <h3>Bien the tu dong</h3>
          <p>
            Gia chung: {formatPrice(productPrice || 0)} - Tong ton kho: {totalStock} - {safeVariants.length} bien the
          </p>
        </div>
      </div>

      {errors?.variants ? <div className="pm-error">{errors.variants}</div> : null}

      <div className="pm-grid-two">
        <OptionToggleGroup title="Mau sac" items={colors} selectedIds={selectedColorIds} onToggle={toggleColor} />
        <OptionToggleGroup title="Kich thuoc" items={sizes} selectedIds={selectedSizeIds} onToggle={toggleSize} />
      </div>

      <div className="pm-variant-list">
        {safeVariants.map((variant, index) => (
          <div className="pm-variant-row" key={variant.clientId || variant.id || makeVariantKey(variant.colorId, variant.sizeId)}>
            <div className="pm-variant-summary">
              <span>{getLookupName(colorMap, variant.colorId)}</span>
              <span>{getLookupName(sizeMap, variant.sizeId)}</span>
              <strong>{formatPrice(productPrice || 0)}</strong>
            </div>

            <div className="pm-variant-grid">
              <label className="pm-field">
                <span>SKU</span>
                <input
                  value={variant.sku || ''}
                  onChange={(event) => updateVariant(index, { sku: event.target.value })}
                  className={errors?.[`variants.${index}.sku`] ? 'is-invalid' : ''}
                />
              </label>
              <label className="pm-field">
                <span>Ton kho</span>
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
                <span>Dang ban</span>
              </label>
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
