import React from 'react';

export default function Pagination({
  currentPage,
  totalPages,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage,
  totalItems,
}) {
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        <span>
          Hiển thị {startItem} - {endItem} trong {totalItems} sản phẩm
        </span>
        <div className="items-per-page">
          <label>Mỗi trang:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className="items-select"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="pagination-controls">
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          className="btn-prev"
        >
          ← Trước
        </button>

        <div className="page-info">
          Trang {currentPage} / {totalPages}
        </div>

        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          className="btn-next"
        >
          Tiếp →
        </button>
      </div>
    </div>
  );
}
