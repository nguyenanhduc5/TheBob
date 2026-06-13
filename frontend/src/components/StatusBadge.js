import React from 'react';

export default function StatusBadge({ status }) {
  const statusMap = {
    available: { icon: '🟢', label: 'Đang bán', className: 'status-available' },
    lowStock: { icon: '🟡', label: 'Sắp hết hàng', className: 'status-low' },
    outOfStock: { icon: '🔴', label: 'Hết hàng', className: 'status-out' },
    discontinued: { icon: '⚫', label: 'Ngừng kinh doanh', className: 'status-discontinued' },
  };

  const statusInfo = statusMap[status] || statusMap.available;

  return (
    <span className={`status-badge ${statusInfo.className}`}>
      {statusInfo.icon} {statusInfo.label}
    </span>
  );
}
