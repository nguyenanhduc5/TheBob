import React, { memo, useMemo } from 'react';
import { usePreferences } from '../../../context/PreferencesContext';

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const getVariants = (product) => {
  if (Array.isArray(product?.variants)) return product.variants;
  if (Array.isArray(product?.productVariants)) return product.productVariants;
  return [];
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safeText = (value, fallback = '-') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return safeText(value.name, fallback);
  const text = String(value).trim();
  return text || fallback;
};

export const formatPrice = (value) => currencyFormatter.format(toNumber(value));

export const getProductPrice = (product) => {
  const directPrice = toNumber(product?.price ?? product?.minPrice);
  if (directPrice > 0) return directPrice;
  return toNumber(getVariants(product).find((variant) => toNumber(variant?.price) > 0)?.price);
};

const getTotalStock = (product) =>
  getVariants(product).reduce((sum, variant) => sum + toNumber(variant?.stock), 0);

const statusLabel = {
  available: 'admin.products.available',
  lowStock: 'admin.products.lowStock',
  outOfStock: 'admin.products.outOfStock',
  inactive: 'admin.products.inactive',
};

function ProductTable({ products, getProductStatus, onEdit, onDelete, onView }) {
  const { t } = usePreferences();
  const rows = useMemo(
    () =>
      (Array.isArray(products) ? products : []).map((product) => {
        const variants = getVariants(product);

        return {
          id: product.id,
          slug: product.slug,
          image: safeText(product.mainImageUrl, ''),
          name: safeText(product.name),
          brandName: safeText(product.brandName ?? product.brand),
          categoryName: safeText(product.categoryName ?? product.category),
          price: getProductPrice(product),
          totalStock: getTotalStock(product),
          variantCount: variants.length,
          status: getProductStatus(product),
        };
      }),
    [getProductStatus, products]
  );

  return (
    <div className="pm-table-wrap">
      <table className="pm-table">
        <thead>
          <tr>
            <th>{t('admin.productTable.image')}</th>
            <th>{t('admin.productTable.name')}</th>
            <th>{t('admin.productTable.brand')}</th>
            <th>{t('admin.productTable.category')}</th>
            <th>{t('admin.productTable.price')}</th>
            <th>{t('admin.productTable.stock')}</th>
            <th>{t('admin.productTable.variants')}</th>
            <th>{t('admin.productTable.status')}</th>
            <th>{t('admin.productTable.view')}</th>
            <th>{t('admin.productTable.edit')}</th>
            <th>{t('admin.productTable.delete')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="pm-thumb">
                  {row.image ? (
                    <img src={row.image} alt={row.name} loading="lazy" />
                  ) : (
                    <span>{t('admin.productTable.noImage')}</span>
                  )}
                </div>
              </td>
              <td>
                <strong>{row.name}</strong>
              </td>
              <td>{row.brandName}</td>
              <td>{row.categoryName}</td>
              <td className="pm-price">{row.price > 0 ? formatPrice(row.price) : '-'}</td>
              <td>
                <span className={`pm-stock ${row.totalStock === 0 ? 'is-empty' : row.totalStock <= 10 ? 'is-low' : ''}`}>
                  {row.totalStock}
                </span>
              </td>
              <td>{row.variantCount}</td>
              <td>
                <span className={`pm-status pm-status-${row.status}`}>
                  {statusLabel[row.status] ? t(statusLabel[row.status]) : t('admin.productTable.unknown')}
                </span>
              </td>
              <td>
                <button className="pm-icon-button" type="button" onClick={() => onView(row.slug || row.id)} title={t('admin.productTable.viewTitle')}>
                  {t('admin.productTable.view')}
                </button>
              </td>
              <td>
                <button className="pm-icon-button" type="button" onClick={() => onEdit(row.id)} title={t('admin.productTable.editTitle')}>
                  {t('admin.productTable.edit')}
                </button>
              </td>
              <td>
                <button className="pm-icon-button pm-danger" type="button" onClick={() => onDelete(row.id)} title={t('admin.productTable.deleteTitle')}>
                  {t('admin.productTable.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(ProductTable);