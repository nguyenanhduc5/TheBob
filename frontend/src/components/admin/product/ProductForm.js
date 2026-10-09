import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import ProductImagesManager from './ProductImagesManager';
import VariantManager, { buildColorImageGroups, synchronizeColorImages } from './VariantManager';
import { productsAPI } from '../../../api/app';
import { useNotification } from '../../../context/NotificationContext';
import { usePreferences } from '../../../context/PreferencesContext';

const createClientId = () => `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultVariant = () => ({
  clientId: createClientId(),
  id: null,
  colorId: '',
  sizeId: '',
  sku: '',
  stock: 0,
  isAvailable: true,
  images: [],
});

const defaultProduct = {
  name: '',
  description: '',
  brandId: '',
  categoryId: '',
  mainImageUrl: '',
  material: '',
  careInstructions: '',
  price: '',
  isFeatured: false,
  isAvailable: true,
  images: [],
  variants: [],
};

const toIntOrNull = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const isValidLookup = (item) => {
  const name = typeof item?.name === 'string' ? item.name.trim() : '';
  return Boolean(item?.id && name && name.toUpperCase() !== 'UNKNOWN');
};

const cleanImages = (images = []) =>
  (Array.isArray(images) ? images : [])
    .map((image, index) => ({
      url: typeof image?.url === 'string' ? image.url.trim() : '',
      sortOrder: index,
    }))
    .filter((image) => image.url);

const normalizeFormProduct = (product) => {
  if (!product) return defaultProduct;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstVariantPrice = variants.find((variant) => toNumber(variant.price) > 0)?.price;

  return {
    ...defaultProduct,
    ...product,
    price: product.price ?? product.minPrice ?? firstVariantPrice ?? '',
    brandId: product.brandId ?? '',
    categoryId: product.categoryId ?? '',
    images: Array.isArray(product.images) ? product.images : [],
    variants: variants.map((variant) => ({
      ...defaultVariant(),
      clientId: variant.clientId || (variant.id ? `variant-${variant.id}` : createClientId()),
      id: variant.id ?? null,
      colorId: variant.colorId ?? '',
      sizeId: variant.sizeId ?? '',
      sku: variant.sku || '',
      stock: variant.stock ?? 0,
      isAvailable: variant.isAvailable !== false,
      images: Array.isArray(variant.images) ? variant.images : [],
    })),
  };
};

function ProductForm({ initialProduct, isEditing, isSaving, lookups, lookupMaps, onCancel, onSubmit, fetchLookups }) {
  const [formData, setFormData] = useState(() => normalizeFormProduct(initialProduct));
  const [errors, setErrors] = useState({});
  const pendingColorImageChanges = useRef(new Set());
  const { addNotification } = useNotification();
  const { t } = usePreferences();

  const brands = useMemo(() => (Array.isArray(lookups?.brands) ? lookups.brands : []), [lookups]);
  const categories = useMemo(() => (Array.isArray(lookups?.categories) ? lookups.categories : []), [lookups]);
  const colors = useMemo(() => (Array.isArray(lookups?.colors) ? lookups.colors.filter(isValidLookup) : []), [lookups]);
  const sizes = useMemo(() => (Array.isArray(lookups?.sizes) ? lookups.sizes.filter(isValidLookup) : []), [lookups]);

  const updateField = useCallback((field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const handleImageValidationChange = useCallback((colorId, hasPendingChanges) => {
    if (hasPendingChanges) pendingColorImageChanges.current.add(colorId);
    else {
      pendingColorImageChanges.current.delete(colorId);
      if (pendingColorImageChanges.current.size === 0) {
        setErrors((current) => ({ ...current, images: undefined }));
      }
    }
  }, []);

  const handleAddColor = useCallback(async (payload) => {
    try {
      if (typeof productsAPI.createColor !== 'function') {
        throw new Error('Tính năng thêm màu chưa được cấu hình trong hệ thống.');
      }
      const newColor = await productsAPI.createColor(payload);
      if (newColor) {
        if (fetchLookups) await fetchLookups();
        addNotification(`Đã thêm màu "${payload?.name || ''}" thành công.`, 'success');
        return newColor;
      }
    } catch (e) {
      addNotification(e.message, "error");
    }
  }, [fetchLookups, addNotification]);

  const handleAddSize = useCallback(async (payload) => {
    try {
      if (typeof productsAPI.createSize !== 'function') {
        throw new Error('Tính năng thêm kích cỡ chưa được cấu hình trong hệ thống.');
      }
      const newSize = await productsAPI.createSize(payload);
      if (newSize) {
        if (fetchLookups) await fetchLookups();
        addNotification(`Đã thêm kích cỡ "${payload?.name || ''}" thành công.`, 'success');
        return newSize;
      }
    } catch (e) {
      addNotification(e.message, "error");
    }
  }, [fetchLookups, addNotification]);
  const handleEditColor = useCallback(async (colorId, payload) => {
  try {
    if (typeof productsAPI.updateColor !== 'function') {
      throw new Error('Tính năng cập nhật màu chưa được cấu hình trong hệ thống.');
    }
    const updated = await productsAPI.updateColor(colorId, payload);
    if (fetchLookups) await fetchLookups();
    addNotification(`Đã cập nhật màu "${payload?.name || ''}" thành công.`, 'success');
    return updated;
  } catch (e) {
    addNotification(e.message, "error");
    return null;
  }
}, [fetchLookups, addNotification]);

const handleDeleteColor = useCallback(async (colorId) => {
  try {
    if (typeof productsAPI.deleteColor !== 'function') {
      throw new Error('Tính năng xóa màu chưa được cấu hình trong hệ thống.');
    }
    await productsAPI.deleteColor(colorId);
    if (fetchLookups) await fetchLookups();
    addNotification('Đã xóa màu thành công.', 'success');
    return true;
  } catch (e) {
    addNotification(e.message || 'Không thể xóa màu này.', "error");
    return false;
  }
}, [fetchLookups, addNotification]);

const handleEditSize = useCallback(async (sizeId, payload) => {
  try {
    if (typeof productsAPI.updateSize !== 'function') {
      throw new Error('Tính năng cập nhật kích cỡ chưa được cấu hình trong hệ thống.');
    }
    const updated = await productsAPI.updateSize(sizeId, payload);
    if (fetchLookups) await fetchLookups();
    addNotification(`Đã cập nhật kích cỡ "${payload?.name || ''}" thành công.`, 'success');
    return updated;
  } catch (e) {
    addNotification(e.message, "error");
    return null;
  }
}, [fetchLookups, addNotification]);

const handleDeleteSize = useCallback(async (sizeId) => {
  try {
    if (typeof productsAPI.deleteSize !== 'function') {
      throw new Error('Tính năng xóa kích cỡ chưa được cấu hình trong hệ thống.');
    }
    await productsAPI.deleteSize(sizeId);
    if (fetchLookups) await fetchLookups();
    addNotification('Đã xóa kích cỡ thành công.', 'success');
    return true;
  } catch (e) {
    addNotification(e.message || 'Không thể xóa size này.', "error");
    return false;
  }
}, [fetchLookups, addNotification]);

  const validate = useCallback(() => {
    const nextErrors = {};

    if (!formData.name.trim()) nextErrors.name = 'Vui lòng nhập tên sản phẩm.';
    if (!formData.description.trim()) nextErrors.description = 'Vui lòng nhập mô tả sản phẩm.';
    if (!toIntOrNull(formData.brandId)) nextErrors.brandId = 'Vui lòng chọn thương hiệu.';
    if (!toIntOrNull(formData.categoryId)) nextErrors.categoryId = 'Vui lòng chọn danh mục.';

    if (toNumber(formData.price) <= 0) nextErrors.price = 'Giá sản phẩm phải lớn hơn 0.';
    if (pendingColorImageChanges.current.size > 0) {
      nextErrors.images = 'Hãy thêm hoặc xác nhận các thay đổi ảnh theo màu trước khi lưu sản phẩm.';
    }

    if (!Array.isArray(formData.variants) || formData.variants.length === 0) {
      nextErrors.variants = 'Hãy chọn ít nhất một màu sắc và một kích cỡ để tạo biến thể.';
    }

    const missingImageColors = buildColorImageGroups(formData.variants)
      .filter((group) => group.images.length === 0)
      .map((group) => lookupMaps.colorMap.get(String(group.colorId))?.name || `#${group.colorId}`);
    if (missingImageColors.length > 0) {
      nextErrors.images = `Mỗi màu cần ít nhất một ảnh. Còn thiếu: ${missingImageColors.join(', ')}.`;
    }

    formData.variants.forEach((variant, index) => {
      if (!toIntOrNull(variant.colorId)) nextErrors[`variants.${index}.colorId`] = 'Vui lòng chọn màu sắc.';
      if (!toIntOrNull(variant.sizeId)) nextErrors[`variants.${index}.sizeId`] = 'Vui lòng chọn kích cỡ.';
      if (!String(variant.sku || '').trim()) nextErrors[`variants.${index}.sku`] = 'Vui lòng nhập mã SKU.';
      if (toNumber(variant.stock) < 0) nextErrors[`variants.${index}.stock`] = 'Tồn kho không được là số âm.';
    });

    setErrors(nextErrors);
    
    if (Object.keys(nextErrors).length > 0) {
      addNotification('Vui lòng kiểm tra lại các trường thông tin và biến thể.', 'warning');
    }
    
    return Object.keys(nextErrors).length === 0;
  }, [formData, addNotification, lookupMaps.colorMap]);

  const buildPayload = useCallback(() => {
    const variantsWithSynchronizedImages = synchronizeColorImages(formData.variants);
    const colorImages = buildColorImageGroups(variantsWithSynchronizedImages);
    const productImages = cleanImages(formData.images);
    const mainImageUrl = formData.mainImageUrl.trim()
      || colorImages.find((group) => group.images.length > 0)?.images[0]?.url
      || productImages[0]?.url
      || '';

    return {
      name: formData.name.trim(),
      description: formData.description.trim(),
      brandId: toIntOrNull(formData.brandId),
      categoryId: toIntOrNull(formData.categoryId),
      mainImageUrl,
      material: formData.material.trim(),
      careInstructions: formData.careInstructions.trim(),
      isFeatured: formData.isFeatured === true,
      isAvailable: formData.isAvailable !== false,
      price: toNumber(formData.price),
      imageUrls: productImages.map((image) => image.url),
      colorImages: colorImages.map((group) => ({
        colorId: toIntOrNull(group.colorId),
        imageUrls: group.images.map((image) => image.url),
      })),
      variants: variantsWithSynchronizedImages.map((variant) => ({
        id: variant.id || undefined,
        colorId: toIntOrNull(variant.colorId),
        sizeId: toIntOrNull(variant.sizeId),
        sku: String(variant.sku || '').trim(),
        price: toNumber(formData.price), // Giá biến thể lấy từ giá sản phẩm chính
        stock: toNumber(variant.stock),
        isAvailable: variant.isAvailable !== false,
        imageUrls: cleanImages(variant.images).map((image) => image.url),
      })),
    };
  }, [formData]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!validate()) return;
      onSubmit(buildPayload());
    },
    [buildPayload, onSubmit, validate]
  );

  return (
    <form className="pm-form" onSubmit={handleSubmit}>
      <div className="pm-form-header">
        <div>
          <p className="pm-kicker">{t('admin.productForm.kicker')}</p>
          <h2>{isEditing ? t('admin.productForm.update') : t('admin.productForm.create')}</h2>
        </div>
        <div className="pm-form-actions">
          <button className="pm-button pm-button-secondary" type="button" onClick={onCancel} disabled={isSaving}>
            {t('admin.productForm.cancel')}
          </button>
          <button className="pm-button pm-button-primary" type="submit" disabled={isSaving}>
            {isSaving ? t('admin.productForm.saving') : isEditing ? t('admin.productForm.update') : t('admin.productForm.createAction')}
          </button>
        </div>
      </div>

      <section className="pm-form-section">
        <div className="pm-section-heading">
          <h3>{t('admin.productForm.basic')}</h3>
        </div>

        <div className="pm-grid-two">
          <label className="pm-field">
            <span>{t('admin.productForm.name')}</span>
            <input
              value={formData.name}
              onChange={(event) => updateField('name', event.target.value)}
              className={errors.name ? 'is-invalid' : ''}
              placeholder={t('admin.productForm.name.placeholder')}
            />
            {errors.name ? <small>{errors.name}</small> : null}
          </label>

          <label className="pm-field">
            <span>{t('admin.productForm.price')}</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={formData.price}
              onChange={(event) => updateField('price', event.target.value)}
              className={errors.price ? 'is-invalid' : ''}
              placeholder={t('admin.productForm.price.placeholder')}
            />
            {errors.price ? <small>{errors.price}</small> : null}
          </label>
        </div>

        <label className="pm-field">
          <span>{t('admin.productForm.description')}</span>
          <textarea
            rows="5"
            value={formData.description}
            onChange={(event) => updateField('description', event.target.value)}
            className={errors.description ? 'is-invalid' : ''}
            placeholder={t('admin.productForm.description.placeholder')}
          />
          {errors.description ? <small>{errors.description}</small> : null}
        </label>

        <div className="pm-grid-two">
          <label className="pm-field">
            <span>{t('admin.productForm.brand')}</span>
            <select
              value={formData.brandId}
              onChange={(event) => updateField('brandId', event.target.value)}
              className={errors.brandId ? 'is-invalid' : ''}
            >
              <option value="">{t('admin.productForm.selectBrand')}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            {errors.brandId ? <small>{errors.brandId}</small> : null}
          </label>

          <label className="pm-field">
            <span>{t('admin.productForm.category')}</span>
            <select
              value={formData.categoryId}
              onChange={(event) => updateField('categoryId', event.target.value)}
              className={errors.categoryId ? 'is-invalid' : ''}
            >
              <option value="">{t('admin.productForm.selectCategory')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId ? <small>{errors.categoryId}</small> : null}
          </label>
        </div>

        <div className="pm-grid-two">
          <label className="pm-field">
            <span>{t('admin.productForm.material')}</span>
            <input value={formData.material} onChange={(event) => updateField('material', event.target.value)} />
          </label>

          <label className="pm-field">
            <span>{t('admin.productForm.care')}</span>
            <input
              value={formData.careInstructions}
              onChange={(event) => updateField('careInstructions', event.target.value)}
            />
          </label>
        </div>

        <div className="pm-switch-row">
          <label className="pm-switch">
            <input
              type="checkbox"
              checked={formData.isFeatured}
              onChange={(event) => updateField('isFeatured', event.target.checked)}
            />
            <span>{t('admin.productForm.featured')}</span>
          </label>
          <label className="pm-switch">
            <input
              type="checkbox"
              checked={formData.isAvailable}
              onChange={(event) => updateField('isAvailable', event.target.checked)}
            />
            <span>{t('admin.productForm.available')}</span>
          </label>
        </div>
      </section>

      <ProductImagesManager
        mainImageUrl={formData.mainImageUrl}
        images={formData.images}
        onMainImageChange={(value) => updateField('mainImageUrl', value)}
        onImagesChange={(images) => updateField('images', images)}
      />

      <VariantManager
        variants={formData.variants}
        colors={colors}
        sizes={sizes}
        colorMap={lookupMaps.colorMap}
        sizeMap={lookupMaps.sizeMap}
        errors={errors}
        productPrice={formData.price}
        onChange={(variants) => updateField('variants', variants)}
        onAddColor={handleAddColor}
        onAddSize={handleAddSize}
        onEditColor={handleEditColor}
        onDeleteColor={handleDeleteColor}
        onEditSize={handleEditSize}
        onDeleteSize={handleDeleteSize}
        onImageValidationChange={handleImageValidationChange}
      />

      <div className="pm-form-footer">
        <button className="pm-button pm-button-secondary" type="button" onClick={onCancel} disabled={isSaving}>
          {t('admin.productForm.cancel')}
        </button>
        <button className="pm-button pm-button-primary" type="submit" disabled={isSaving}>
          {isSaving ? t('admin.productForm.saving') : isEditing ? t('admin.productForm.update') : t('admin.productForm.createAction')}
        </button>
      </div>
    </form>
  );
}

export default memo(ProductForm);
