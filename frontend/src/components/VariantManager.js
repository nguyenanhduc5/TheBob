import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { formatPrice } from './ProductTable';

const createClientId = () => `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeId = (value) => String(value ?? '');

const getLookupName = (map, id) => map.get(String(id))?.name || '-';

const slugPart = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

const makeVariantKey = (colorId, sizeId) => `${normalizeId(colorId)}:${normalizeId(sizeId)}`;

const makeDefaultSku = (colorMap, sizeMap, colorId, sizeId) => {
  const colorName = slugPart(getLookupName(colorMap, colorId));
  const sizeName = slugPart(getLookupName(sizeMap, sizeId));
  return `THEBOB-${colorName}-${sizeName}`;
};

const buildMatrix = ({ colorIds, sizeIds, variants, colorMap, sizeMap, defaultPrice }) => {
  const selectedKeys = new Set(colorIds.flatMap((colorId) => sizeIds.map((sizeId) => makeVariantKey(colorId, sizeId))));
  const existingMap = new Map();
  const result = [];

  variants.forEach((variant) => {
    const key = makeVariantKey(variant.colorId, variant.sizeId);
    if (existingMap.has(key) || !selectedKeys.has(key)) return;

    const nextVariant = {
      ...variant,
      sku: variant.sku || makeDefaultSku(colorMap, sizeMap, variant.colorId, variant.sizeId),
      price: Number(defaultPrice) || 0, // Luôn đồng bộ giá theo giá sản phẩm chính
      isAvailable: selectedKeys.has(key),
    };

    existingMap.set(key, nextVariant);
    result.push(nextVariant);
  });

  colorIds.forEach((colorId) => {
    sizeIds.forEach((sizeId) => {
      const key = makeVariantKey(colorId, sizeId);
      if (existingMap.has(key)) return;

      const nextVariant = {
        clientId: createClientId(),
        id: null,
        colorId,
        sizeId,
        sku: makeDefaultSku(colorMap, sizeMap, colorId, sizeId),
        price: Number(defaultPrice) || 0, // Giá biến thể lấy từ giá sản phẩm chính
        stock: 0,
        isAvailable: true,
        images: [],
      };

      existingMap.set(key, nextVariant);
      result.push(nextVariant);
    });
  });

  return result;
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

function OptionToggleGroup({ title, items, selectedIds, onToggle, onAdd }) {
  return (
    <div className="pm-option-group">
      <div className="pm-option-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <button type="button" className="pm-mini-button" onClick={onAdd} style={{ padding: '4px 8px', fontSize: '12px' }}>+ Thêm mới</button>
      </div>
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

function LookupModal({ isOpen, title, fields, onSave, onClose }) {
  const [data, setData] = useState({});
  
  useEffect(() => { if (isOpen) setData({}); }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="pm-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="pm-modal-content" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {fields.map(field => (
          <div key={field.name} style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>{field.label}</label>
            <input 
              type={field.type || 'text'} 
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              value={data[field.name] || field.defaultValue || ''}
              onChange={e => setData({...data, [field.name]: e.target.value})}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ddd', background: 'none' }}>Hủy</button>
          <button type="button" onClick={() => onSave(data)} style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#000', color: '#fff' }}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

function VariantManager({ variants, colors, sizes, colorMap, sizeMap, errors, productPrice, onChange, onAddColor, onAddSize }) {
  const safeVariants = useMemo(() => (Array.isArray(variants) ? variants : []), [variants]);
  const [imageTab, setImageTab] = useState('list'); // 'list' or 'images'
  const [modal, setModal] = useState({ type: null, open: false });

  // Sử dụng state riêng thay vì tính toán từ safeVariants để tránh lỗi mất tích chọn khi ma trận trống
  const [selectedColorIds, setSelectedColorIds] = useState([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState([]);
  const isInitialized = React.useRef(false);

  // Khởi tạo danh sách ID đã chọn khi load dữ liệu sản phẩm (chế độ sửa)
  useEffect(() => {
    if (!isInitialized.current && safeVariants.length > 0) {
      const cIds = [...new Set(safeVariants.map(v => normalizeId(v.colorId)).filter(Boolean))];
      const sIds = [...new Set(safeVariants.map(v => normalizeId(v.sizeId)).filter(Boolean))];
      setSelectedColorIds(cIds);
      setSelectedSizeIds(sIds);
      isInitialized.current = true;
    }
  }, [safeVariants]);

  const updateMatrix = useCallback(
    (nextColorIds, nextSizeIds) => {
      onChange(
        buildMatrix({
          colorIds: nextColorIds,
          sizeIds: nextSizeIds,
          variants: safeVariants,
          colorMap,
          sizeMap,
          defaultPrice: productPrice,
        })
      );
    },
    [colorMap, onChange, safeVariants, sizeMap, productPrice]
  );

  const toggleColor = useCallback(
    (colorId) => {
      const nextColorIds = selectedColorIds.includes(colorId)
        ? selectedColorIds.filter((id) => id !== colorId)
        : [...selectedColorIds, colorId];

      setSelectedColorIds(nextColorIds);
      updateMatrix(nextColorIds, selectedSizeIds);
    },
    [selectedColorIds, selectedSizeIds, updateMatrix]
  );

  const toggleSize = useCallback(
    (sizeId) => {
      const nextSizeIds = selectedSizeIds.includes(sizeId)
        ? selectedSizeIds.filter((id) => id !== sizeId)
        : [...selectedSizeIds, sizeId];

      setSelectedSizeIds(nextSizeIds);
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

  const stats = useMemo(() => ({
    colorCount: selectedColorIds.length,
    sizeCount: selectedSizeIds.length,
    variantCount: safeVariants.length,
    totalStock: safeVariants.reduce((sum, v) => sum + toNumber(v.stock), 0),
  }), [safeVariants, selectedColorIds, selectedSizeIds]);

  // Group variants by color for image management
  const colorGroups = useMemo(() => {
    const groups = {};
    selectedColorIds.forEach(colorId => {
      const colorVariants = safeVariants.filter(v => normalizeId(v.colorId) === colorId);
      groups[colorId] = {
        name: getLookupName(colorMap, colorId),
        images: colorVariants[0]?.images || [],
        variants: colorVariants
      };
    });
    return groups;
  }, [selectedColorIds, safeVariants, colorMap]);

  const updateColorImages = (colorId, images) => {
    const nextVariants = safeVariants.map(variant => 
      normalizeId(variant.colorId) === colorId ? { ...variant, images } : variant
    );
    onChange(nextVariants);
  };

  const handleSaveColor = async (data) => {
    if (!data.name) return;
    const newColor = await onAddColor({ name: data.name, hexCode: data.hexCode || '#000000' });
    if (newColor && newColor.id) {
      toggleColor(normalizeId(newColor.id));
    }
    setModal({ type: null, open: false });
  };

  const handleSaveSize = async (data) => {
    if (!data.name) return;
    const newSize = await onAddSize({ name: data.name });
    if (newSize && newSize.id) {
      toggleSize(normalizeId(newSize.id));
    }
    setModal({ type: null, open: false });
  };

  return (
    <section className="pm-form-section">
      <div className="pm-section-heading">
        <div>
          <h3 style={{ marginBottom: '8px' }}>Ma trận biến thể</h3>
          <div className="pm-stats-banner" style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#666' }}>
            <span>Màu: <strong>{stats.colorCount}</strong></span>
            <span>Size: <strong>{stats.sizeCount}</strong></span>
            <span>Biến thể: <strong>{stats.variantCount}</strong></span>
            <span>Tổng kho: <strong>{stats.totalStock}</strong></span>
          </div>
        </div>
        <div className="pm-section-tabs">
          <button type="button" className={imageTab === 'list' ? 'active' : ''} onClick={() => setImageTab('list')}>Chi tiết biến thể</button>
          <button type="button" className={imageTab === 'images' ? 'active' : ''} onClick={() => setImageTab('images')}>Ảnh theo màu</button>
        </div>
      </div>

      {errors?.variants ? <div className="pm-error">{errors.variants}</div> : null}

      <div className="pm-grid-two">
        <OptionToggleGroup title="1. Chọn Màu sắc" items={colors} selectedIds={selectedColorIds} onToggle={toggleColor} onAdd={() => setModal({ type: 'color', open: true })} />
        <OptionToggleGroup title="2. Chọn Kích thước" items={sizes} selectedIds={selectedSizeIds} onToggle={toggleSize} onAdd={() => setModal({ type: 'size', open: true })} />
      </div>

      {imageTab === 'list' ? (
        <div className="pm-variant-list">
          {safeVariants.map((variant, index) => (
            <div className={`pm-variant-row ${variant.isAvailable === false ? 'is-disabled' : ''}`} key={variant.clientId || variant.id || makeVariantKey(variant.colorId, variant.sizeId)}>
              <div className="pm-variant-summary" style={{ fontWeight: '600', marginBottom: '8px' }}>
                {getLookupName(colorMap, variant.colorId)} - {getLookupName(sizeMap, variant.sizeId)}
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
                  <span>Tồn kho</span>
                  <input
                    type="number"
                    min="0"
                    value={variant.stock ?? 0}
                    onChange={(event) => updateVariant(index, { stock: event.target.value })}
                    className={errors?.[`variants.${index}.stock`] ? 'is-invalid' : ''}
                  />
                  {errors?.[`variants.${index}.stock`] && <small style={{color: 'red', display: 'block', marginTop: '4px'}}>{errors[`variants.${index}.stock`]}</small>}
                </label>
                <label className="pm-switch">
                  <input
                    type="checkbox"
                    checked={variant.isAvailable !== false}
                    onChange={(event) => updateVariant(index, { isAvailable: event.target.checked })}
                  />
                  <span>Bật</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pm-color-images">
          {Object.entries(colorGroups).map(([colorId, group]) => (
            <div key={colorId} className="pm-color-image-group">
              <h5 style={{ margin: '20px 0 10px' }}>Album ảnh màu: {group.name}</h5>
              <VariantImageEditor 
                images={group.images} 
                onChange={(imgs) => updateColorImages(colorId, imgs)} 
              />
            </div>
          ))}
        </div>
      )}

      <LookupModal 
        isOpen={modal.open && modal.type === 'color'} 
        title="Thêm màu mới" 
        fields={[
          { name: 'name', label: 'Tên màu (VD: Đen)', type: 'text' },
          { name: 'hexCode', label: 'Mã màu HEX (VD: #000000)', type: 'color', defaultValue: '#000000' }
        ]}
        onSave={handleSaveColor}
        onClose={() => setModal({ type: null, open: false })}
      />

      <LookupModal 
        isOpen={modal.open && modal.type === 'size'} 
        title="Thêm kích thước mới" 
        fields={[
          { name: 'name', label: 'Tên size (VD: XL)', type: 'text' }
        ]}
        onSave={handleSaveSize}
        onClose={() => setModal({ type: null, open: false })}
      />
    </section>
  );
}

export default memo(VariantManager);
