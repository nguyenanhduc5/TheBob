import React, { memo, useMemo } from 'react';

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const safeText = (value, fallback = '-') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const getVariants = (product) => {
  if (Array.isArray(product?.variants)) return product.variants;
  if (Array.isArray(product?.productVariants)) return product.productVariants;
  return [];
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const formatPrice = (value) => currencyFormatter.format(toNumber(value));

export const formatPriceRange = (variants) => {
  const prices = (Array.isArray(variants) ? variants : [])
    .map((variant) => toNumber(variant?.price))
    .filter((price) => price > 0);

  if (prices.length === 0) return '-';

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`;
};

const getTotalStock = (product) =>
  getVariants(product).reduce((sum, variant) => sum + toNumber(variant?.stock), 0);

const statusLabel = {
  available: 'Đang bán',
  lowStock: 'Sắp hết',
  outOfStock: 'Hết hàng',
  inactive: 'Tạm ẩn',
};

function ProductTable({ products, getProductStatus, onEdit, onDelete, onView }) {
  const rows = useMemo(
    () =>
      (Array.isArray(products) ? products : []).map((product) => {
        const variants = getVariants(product);
        const status = getProductStatus(product);

        return {
          id: product.id,
          image: safeText(product.mainImageUrl, ''),
          name: safeText(product.name),
          brandName: safeText(product.brandName ?? product.brand),
          categoryName: safeText(product.categoryName ?? product.category),
          priceRange: formatPriceRange(variants),
          totalStock: getTotalStock(product),
          variantCount: variants.length,
          status,
        };
      }),
    [getProductStatus, products]
  );

  return (
    <div className="pm-table-wrap">
      <table className="pm-table">
        <thead>
          <tr>
            <th>Ảnh</th>
            <th>Tên sản phẩm</th>
            <th>Thương hiệu</th>
            <th>Danh mục</th>
            <th>Giá thấp nhất</th>
            <th>Tổng tồn kho</th>
            <th>Biến thể</th>
            <th>Trạng thái</th>
            <th>Xem</th>
            <th>Sửa</th>
            <th>Xóa</th>
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
                    <span>No image</span>
                  )}
                </div>
              </td>
              <td>
                <strong>{row.name}</strong>
              </td>
              <td>{row.brandName}</td>
              <td>{row.categoryName}</td>
              <td className="pm-price">{row.priceRange}</td>
              <td>
                <span className={`pm-stock ${row.totalStock === 0 ? 'is-empty' : row.totalStock <= 10 ? 'is-low' : ''}`}>
                  {row.totalStock}
                </span>
              </td>
              <td>{row.variantCount}</td>
              <td>
                <span className={`pm-status pm-status-${row.status}`}>
                  {statusLabel[row.status] || 'Không rõ'}
                </span>
              </td>
              <td>
                <button className="pm-icon-button" type="button" onClick={() => onView(row.id)} title="Xem sản phẩm">
                  View
                </button>
              </td>
              <td>
                <button className="pm-icon-button" type="button" onClick={() => onEdit(row.id)} title="Sửa sản phẩm">
                  Edit
                </button>
              </td>
              <td>
                <button className="pm-icon-button pm-danger" type="button" onClick={() => onDelete(row.id)} title="Xóa sản phẩm">
                  Delete
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
