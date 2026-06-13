import React from 'react';
import './LoadingSkeleton.css';

export default function LoadingSkeleton({ type = 'content' }) {
  if (type === 'content') {
    return (
      <div className="loading-skeleton">
        <div className="skeleton-header">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-subtitle"></div>
        </div>
        <div className="skeleton-toolbar">
          <div className="skeleton-element skeleton-button"></div>
          <div className="skeleton-element skeleton-button"></div>
        </div>
        <div className="skeleton-table">
          <div className="skeleton-table-header">
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-table-row">
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="loading-skeleton">
        <div className="skeleton-table">
          <div className="skeleton-table-header">
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton-table-row">
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="loading-skeleton">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-card-header"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line skeleton-line-short"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
