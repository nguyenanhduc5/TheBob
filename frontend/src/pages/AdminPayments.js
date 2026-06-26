import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { paymentAPI } from '../api/app';
import '../styles/AdminOrders.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

const STATUS_FILTERS = ['All', 'Pending', 'Paid', 'Failed', 'Expired', 'Cancelled'];
const PAGE_SIZE = 20;

export default function AdminPayments() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await paymentAPI.getTransactions({ status, page, pageSize: PAGE_SIZE });
      setTransactions(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load payment transactions:', error);
      addNotification(error.message || 'Khong the tai danh sach thanh toan', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, page, status]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }

    loadTransactions();
  }, [isAdmin, loadTransactions, navigate]);

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

  const formatDate = (value) => {
    if (!value) return 'Chua co';
    return new Date(value).toLocaleString('vi-VN');
  };

  const statusClass = (value) => {
    if (value === 'Paid') return 'status-paid';
    if (value === 'Failed' || value === 'Expired' || value === 'Cancelled') return 'status-cancelled';
    return 'status-waiting';
  };

  const confirmPayment = async (transaction) => {
    if (!window.confirm(`Xac nhan thanh toan cho don #${transaction.orderId}?`)) return;

    try {
      setConfirmingId(transaction.id);
      await paymentAPI.confirmPayment({
        orderId: transaction.orderId,
        transactionCode: transaction.transactionId || `ADMIN_${transaction.orderId}_${Date.now()}`,
        note: 'Confirmed in admin payment management'
      });
      addNotification(`Da xac nhan thanh toan don #${transaction.orderId}`, 'success');
      await loadTransactions();
    } catch (error) {
      console.error('Confirm payment failed:', error);
      addNotification(error.message || 'Khong the xac nhan thanh toan', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  if (loading) {
    return <LoadingSkeleton type="table" />;
  }

  return (
    <div className="admin-orders-page">
      <div className="admin-header">
        <div>
          <h1>Quan Ly Thanh Toan</h1>
          <p>Giao dich SePay Virtual Account va trang thai doi soat tu webhook.</p>
        </div>
        <button className="btn-refresh" onClick={loadTransactions}>
          Lam moi du lieu
        </button>
      </div>

      <div className="orders-filters">
        {STATUS_FILTERS.map(item => (
          <button
            key={item}
            className={`filter-btn ${status === item ? 'active' : ''}`}
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {transactions.length === 0 ? (
        <div className="no-orders">Khong co giao dich nao</div>
      ) : (
        <div className="orders-table payments-table">
          <div className="table-header payments-header">
            <span>Ma GD</span>
            <span>Don hang</span>
            <span>VA Number</span>
            <span>So tien</span>
            <span>Trang thai</span>
            <span>Thoi gian</span>
            <span>Thao tac</span>
          </div>

          {transactions.map(transaction => (
            <div key={transaction.id} className="table-row payments-row">
              <span className="col-id">#{transaction.id}</span>
              <span>#{transaction.orderId}</span>
              <span className="mono-cell">{transaction.vaNumber || 'Chua tao'}</span>
              <span className="col-total">{formatMoney(transaction.amount)}</span>
              <span>
                <span className={`status-pill ${statusClass(transaction.status)}`}>
                  {transaction.status}
                </span>
              </span>
              <span>
                <div>{formatDate(transaction.paidAt || transaction.updatedAt)}</div>
                <div className="muted-line">{transaction.paymentProvider || 'SePay'}</div>
              </span>
              <span className="payment-actions">
                <button className="btn-view" onClick={() => navigate(`/orders/${transaction.orderId}`)}>
                  Chi tiet
                </button>
                {transaction.status === 'Pending' && (
                  <button
                    className="btn-confirm-payment"
                    onClick={() => confirmPayment(transaction)}
                    disabled={confirmingId === transaction.id}
                  >
                    {confirmingId === transaction.id ? 'Dang xac nhan...' : 'Xac nhan thanh toan'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-pagination">
        <button className="filter-btn" disabled={page <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>
          Truoc
        </button>
        <span>Trang {page}/{totalPages}</span>
        <button className="filter-btn" disabled={page >= totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>
          Sau
        </button>
      </div>
    </div>
  );
}
