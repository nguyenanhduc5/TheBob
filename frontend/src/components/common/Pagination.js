import React from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import './Pagination.css';

export default function Pagination({
  currentPage,
  totalPages,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage,
  totalItems,
}) {
  const { t } = usePreferences();
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        <span>
          {t('admin.pagination.showing', { start: startItem, end: endItem, total: totalItems })}
        </span>
        <div className="items-per-page">
          <label>{t('admin.pagination.perPage')}</label>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(parseInt(e.target.value, 10));
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

      {/* Chỉ ẩn nút điều hướng khi chỉ có 1 trang, ô chọn "Mỗi trang" luôn hiển thị */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button onClick={handlePrevPage} disabled={currentPage === 1} className="btn-prev">
            {t('admin.pagination.previous')}
          </button>

          <div className="page-info">
            {t('admin.pagination.page', { page: currentPage, pages: totalPages })}
          </div>

          <button onClick={handleNextPage} disabled={currentPage === totalPages} className="btn-next">
            {t('admin.pagination.next')}
          </button>
        </div>
      )}
    </div>
  );
}