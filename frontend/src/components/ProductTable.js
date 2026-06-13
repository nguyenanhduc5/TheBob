import React from 'react';
import StatusBadge from './StatusBadge';

export default function ProductTable({
  products,
  getProductStatus,
  onEdit,
  onDelete,
  onView,
}) {
  const getTotalStock = (product) => {
    return product.productVariants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
  };

  const getVariantCount = (product) => {
    return product.productVariants?.length || 0;
  };

  return (
    <div className="products-table-wrapper">
      <table className="products-table">
        <thead>
          <tr>
            <th className="col-image">Ảnh</th>
            <th className="col-product">Sản Phẩm</th>
            <th className="col-sku">SKU</th>
            <th className="col-category">Danh Mục</th>
            <th className="col-price">Giá</th>
            <th className="col-stock">Tồn Kho</th>
            <th className="col-variants">Biến Thể</th>
            <th className="col-status">Trạng Thái</th>
            <th className="col-actions">Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="table-row">
              <td className="col-image">
                <div className="product-image">
                  {product.mainImageUrl ? (
                    <img src={product.mainImageUrl} alt={product.name} />
                  ) : (
                    <div className="image-placeholder">📷</div>
                  )}
                </div>
              </td>
              <td className="col-product">
                <div className="product-info">
                  <h4>{product.name}</h4>
                  {product.brand && <span className="product-brand">{product.brand}</span>}
                </div>
              </td>
              <td className="col-sku">
                <code>{product.sku}</code>
              </td>
              <td className="col-category">
                {product.category?.name || '-'}
              </td>
              <td className="col-price">
                <strong>{product.price?.toLocaleString('vi-VN')}đ</strong>
              </td>
              <td className="col-stock">
                <span className={`stock-badge ${getTotalStock(product) === 0 ? 'empty' : getTotalStock(product) <= 10 ? 'low' : ''}`}>
                  {getTotalStock(product)}
                </span>
              </td>
              <td className="col-variants">
                <span className="variant-count">{getVariantCount(product)} biến thể</span>
              </td>
              <td className="col-status">
                <StatusBadge status={getProductStatus(product)} />
              </td>
              <td className="col-actions">
                <div className="action-buttons">
                  <button
                    className="btn-icon btn-view"
                    onClick={() => onView(product.id)}
                    title="Xem"
                  >
                    👁️
                  </button>
                  <button
                    className="btn-icon btn-edit"
                    onClick={() => onEdit(product.id)}
                    title="Sửa"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-stock"
                    title="Quản lý kho"
                  >
                    📦
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    onClick={() => onDelete(product.id)}
                    title="Xóa"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
