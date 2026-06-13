import React from 'react';

export default function ProductSearch({
  searchQuery,
  setSearchQuery,
  searchType,
  setSearchType,
}) {
  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Tìm theo tên sản phẩm hoặc SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => setSearchQuery('')}
            type="button"
            title="Xóa tìm kiếm"
          >
            ✕
          </button>
        )}
      </div>
      <select
        className="search-type-select"
        value={searchType}
        onChange={(e) => setSearchType(e.target.value)}
      >
        <option value="name">Theo tên</option>
        <option value="sku">Theo SKU</option>
      </select>
    </div>
  );
}
