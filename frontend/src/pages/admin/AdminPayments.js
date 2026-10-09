import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { paymentAPI } from '../../api/app';
import { Icons } from '../../components/icons';
import '../../styles/AdminOrders.css';
import LoadingSkeleton from '../../components/LoadingSkeleton';

const RefreshIcon = Icons.refresh;
const BankIcon = Icons.cash;
const OrdersIcon = Icons.orders;

const STATUS_FILTERS = [
  { value: 'All', label: 'Tất cả' },
  { value: 'Pending', label: 'Chờ thanh toán' },
  { value: 'Paid', label: 'Đã thanh toán' },
  { value: 'Failed', label: 'Thất bại' },
  { value: 'Expired', label: 'Hết hạn' },
  { value: 'Cancelled', label: 'Đã hủy' },
];
const STATUS_LABELS = {
  Pending: 'Chờ thanh toán',
  Paid: 'Đã thanh toán',
  Failed: 'Thất bại',
  Expired: 'Hết hạn',
  Cancelled: 'Đã hủy',
};
const PAGE_SIZE = 20;
const SEPAY_LIMITS = [100, 500, 1000, 5000];

export default function AdminPayments() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [transactions, setTransactions] = useState([]);
  const [sepayTransactions, setSepayTransactions] = useState([]);
  const [source, setSource] = useState('sepay');
  const [direction, setDirection] = useState('all');
  const [sepayLimit, setSepayLimit] = useState(100);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sepayLoading, setSepayLoading] = useState(true);
  const [sepayError, setSepayError] = useState('');
  const [retrievedAt, setRetrievedAt] = useState(null);
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
      addNotification(error.message || 'Không thể tải danh sách thanh toán', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, page, status]);

  const loadSepayTransactions = useCallback(async () => {
    try {
      setSepayLoading(true);
      setSepayError('');
      const result = await paymentAPI.getSepayTransactions({
        limit: sepayLimit,
        transactionDateMin: dateFrom || undefined,
        transactionDateMax: dateTo || undefined,
      });
      setSepayTransactions(result.items || []);
      setRetrievedAt(result.retrievedAt || null);
    } catch (error) {
      console.error('Failed to load transactions from SePay API:', error);
      setSepayError(error.message || 'Không thể tải dữ liệu giao dịch từ SePay API.');
      addNotification(error.message || 'Không thể tải dữ liệu từ SePay API', 'error');
    } finally {
      setSepayLoading(false);
    }
  }, [addNotification, dateFrom, dateTo, sepayLimit]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }

    if (source === 'sepay') loadSepayTransactions();
    else loadTransactions();
  }, [isAdmin, loadSepayTransactions, loadTransactions, navigate, source]);

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

  const statusClass = (value) => {
    if (value === 'Paid') return 'status-paid';
    if (value === 'Failed' || value === 'Expired' || value === 'Cancelled') return 'status-cancelled';
    return 'status-waiting';
  };

  const filteredSepayTransactions = useMemo(() => sepayTransactions.filter(transaction => {
    if (direction === 'incoming') return Number(transaction.amountIn) > 0;
    if (direction === 'outgoing') return Number(transaction.amountOut) > 0;
    return true;
  }), [direction, sepayTransactions]);

  const formatDate = (value) => {
    if (!value) return 'Chưa có';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
  };

  const confirmPayment = async (transaction) => {
    if (!window.confirm(`Xác nhận thanh toán cho đơn hàng #${transaction.orderId}?`)) return;

    try {
      setConfirmingId(transaction.id);
      await paymentAPI.confirmPayment({
        orderId: transaction.orderId,
        transactionCode: transaction.transactionId || `ADMIN_${transaction.orderId}_${Date.now()}`,
        note: 'Confirmed in admin payment management'
      });
      addNotification(`Đã xác nhận thanh toán đơn hàng #${transaction.orderId}`, 'success');
      await loadTransactions();
    } catch (error) {
      console.error('Confirm payment failed:', error);
      addNotification(error.message || 'Không thể xác nhận thanh toán', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  if (source === 'local' && loading) {
    return <LoadingSkeleton type="table" />;
  }

  return (
    <div className="admin-orders-page">
      <div className="admin-header">
        <div>
          <span className="orders-eyebrow">ĐỐI SOÁT THANH TOÁN</span>
          <h1>Quản lý thanh toán</h1>
          <p className="admin-header-sub">Theo dõi giao dịch ngân hàng trên SePay và đối chiếu với đơn hàng THEBOB.</p>
        </div>
        <button className="btn-refresh" onClick={source === 'sepay' ? loadSepayTransactions : loadTransactions}>
          <RefreshIcon size={17} />
          Làm mới dữ liệu
        </button>
      </div>

      <div className="orders-filters payments-source-tabs">
        <button
          type="button"
          className={`filter-btn${source === 'sepay' ? ' active' : ''}`}
          onClick={() => setSource('sepay')}
        >
          <BankIcon size={16} />
          Giao dịch SePay API
        </button>
        <button
          type="button"
          className={`filter-btn${source === 'local' ? ' active' : ''}`}
          onClick={() => setSource('local')}
        >
          <OrdersIcon size={16} />
          Đối soát nội bộ
        </button>
      </div>

      {source === 'sepay' ? (
        <>
          <div className="sepay-toolbar">
            <div className="sepay-date-filters">
              <label>
                Từ ngày
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} />
              </label>
              <label>
                Đến ngày
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} />
              </label>
              <label>
                Số giao dịch
                <select value={sepayLimit} onChange={event => setSepayLimit(Number(event.target.value))}>
                  {SEPAY_LIMITS.map(limit => <option key={limit} value={limit}>{limit.toLocaleString('vi-VN')}</option>)}
                </select>
              </label>
            </div>
            <div className="orders-filters sepay-direction-filters">
              {[
                { value: 'all', label: 'Tất cả' },
                { value: 'incoming', label: 'Tiền vào' },
                { value: 'outgoing', label: 'Tiền ra' },
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  className={`filter-btn${direction === item.value ? ' active' : ''}`}
                  onClick={() => setDirection(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {retrievedAt && !sepayLoading && (
            <p className="sepay-refresh-note">Dữ liệu trực tiếp từ SePay · Cập nhật lúc {formatDate(retrievedAt)}</p>
          )}

          {sepayLoading ? (
            <LoadingSkeleton type="table" />
          ) : sepayError ? (
            <div className="sepay-api-error" role="alert">
              <strong>Không thể kết nối SePay API</strong>
              <span>{sepayError}</span>
              <button type="button" className="btn-view" onClick={loadSepayTransactions}>Thử lại</button>
            </div>
          ) : filteredSepayTransactions.length === 0 ? (
            <div className="no-orders">
              {sepayTransactions.length === 0 ? 'SePay chưa trả về giao dịch nào trong khoảng thời gian này.' : 'Không có giao dịch phù hợp với bộ lọc.'}
            </div>
          ) : (
            <div className="orders-table payments-table sepay-table">
              <div className="table-header sepay-header">
                <span>Mã SePay</span>
                <span>Thời gian</span>
                <span>Tài khoản / VA</span>
                <span>Nội dung chuyển khoản</span>
                <span>Tiền vào</span>
                <span>Tiền ra</span>
                <span>Số dư sau GD</span>
                <span>Đối chiếu đơn hàng</span>
              </div>
              {filteredSepayTransactions.map(transaction => (
                <div key={`${transaction.id}-${transaction.accountNumber}`} className="table-row sepay-row">
                  <span className="mono-cell">{transaction.id || '—'}</span>
                  <span>{formatDate(transaction.transactionDate)}</span>
                  <span className="sepay-account-cell">
                    <span>{transaction.accountNumber || '—'}</span>
                    {transaction.subAccount && <small>VA: {transaction.subAccount}</small>}
                    <small>{transaction.bankBrandName || transaction.gateway || 'Ngân hàng'}</small>
                  </span>
                  <span className="sepay-content-cell" title={transaction.transactionContent}>
                    {transaction.transactionContent || 'Không có nội dung'}
                    {transaction.referenceCode && <small>Mã tham chiếu: {transaction.referenceCode}</small>}
                  </span>
                  <span className="sepay-money-in">{Number(transaction.amountIn) > 0 ? formatMoney(transaction.amountIn) : '—'}</span>
                  <span className="sepay-money-out">{Number(transaction.amountOut) > 0 ? formatMoney(transaction.amountOut) : '—'}</span>
                  <span className="sepay-balance">{Number(transaction.accumulated) > 0 ? formatMoney(transaction.accumulated) : '—'}</span>
                  <span>
                    {transaction.matchedOrderId ? (
                      <button type="button" className="sepay-order-link" onClick={() => navigate(`/orders/${transaction.matchedOrderId}`)}>
                        Đơn #{transaction.matchedOrderNumber || transaction.matchedOrderId}
                        <small>{transaction.orderPaymentStatus === 'Paid' ? 'Đã thanh toán' : transaction.orderPaymentStatus || 'Đã khớp VA'}</small>
                        {transaction.expectedAmount != null && (
                          <small className={Math.abs(Number(transaction.amountIn) - Number(transaction.expectedAmount)) < 0.01 ? 'sepay-amount-match' : 'sepay-amount-mismatch'}>
                            {Math.abs(Number(transaction.amountIn) - Number(transaction.expectedAmount)) < 0.01
                              ? 'Số tiền khớp'
                              : `Đối chiếu: ${formatMoney(transaction.expectedAmount)}`}
                          </small>
                        )}
                      </button>
                    ) : (
                      <span className="sepay-unmatched">Chưa khớp đơn</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="orders-filters">
            {STATUS_FILTERS.map(item => (
          <button
            key={item.value}
            type="button"
            className={`filter-btn${status === item.value ? ' active' : ''}`}
            onClick={() => {
              setStatus(item.value);
              setPage(1);
            }}
          >
            {item.label}
          </button>
            ))}
          </div>

          {transactions.length === 0 ? (
            <div className="no-orders">Chưa có giao dịch nội bộ nào</div>
          ) : (
            <div className="orders-table payments-table">
          <div className="table-header payments-header">
            <span>Mã giao dịch</span>
            <span>Đơn hàng</span>
            <span>Số tài khoản VA</span>
            <span>Số tiền</span>
            <span>Trạng thái</span>
            <span>Thời gian</span>
            <span>Thao tác</span>
          </div>

          {transactions.map(transaction => (
            <div key={transaction.id} className="table-row payments-row">
              <span className="col-id">#{transaction.id}</span>
              <span>#{transaction.orderId}</span>
              <span className="mono-cell">{transaction.vaNumber || 'Chưa tạo'}</span>
              <span className="col-total">{formatMoney(transaction.amount)}</span>
              <span>
                <span className={`status-pill ${statusClass(transaction.status)}`}>
                  {STATUS_LABELS[transaction.status] || transaction.status}
                </span>
              </span>
              <span>
                <div>{formatDate(transaction.paidAt || transaction.updatedAt)}</div>
                <div className="muted-line">{transaction.paymentProvider || 'SePay'}</div>
              </span>
              <span className="payment-actions">
                <button className="btn-view" onClick={() => navigate(`/orders/${transaction.orderId}`)}>
                  Chi tiết
                </button>
                {transaction.status === 'Pending' && (
                  <button
                    className="btn-confirm-payment"
                    onClick={() => confirmPayment(transaction)}
                    disabled={confirmingId === transaction.id}
                  >
                    {confirmingId === transaction.id ? 'Đang xác nhận...' : 'Xác nhận thanh toán'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

          <div className="admin-pagination">
        <button type="button" className="filter-btn" disabled={page <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>
          Trước
        </button>
        <span>Trang {page}/{totalPages}</span>
        <button type="button" className="filter-btn" disabled={page >= totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>
          Sau
        </button>
      </div>
        </>
      )}
    </div>
  );
}
