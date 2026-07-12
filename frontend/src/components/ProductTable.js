import React, { memo, useMemo } from 'react';

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

        return {
          id: product.id,
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
            <th>Ảnh</th>
            <th>Tên sản phẩm</th>
            <th>Thương hiệu</th>
            <th>Danh mục</th>
            <th>Giá sản phẩm</th>
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
                    <span>Không có ảnh</span>
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
                  {statusLabel[row.status] || 'Không rõ'}
                </span>
              </td>
              <td>
                <button className="pm-icon-button" type="button" onClick={() => onView(row.id)} title="Xem sản phẩm">
                  Xem
                </button>
              </td>
              <td>
                <button className="pm-icon-button" type="button" onClick={() => onEdit(row.id)} title="Sửa sản phẩm">
                  Sửa
                </button>
              </td>
              <td>
                <button className="pm-icon-button pm-danger" type="button" onClick={() => onDelete(row.id)} title="Xóa sản phẩm">
                  Xóa
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