import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { Icons } from '../../icons';

const createClientId = () => `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const PhotoIcon = Icons.photo;
const PlusIcon = Icons.plus;
const TrashIcon = Icons.trash;
const VariantsIcon = Icons.package;

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

const normalizeImageList = (images) =>
  (Array.isArray(images) ? images : [])
    .map((image, index) => {
      const url = typeof image === 'string' ? image.trim() : String(image?.url || '').trim();
      return {
        ...(typeof image === 'object' && image !== null ? image : {}),
        id: typeof image === 'object' && image !== null ? image.id ?? null : null,
        url,
        sortOrder: Number.isFinite(Number(image?.sortOrder)) ? Number(image.sortOrder) : index,
      };
    })
    .filter((image) => image.url);

export const synchronizeColorImages = (variants, savedImagesByColor = {}) => {
  const imagesByColor = new Map(
    Object.entries(savedImagesByColor).map(([colorId, images]) => [colorId, normalizeImageList(images)])
  );
  const items = Array.isArray(variants) ? variants : [];

  items.forEach((variant) => {
    const colorId = normalizeId(variant.colorId);
    const images = normalizeImageList(variant.images);
    if (!imagesByColor.has(colorId) || imagesByColor.get(colorId).length === 0) {
      imagesByColor.set(colorId, images);
    }
  });

  return items.map((variant) => ({
    ...variant,
    images: normalizeImageList(imagesByColor.get(normalizeId(variant.colorId))),
  }));
};

export const buildColorImageGroups = (variants) => {
  const groups = new Map();

  synchronizeColorImages(variants).forEach((variant) => {
    const colorId = normalizeId(variant.colorId);
    if (!colorId || groups.has(colorId)) return;

    const seenUrls = new Set();
    const images = normalizeImageList(variant.images)
      .filter((image) => {
        if (seenUrls.has(image.url)) return false;
        seenUrls.add(image.url);
        return true;
      })
      .map((image, sortOrder) => ({ ...image, sortOrder }));

    groups.set(colorId, { colorId, images });
  });

  return [...groups.values()];
};

const HEX_REGEX = /^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/;

const buildMatrix = ({ colorIds, sizeIds, variants, colorMap, sizeMap, defaultPrice, savedImagesByColor }) => {
  const selectedKeys = new Set(colorIds.flatMap((colorId) => sizeIds.map((sizeId) => makeVariantKey(colorId, sizeId))));
  const existingMap = new Map();
  const result = [];
  variants.forEach((variant) => {
    const key = makeVariantKey(variant.colorId, variant.sizeId);
    if (existingMap.has(key) || !selectedKeys.has(key)) return;

    const nextVariant = {
      ...variant,
      images: normalizeImageList(variant.images),
      sku: variant.sku || makeDefaultSku(colorMap, sizeMap, variant.colorId, variant.sizeId),
      price: Number(defaultPrice) || 0,
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
        price: Number(defaultPrice) || 0,
        stock: 0,
        isAvailable: true,
        images: [],
      };

      existingMap.set(key, nextVariant);
      result.push(nextVariant);
    });
  });

  return synchronizeColorImages(result, savedImagesByColor);
};

function isValidImageUrl(value) {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const getImageKey = (image, index) => String(image.id ?? `${image.url}-${index}`);

function VariantImageEditor({ colorId, colorName, images, onChange, onValidationChange }) {
  const [draftUrl, setDraftUrl] = useState('');
  const [addError, setAddError] = useState('');
  const [imageDrafts, setImageDrafts] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const normalizedImages = useMemo(() => normalizeImageList(images), [images]);
  const errorId = `color-image-error-${colorId}`;

  useEffect(() => {
    const hasPendingChanges =
      Boolean(addError || draftUrl.trim()) ||
      Object.keys(imageDrafts).length > 0 ||
      Object.keys(imageErrors).length > 0;
    onValidationChange(colorId, hasPendingChanges);
  }, [addError, colorId, draftUrl, imageDrafts, imageErrors, onValidationChange]);

  const updateImage = useCallback(
    (index, url) => {
      onChange(
        normalizedImages.map((image, imageIndex) => ({
          ...image,
          url: imageIndex === index ? url : image.url,
          sortOrder: imageIndex,
        }))
      );
    },
    [normalizedImages, onChange]
  );

  const addImage = useCallback(() => {
    const url = draftUrl.trim();
    if (!url) {
      setAddError('Nhập đường dẫn ảnh trước khi thêm.');
      return;
    }
    if (!isValidImageUrl(url)) {
      setAddError('Đường dẫn cần bắt đầu bằng https://, http:// hoặc /.');
      return;
    }
    if (normalizedImages.some((image) => image.url === url)) {
      setAddError('Ảnh này đã có trong danh sách.');
      return;
    }

    onChange([...normalizedImages, { id: null, url, sortOrder: normalizedImages.length }]);
    setDraftUrl('');
    setAddError('');
  }, [draftUrl, normalizedImages, onChange]);

  const removeImage = useCallback(
    (index) => {
      const imageKey = getImageKey(normalizedImages[index], index);
      onChange(
        normalizedImages
          .filter((_, imageIndex) => imageIndex !== index)
          .map((image, sortOrder) => ({ ...image, sortOrder }))
      );
      setImageDrafts((current) => {
        const next = { ...current };
        delete next[imageKey];
        return next;
      });
      setImageErrors((current) => {
        const next = { ...current };
        delete next[imageKey];
        return next;
      });
    },
    [normalizedImages, onChange]
  );

  const makeFirstImage = useCallback(
    (index) => {
      if (index <= 0) return;
      const reordered = [...normalizedImages];
      const [selectedImage] = reordered.splice(index, 1);
      reordered.unshift(selectedImage);
      onChange(reordered.map((image, sortOrder) => ({ ...image, sortOrder })));
    },
    [normalizedImages, onChange]
  );

  const commitImageUrl = useCallback(
    (index) => {
      const image = normalizedImages[index];
      const imageKey = getImageKey(image, index);
      const url = String(imageDrafts[imageKey] ?? image.url).trim();

      if (!url) {
        setImageErrors((current) => ({
          ...current,
          [imageKey]: 'Đường dẫn không được để trống. Hãy xóa ảnh bằng nút thùng rác.',
        }));
        return;
      }
      if (!isValidImageUrl(url)) {
        setImageErrors((current) => ({
          ...current,
          [imageKey]: 'Đường dẫn cần bắt đầu bằng https://, http:// hoặc /.',
        }));
        return;
      }
      if (normalizedImages.some((item, itemIndex) => itemIndex !== index && item.url === url)) {
        setImageErrors((current) => ({ ...current, [imageKey]: 'Ảnh này đã có trong danh sách.' }));
        return;
      }

      updateImage(index, url);
      setImageDrafts((current) => {
        const next = { ...current };
        delete next[imageKey];
        return next;
      });
      setImageErrors((current) => {
        const next = { ...current };
        delete next[imageKey];
        return next;
      });
    },
    [imageDrafts, normalizedImages, updateImage]
  );

  return (
    <div className="pm-variant-images">
      {normalizedImages.length > 0 ? (
        <div className="pm-color-image-grid">
          {normalizedImages.map((image, index) => (
            <article className="pm-color-image-card" key={`${image.id || image.url}-${index}`}>
              <div className="pm-color-image-preview">
                <img src={image.url} alt={`${colorName} - ảnh ${index + 1}`} loading="lazy" />
                <span className="pm-color-image-number">Ảnh {index + 1}</span>
              </div>
              <div className="pm-color-image-controls">
                <label className="pm-color-image-url">
                  <span>Đường dẫn ảnh</span>
                  <input
                    type="text"
                    value={imageDrafts[getImageKey(image, index)] ?? image.url}
                    onChange={(event) => {
                      const imageKey = getImageKey(image, index);
                      setImageDrafts((current) => ({ ...current, [imageKey]: event.target.value }));
                      setImageErrors((current) => {
                        const next = { ...current };
                        delete next[imageKey];
                        return next;
                      });
                    }}
                    onBlur={() => commitImageUrl(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label={`Đường dẫn ảnh ${index + 1} của màu ${colorName}`}
                    aria-invalid={Boolean(imageErrors[getImageKey(image, index)])}
                    aria-describedby={imageErrors[getImageKey(image, index)] ? `${errorId}-${index}` : undefined}
                  />
                  {imageErrors[getImageKey(image, index)] ? (
                    <small className="pm-color-image-error" id={`${errorId}-${index}`}>
                      {imageErrors[getImageKey(image, index)]}
                    </small>
                  ) : null}
                </label>
                {index > 0 ? (
                  <button
                    className="pm-mini-button"
                    type="button"
                    onClick={() => makeFirstImage(index)}
                    title="Dùng ảnh này làm ảnh đầu của màu"
                  >
                    Đặt ảnh đầu
                  </button>
                ) : null}
                <button
                  className="pm-icon-button pm-danger pm-color-image-remove"
                  type="button"
                  onClick={() => removeImage(index)}
                  title={`Xóa ảnh ${index + 1}`}
                  aria-label={`Xóa ảnh ${index + 1} của màu ${colorName}`}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="pm-color-image-empty">
          <PhotoIcon size={22} />
          <span>Màu này chưa có ảnh.</span>
          <span>Thêm ảnh bên dưới để áp dụng cho mọi kích cỡ của màu.</span>
        </div>
      )}

      <div className="pm-color-image-add">
        <label className="pm-color-image-url">
          <span>Thêm ảnh cho màu {colorName}</span>
          <input
            type="text"
            value={draftUrl}
            onChange={(event) => {
              setDraftUrl(event.target.value);
              setAddError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addImage();
              }
            }}
            placeholder="Dán đường dẫn https://... hoặc /..."
            aria-invalid={Boolean(addError)}
            aria-describedby={addError ? errorId : undefined}
          />
        </label>
        <button className="pm-button pm-button-secondary" type="button" onClick={addImage}>
          <PlusIcon size={17} />
          Thêm ảnh
        </button>
      </div>
      {addError ? (
        <p className="pm-color-image-error" role="alert" id={errorId}>
          {addError}
        </p>
      ) : null}
    </div>
  );
}

function OptionToggleGroup({ title, items, selectedIds, onToggle, onAdd, onEdit, onDelete }) {
  return (
    <div className="pm-option-group">
      <div
        className="pm-option-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}
      >
        <h4 style={{ margin: 0 }}>{title}</h4>
        <button type="button" className="pm-mini-button" onClick={onAdd} style={{ padding: '4px 8px', fontSize: '12px' }}>
          + Thêm mới
        </button>
      </div>
      <div className="pm-option-grid">
        {items.map((item) => {
          const id = normalizeId(item.id);
          const checked = selectedIds.includes(id);

          return (
            <div
              className={`pm-check-option ${checked ? 'is-selected' : ''}`}
              key={id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, cursor: 'pointer', minWidth: 0 }}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(id)} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              </label>
              <span className="pm-option-actions" style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="pm-mini-button"
                  title="Sửa"
                  onClick={() => onEdit(item)}
                  style={{ padding: '3px 7px', fontSize: '12px', lineHeight: 1 }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="pm-mini-button pm-danger"
                  title="Xóa"
                  onClick={() => onDelete(item)}
                  style={{ padding: '3px 7px', fontSize: '12px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LookupModal({ isOpen, title, fields, initialData, onSave, onClose }) {
  const [data, setData] = useState({});

  useEffect(() => {
    if (isOpen) setData(initialData || {});
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <div
      className="pm-modal-overlay"
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div className="pm-modal-content" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {fields.map((field) => (
          <div key={field.name} style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>{field.label}</label>
            {field.type === 'color' ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace' }}
                  placeholder="#000000"
                  value={data[field.name] ?? field.defaultValue ?? '#000000'}
                  onChange={(e) => setData({ ...data, [field.name]: e.target.value })}
                />
                <input
                  type="color"
                  style={{ width: '42px', height: '36px', padding: '0', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                  value={
                    HEX_REGEX.test(data[field.name] || '') && /^#[0-9A-Fa-f]{6}$/.test(data[field.name])
                      ? data[field.name].trim()
                      : field.defaultValue || '#000000'
                  }
                  onChange={(e) => setData({ ...data, [field.name]: e.target.value })}
                />
              </div>
            ) : (
              <input
                type={field.type || 'text'}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                value={data[field.name] ?? field.defaultValue ?? ''}
                onChange={(e) => setData({ ...data, [field.name]: e.target.value })}
              />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ddd', background: 'none' }}>
            Hủy
          </button>
          <button type="button" onClick={() => onSave(data)} style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#000', color: '#fff' }}>
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantManager({
  variants,
  colors,
  sizes,
  colorMap,
  sizeMap,
  errors,
  productPrice,
  onChange,
  onAddColor,
  onAddSize,
  onEditColor,
  onDeleteColor,
  onEditSize,
  onDeleteSize,
  onImageValidationChange,
}) {
  const safeVariants = useMemo(() => (Array.isArray(variants) ? variants : []), [variants]);
  const [colorImagesById, setColorImagesById] = useState(() => {
    const images = {};
    safeVariants.forEach((variant) => {
      const colorId = normalizeId(variant.colorId);
      const variantImages = normalizeImageList(variant.images);
      if (!images[colorId] || images[colorId].length === 0) images[colorId] = variantImages;
    });
    return images;
  });
  const [imageTab, setImageTab] = useState('list');
  // modal: { type: 'color' | 'size' | null, mode: 'add' | 'edit', open, target }
  const [modal, setModal] = useState({ type: null, mode: 'add', open: false, target: null });

  const [selectedColorIds, setSelectedColorIds] = useState([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState([]);
  const isInitialized = React.useRef(false);

  useEffect(() => {
    if (!isInitialized.current && safeVariants.length > 0) {
      const cIds = [...new Set(safeVariants.map((v) => normalizeId(v.colorId)).filter(Boolean))];
      const sIds = [...new Set(safeVariants.map((v) => normalizeId(v.sizeId)).filter(Boolean))];
      setSelectedColorIds(cIds);
      setSelectedSizeIds(sIds);
      isInitialized.current = true;
    }
  }, [safeVariants]);

  useEffect(() => {
    if (errors?.images) setImageTab('images');
  }, [errors?.images]);

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
          savedImagesByColor: colorImagesById,
        })
      );
    },
    [colorMap, colorImagesById, onChange, safeVariants, sizeMap, productPrice]
  );

  const toggleColor = useCallback(
    (colorId) => {
      const isRemovingColor = selectedColorIds.includes(colorId);
      const nextColorIds = isRemovingColor
        ? selectedColorIds.filter((id) => id !== colorId)
        : [...selectedColorIds, colorId];

      if (isRemovingColor) onImageValidationChange(colorId, false);
      setSelectedColorIds(nextColorIds);
      updateMatrix(nextColorIds, selectedSizeIds);
    },
    [onImageValidationChange, selectedColorIds, selectedSizeIds, updateMatrix]
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

  const stats = useMemo(
    () => ({
      colorCount: selectedColorIds.length,
      sizeCount: selectedSizeIds.length,
      variantCount: safeVariants.length,
      totalStock: safeVariants.reduce((sum, v) => sum + toNumber(v.stock), 0),
    }),
    [safeVariants, selectedColorIds, selectedSizeIds]
  );

  const colorGroups = useMemo(() => {
    const groups = {};
    selectedColorIds.forEach((colorId) => {
      const colorVariants = safeVariants.filter((v) => normalizeId(v.colorId) === colorId);
      const firstVariantWithImages = colorVariants.find((variant) => normalizeImageList(variant.images).length > 0);
      groups[colorId] = {
        name: getLookupName(colorMap, colorId),
        hexCode: colorMap.get(String(colorId))?.hexCode || '',
        images: normalizeImageList(colorImagesById[colorId] || firstVariantWithImages?.images),
        variants: colorVariants,
        variantCount: colorVariants.length,
        totalStock: colorVariants.reduce((sum, variant) => sum + toNumber(variant.stock), 0),
      };
    });
    return groups;
  }, [selectedColorIds, safeVariants, colorMap, colorImagesById]);

  const updateColorImages = (colorId, images) => {
    const normalizedImages = normalizeImageList(images);
    setColorImagesById((current) => ({
      ...current,
      [colorId]: normalizedImages.map((image) => ({ ...image })),
    }));
    const nextVariants = safeVariants.map((variant) =>
      normalizeId(variant.colorId) === colorId
        ? { ...variant, images: normalizedImages.map((image) => ({ ...image })) }
        : variant
    );
    onChange(nextVariants);
  };

  const closeModal = () => setModal({ type: null, mode: 'add', open: false, target: null });

  // ── Thêm / Sửa màu ────────────────────────────────────────────────────────
  const handleSaveColor = async (data) => {
    if (!data.name || !data.name.trim()) {
      alert('Vui lòng nhập tên màu.');
      return;
    }
    const hex = (data.hexCode || '#000000').trim();
    if (!HEX_REGEX.test(hex)) {
      alert('Mã màu HEX không hợp lệ! Vui lòng nhập đúng định dạng (VD: #000000 hoặc #FFF).');
      return;
    }

    if (modal.mode === 'edit' && modal.target) {
      const updated = await onEditColor(modal.target.id, { name: data.name.trim(), hexCode: hex });
      if (!updated) return; // Lỗi đã được thông báo qua addNotification ở ProductForm
    } else {
      const newColor = await onAddColor({ name: data.name.trim(), hexCode: hex });
      if (newColor && newColor.id) toggleColor(normalizeId(newColor.id));
    }
    closeModal();
  };

  const handleEditColorClick = (item) => {
    setModal({ type: 'color', mode: 'edit', open: true, target: item });
  };

  const handleDeleteColorClick = async (item) => {
    const id = normalizeId(item.id);
    const usedCount = safeVariants.filter((v) => normalizeId(v.colorId) === id).length;
    const confirmMsg =
      usedCount > 0
        ? `Màu "${item.name}" đang được dùng trong ${usedCount} biến thể của sản phẩm này. Xóa màu sẽ xóa luôn các biến thể đó khỏi sản phẩm. Bạn có chắc chắn muốn xóa?`
        : `Bạn có chắc muốn xóa màu "${item.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    const success = await onDeleteColor(item.id);
    if (!success) return;

    const nextColorIds = selectedColorIds.filter((cid) => cid !== id);
    onImageValidationChange(id, false);
    setSelectedColorIds(nextColorIds);
    updateMatrix(nextColorIds, selectedSizeIds);
  };

  // ── Thêm / Sửa size ───────────────────────────────────────────────────────
  const handleSaveSize = async (data) => {
    if (!data.name || !data.name.trim()) {
      alert('Vui lòng nhập tên kích cỡ.');
      return;
    }

    if (modal.mode === 'edit' && modal.target) {
      const updated = await onEditSize(modal.target.id, { name: data.name.trim() });
      if (!updated) return;
    } else {
      const newSize = await onAddSize({ name: data.name.trim() });
      if (newSize && newSize.id) toggleSize(normalizeId(newSize.id));
    }
    closeModal();
  };

  const handleEditSizeClick = (item) => {
    setModal({ type: 'size', mode: 'edit', open: true, target: item });
  };

  const handleDeleteSizeClick = async (item) => {
    const id = normalizeId(item.id);
    const usedCount = safeVariants.filter((v) => normalizeId(v.sizeId) === id).length;
    const confirmMsg =
      usedCount > 0
        ? `Kích cỡ "${item.name}" đang được dùng trong ${usedCount} biến thể của sản phẩm này. Xóa kích cỡ sẽ xóa luôn các biến thể đó khỏi sản phẩm. Bạn có chắc chắn muốn xóa không?`
        : `Bạn có chắc chắn muốn xóa kích cỡ "${item.name}" không?`;

    if (!window.confirm(confirmMsg)) return;

    const success = await onDeleteSize(item.id);
    if (!success) return;

    const nextSizeIds = selectedSizeIds.filter((sid) => sid !== id);
    setSelectedSizeIds(nextSizeIds);
    updateMatrix(selectedColorIds, nextSizeIds);
  };

  return (
    <section className="pm-form-section">
      <div className="pm-section-heading">
        <div>
          <h3 style={{ marginBottom: '8px' }}>Ma trận biến thể</h3>
          <div className="pm-stats-banner" style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#666' }}>
            <span>
              Màu: <strong>{stats.colorCount}</strong>
            </span>
            <span>
              Kích cỡ: <strong>{stats.sizeCount}</strong>
            </span>
            <span>
              Biến thể: <strong>{stats.variantCount}</strong>
            </span>
            <span>
              Tổng kho: <strong>{stats.totalStock}</strong>
            </span>
          </div>
        </div>
        <div className="pm-section-tabs" role="tablist" aria-label="Quản lý biến thể sản phẩm">
          <button
            type="button"
            role="tab"
            aria-selected={imageTab === 'list'}
            className={imageTab === 'list' ? 'active' : ''}
            onClick={() => setImageTab('list')}
          >
            <VariantsIcon size={16} />
            Chi tiết biến thể
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={imageTab === 'images'}
            className={imageTab === 'images' ? 'active' : ''}
            onClick={() => setImageTab('images')}
          >
            <PhotoIcon size={16} />
            Ảnh theo màu
            <span className="pm-tab-count">{selectedColorIds.length}</span>
          </button>
        </div>
      </div>

      {errors?.variants ? <div className="pm-error">{errors.variants}</div> : null}
      {errors?.images ? <div className="pm-error">{errors.images}</div> : null}

      <div className="pm-grid-two">
        <OptionToggleGroup
          title="1. Chọn màu sắc"
          items={colors}
          selectedIds={selectedColorIds}
          onToggle={toggleColor}
          onAdd={() => setModal({ type: 'color', mode: 'add', open: true, target: null })}
          onEdit={handleEditColorClick}
          onDelete={handleDeleteColorClick}
        />
        <OptionToggleGroup
          title="2. Chọn kích cỡ"
          items={sizes}
          selectedIds={selectedSizeIds}
          onToggle={toggleSize}
          onAdd={() => setModal({ type: 'size', mode: 'add', open: true, target: null })}
          onEdit={handleEditSizeClick}
          onDelete={handleDeleteSizeClick}
        />
      </div>

      {imageTab === 'list' ? (
        <div className="pm-variant-list">
          {safeVariants.map((variant, index) => (
            <div
              className={`pm-variant-row ${variant.isAvailable === false ? 'is-disabled' : ''}`}
              key={variant.clientId || variant.id || makeVariantKey(variant.colorId, variant.sizeId)}
            >
              <div className="pm-variant-summary" style={{ fontWeight: '600', marginBottom: '8px' }}>
                {getLookupName(colorMap, variant.colorId)} - {getLookupName(sizeMap, variant.sizeId)}
              </div>

              <div className="pm-variant-grid">
                <label className="pm-field">
                  <span>Mã SKU</span>
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
                  {errors?.[`variants.${index}.stock`] && (
                    <small style={{ color: 'red', display: 'block', marginTop: '4px' }}>{errors[`variants.${index}.stock`]}</small>
                  )}
                </label>
                <label className="pm-switch">
                  <input
                    type="checkbox"
                    checked={variant.isAvailable !== false}
                    onChange={(event) => updateVariant(index, { isAvailable: event.target.checked })}
                  />
                  <span>Đang áp dụng</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        selectedColorIds.length === 0 ? (
          <div className="pm-color-image-empty pm-color-image-empty--selection">
            <PhotoIcon size={25} />
            <strong>Chưa có màu sắc được chọn</strong>
            <span>Quay lại phần chọn màu sắc để thêm màu, sau đó quản lý ảnh riêng cho từng màu tại đây.</span>
          </div>
        ) : (
          <div className="pm-color-images">
            {Object.entries(colorGroups).map(([colorId, group]) => (
              <article className="pm-color-image-group" key={colorId}>
                <header className="pm-color-image-header">
                  <div className="pm-color-image-identity">
                    <span
                      className="pm-color-swatch"
                      style={{
                        backgroundColor: HEX_REGEX.test(group.hexCode) ? group.hexCode : '#efede8',
                      }}
                      aria-label={`Màu ${group.name}`}
                    />
                    <div>
                      <h4>{group.name}</h4>
                      <p>
                        {group.variantCount} biến thể · Ảnh dùng chung cho mọi kích cỡ · Tồn kho: {group.totalStock}
                      </p>
                    </div>
                  </div>
                  <span className="pm-color-image-count">
                    <PhotoIcon size={15} />
                    {group.images.length} ảnh
                  </span>
                </header>
                <VariantImageEditor
                  colorId={colorId}
                  colorName={group.name}
                  images={group.images}
                  onChange={(imgs) => updateColorImages(colorId, imgs)}
                  onValidationChange={onImageValidationChange}
                />
              </article>
            ))}
          </div>
        )
      )}

      <LookupModal
        isOpen={modal.open && modal.type === 'color'}
        title={modal.mode === 'edit' ? 'Sửa màu' : 'Thêm màu mới'}
        fields={[
          { name: 'name', label: 'Tên màu (VD: Đen)', type: 'text' },
          { name: 'hexCode', label: 'Mã màu HEX (VD: #000000)', type: 'color', defaultValue: '#000000' },
        ]}
        initialData={
          modal.mode === 'edit' && modal.target
            ? { name: modal.target.name, hexCode: modal.target.hexCode || '#000000' }
            : {}
        }
        onSave={handleSaveColor}
        onClose={closeModal}
      />

      <LookupModal
        isOpen={modal.open && modal.type === 'size'}
        title={modal.mode === 'edit' ? 'Sửa kích thước' : 'Thêm kích thước mới'}
        fields={[{ name: 'name', label: 'Tên kích cỡ (ví dụ: XL)', type: 'text' }]}
        initialData={modal.mode === 'edit' && modal.target ? { name: modal.target.name } : {}}
        onSave={handleSaveSize}
        onClose={closeModal}
      />
    </section>
  );
}

export default memo(VariantManager);
