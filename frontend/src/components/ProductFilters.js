import React, { useState } from 'react';

const statusOptions = [
  { value: 'available', label: '🟢 Đang bán', color: 'green' },
  { value: 'lowStock', label: '🟡 Sắp hết hàng', color: 'yellow' },
  { value: 'outOfStock', label: '🔴 Hết hàng', color: 'red' },
  { value: 'discontinued', label: '⚫ Ngừng kinh doanh', color: 'gray' },
];

export default function ProductFilters({
  categories,
  brands,
  selectedCategory,
  setSelectedCategory,
  selectedBrand,
  setSelectedBrand,
  selectedStatus,
  setSelectedStatus,
  stockFilter,
  setStockFilter,
  hasActiveFilters,
  onClearFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="filters-container">
      <button
        className={`filters-toggle ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-active' : ''}`}
        onClick={() => setShowFilters(!showFilters)}
      >
        {hasActiveFilters ? '⚙️ Bộ lọc (có bộ lọc đang hoạt động)' : '⚙️ Bộ lọc'}
      </button>

      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Danh Mục</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Thương Hiệu</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả thương hiệu</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Trạng Thái</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả trạng thái</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Kho Hàng</label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả</option>
              <option value="lowStock">Sắp hết hàng (&lt;= 10)</option>
              <option value="outOfStock">Hết hàng (0)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button className="filter-clear-btn" onClick={onClearFilters}>
              🔄 Xóa toàn bộ bộ lọc
            </button>
          )}
        </div>
      )}
    </div>
  );
}
