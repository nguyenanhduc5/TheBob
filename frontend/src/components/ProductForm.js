import React, { memo, useCallback, useMemo, useState } from 'react';
import ProductImagesManager from './ProductImagesManager';
import VariantManager from './VariantManager';

const createClientId = () => `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultProduct = {
  name: '',
  description: '',
  brandId: '',
  categoryId: '',
  mainImageUrl: '',
  material: '',
  careInstructions: '',
  isFeatured: false,
  isAvailable: true,
  images: [],
  variants: [
    {
      clientId: createClientId(),
      id: null,
      colorId: '',
      sizeId: '',
      sku: '',
      price: '',
      stock: 0,
      isAvailable: true,
      images: [],
    },
  ],
};

const toIntOrNull = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeFormProduct = (product) => {
  if (!product) return defaultProduct;

  return {
    ...defaultProduct,
    ...product,
    brandId: product.brandId ?? '',
    categoryId: product.categoryId ?? '',
    images: Array.isArray(product.images) ? product.images : [],
    variants: (Array.isArray(product.variants) && product.variants.length > 0 ? product.variants : defaultProduct.variants).map(
      (variant) => ({
        clientId: variant.clientId || createClientId(),
        id: variant.id ?? null,
        colorId: variant.colorId ?? '',
        sizeId: variant.sizeId ?? '',
        sku: variant.sku || '',
        price: variant.price ?? '',
        stock: variant.stock ?? 0,
        isAvailable: variant.isAvailable !== false,
        images: Array.isArray(variant.images) ? variant.images : [],
      })
    ),
  };
};

const cleanImages = (images) =>
  (Array.isArray(images) ? images : [])
    .map((image, index) => ({
      url: typeof image?.url === 'string' ? image.url.trim() : '',
      sortOrder: index,
    }))
    .filter((image) => image.url);

function ProductForm({ initialProduct, isEditing, isSaving, lookups, lookupMaps, onCancel, onSubmit }) {
  const [formData, setFormData] = useState(() => normalizeFormProduct(initialProduct));
  const [errors, setErrors] = useState({});

  const brands = useMemo(() => (Array.isArray(lookups?.brands) ? lookups.brands : []), [lookups]);
  const categories = useMemo(() => (Array.isArray(lookups?.categories) ? lookups.categories : []), [lookups]);
  const colors = useMemo(() => (Array.isArray(lookups?.colors) ? lookups.colors : []), [lookups]);
  const sizes = useMemo(() => (Array.isArray(lookups?.sizes) ? lookups.sizes : []), [lookups]);

  const updateField = useCallback((field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const validate = useCallback(() => {
    const nextErrors = {};

    if (!formData.name.trim()) nextErrors.name = 'Tên sản phẩm là bắt buộc.';
    if (!formData.description.trim()) nextErrors.description = 'Mô tả là bắt buộc.';
    if (!toIntOrNull(formData.brandId)) nextErrors.brandId = 'Vui lòng chọn thương hiệu.';
    if (!toIntOrNull(formData.categoryId)) nextErrors.categoryId = 'Vui lòng chọn danh mục.';

    if (!Array.isArray(formData.variants) || formData.variants.length === 0) {
      nextErrors.variants = 'Sản phẩm phải có ít nhất một biến thể.';
    }

    formData.variants.forEach((variant, index) => {
      if (!toIntOrNull(variant.colorId)) nextErrors[`variants.${index}.colorId`] = 'Chọn màu.';
      if (!toIntOrNull(variant.sizeId)) nextErrors[`variants.${index}.sizeId`] = 'Chọn size.';
      if (!String(variant.sku || '').trim()) nextErrors[`variants.${index}.sku`] = 'SKU là bắt buộc.';
      if (toNumber(variant.price) <= 0) nextErrors[`variants.${index}.price`] = 'Giá phải lớn hơn 0.';
      if (toNumber(variant.stock) < 0) nextErrors[`variants.${index}.stock`] = 'Tồn kho không được âm.';
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [formData]);

  const buildPayload = useCallback(
    () => ({
      name: formData.name.trim(),
      description: formData.description.trim(),
      brandId: toIntOrNull(formData.brandId),
      categoryId: toIntOrNull(formData.categoryId),
      mainImageUrl: formData.mainImageUrl.trim(),
      material: formData.material.trim(),
      careInstructions: formData.careInstructions.trim(),
      isFeatured: formData.isFeatured === true,
      isAvailable: formData.isAvailable !== false,
      imageUrls: cleanImages(formData.images).map((image) => image.url),
      variants: formData.variants.map((variant) => ({
        id: variant.id || undefined,
        colorId: toIntOrNull(variant.colorId),
        sizeId: toIntOrNull(variant.sizeId),
        sku: String(variant.sku || '').trim(),
        price: toNumber(variant.price),
        stock: toNumber(variant.stock),
        isAvailable: variant.isAvailable !== false,
        imageUrls: cleanImages(variant.images).map((image) => image.url),
      })),
    }),
    [formData]
  );

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
          <p className="pm-kicker">Product Admin</p>
          <h2>{isEditing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
        </div>
        <div className="pm-form-actions">
          <button className="pm-button pm-button-secondary" type="button" onClick={onCancel} disabled={isSaving}>
            Hủy
          </button>
          <button className="pm-button pm-button-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo sản phẩm'}
          </button>
        </div>
      </div>

      <section className="pm-form-section">
        <div className="pm-section-heading">
          <h3>Thông tin cơ bản</h3>
        </div>

        <div className="pm-grid-two">
          <label className="pm-field">
            <span>Tên</span>
            <input
              value={formData.name}
              onChange={(event) => updateField('name', event.target.value)}
              className={errors.name ? 'is-invalid' : ''}
              placeholder="Áo thun cotton premium"
            />
            {errors.name ? <small>{errors.name}</small> : null}
          </label>
          <label className="pm-field">
            <span>Thương hiệu</span>
            <select
              value={formData.brandId}
              onChange={(event) => updateField('brandId', event.target.value)}
              className={errors.brandId ? 'is-invalid' : ''}
            >
              <option value="">Chọn thương hiệu</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            {errors.brandId ? <small>{errors.brandId}</small> : null}
          </label>
        </div>

        <label className="pm-field">
          <span>Mô tả</span>
          <textarea
            rows="5"
            value={formData.description}
            onChange={(event) => updateField('description', event.target.value)}
            className={errors.description ? 'is-invalid' : ''}
            placeholder="Mô tả chất liệu, phom dáng, cảm giác mặc..."
          />
          {errors.description ? <small>{errors.description}</small> : null}
        </label>

        <div className="pm-grid-two">
          <label className="pm-field">
            <span>Danh mục</span>
            <select
              value={formData.categoryId}
              onChange={(event) => updateField('categoryId', event.target.value)}
              className={errors.categoryId ? 'is-invalid' : ''}
            >
              <option value="">Chọn danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId ? <small>{errors.categoryId}</small> : null}
          </label>
          <label className="pm-field">
            <span>Chất liệu</span>
            <input value={formData.material} onChange={(event) => updateField('material', event.target.value)} />
          </label>
        </div>

        <label className="pm-field">
          <span>Hướng dẫn bảo quản</span>
          <input
            value={formData.careInstructions}
            onChange={(event) => updateField('careInstructions', event.target.value)}
          />
        </label>

        <div className="pm-switch-row">
          <label className="pm-switch">
            <input
              type="checkbox"
              checked={formData.isFeatured}
              onChange={(event) => updateField('isFeatured', event.target.checked)}
            />
            <span>Sản phẩm nổi bật</span>
          </label>
          <label className="pm-switch">
            <input
              type="checkbox"
              checked={formData.isAvailable}
              onChange={(event) => updateField('isAvailable', event.target.checked)}
            />
            <span>Đang bán</span>
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
        onChange={(variants) => updateField('variants', variants)}
      />

      <div className="pm-form-footer">
        <button className="pm-button pm-button-secondary" type="button" onClick={onCancel} disabled={isSaving}>
          Hủy
        </button>
        <button className="pm-button pm-button-primary" type="submit" disabled={isSaving}>
          {isSaving ? 'Đang lưu...' : isEditing ? 'Cập nhật sản phẩm' : 'Tạo sản phẩm'}
        </button>
      </div>
    </form>
  );
}

export default memo(ProductForm);
