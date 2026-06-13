import React, { memo, useCallback, useMemo, useState } from 'react';
import ProductImagesManager from './ProductImagesManager';
import VariantManager from './VariantManager';

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

const cleanImages = (images) =>
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

    if (!formData.name.trim()) nextErrors.name = 'Ten san pham la bat buoc.';
    if (!formData.description.trim()) nextErrors.description = 'Mo ta la bat buoc.';
    if (!toIntOrNull(formData.brandId)) nextErrors.brandId = 'Vui long chon thuong hieu.';
    if (!toIntOrNull(formData.categoryId)) nextErrors.categoryId = 'Vui long chon danh muc.';
    if (toNumber(formData.price) <= 0) nextErrors.price = 'Gia san pham phai lon hon 0.';

    if (!Array.isArray(formData.variants) || formData.variants.length === 0) {
      nextErrors.variants = 'Hay chon it nhat mot mau va mot size de tao bien the.';
    }

    formData.variants.forEach((variant, index) => {
      if (!toIntOrNull(variant.colorId)) nextErrors[`variants.${index}.colorId`] = 'Chon mau.';
      if (!toIntOrNull(variant.sizeId)) nextErrors[`variants.${index}.sizeId`] = 'Chon size.';
      if (!String(variant.sku || '').trim()) nextErrors[`variants.${index}.sku`] = 'SKU la bat buoc.';
      if (toNumber(variant.stock) < 0) nextErrors[`variants.${index}.stock`] = 'Ton kho khong duoc am.';
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [formData]);

  const buildPayload = useCallback(() => {
    const productPrice = toNumber(formData.price);

    return {
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
        price: productPrice,
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
          <p className="pm-kicker">Product Admin</p>
          <h2>{isEditing ? 'Sua san pham' : 'Them san pham'}</h2>
        </div>
        <div className="pm-form-actions">
          <button className="pm-button pm-button-secondary" type="button" onClick={onCancel} disabled={isSaving}>
            Huy
          </button>
          <button className="pm-button pm-button-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Dang luu...' : isEditing ? 'Cap nhat' : 'Tao san pham'}
          </button>
        </div>
      </div>

      <section className="pm-form-section">
        <div className="pm-section-heading">
          <h3>Thong tin co ban</h3>
        </div>

        <div className="pm-grid-two">
          <label className="pm-field">
            <span>Ten</span>
            <input
              value={formData.name}
              onChange={(event) => updateField('name', event.target.value)}
              className={errors.name ? 'is-invalid' : ''}
              placeholder="Ao thun cotton premium"
            />
            {errors.name ? <small>{errors.name}</small> : null}
          </label>

          <label className="pm-field">
            <span>Gia san pham</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={formData.price}
              onChange={(event) => updateField('price', event.target.value)}
              className={errors.price ? 'is-invalid' : ''}
              placeholder="250000"
            />
            {errors.price ? <small>{errors.price}</small> : null}
          </label>
        </div>

        <label className="pm-field">
          <span>Mo ta</span>
          <textarea
            rows="5"
            value={formData.description}
            onChange={(event) => updateField('description', event.target.value)}
            className={errors.description ? 'is-invalid' : ''}
            placeholder="Mo ta chat lieu, form dang, cam giac mac..."
          />
          {errors.description ? <small>{errors.description}</small> : null}
        </label>

        <div className="pm-grid-two">
          <label className="pm-field">
            <span>Thuong hieu</span>
            <select
              value={formData.brandId}
              onChange={(event) => updateField('brandId', event.target.value)}
              className={errors.brandId ? 'is-invalid' : ''}
            >
              <option value="">Chon thuong hieu</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            {errors.brandId ? <small>{errors.brandId}</small> : null}
          </label>

          <label className="pm-field">
            <span>Danh muc</span>
            <select
              value={formData.categoryId}
              onChange={(event) => updateField('categoryId', event.target.value)}
              className={errors.categoryId ? 'is-invalid' : ''}
            >
              <option value="">Chon danh muc</option>
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
            <span>Chat lieu</span>
            <input value={formData.material} onChange={(event) => updateField('material', event.target.value)} />
          </label>

          <label className="pm-field">
            <span>Huong dan bao quan</span>
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
            <span>San pham noi bat</span>
          </label>
          <label className="pm-switch">
            <input
              type="checkbox"
              checked={formData.isAvailable}
              onChange={(event) => updateField('isAvailable', event.target.checked)}
            />
            <span>Dang ban</span>
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
      />

      <div className="pm-form-footer">
        <button className="pm-button pm-button-secondary" type="button" onClick={onCancel} disabled={isSaving}>
          Huy
        </button>
        <button className="pm-button pm-button-primary" type="submit" disabled={isSaving}>
          {isSaving ? 'Dang luu...' : isEditing ? 'Cap nhat san pham' : 'Tao san pham'}
        </button>
      </div>
    </form>
  );
}

export default memo(ProductForm);
