import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { ordersAPI, productsAPI } from '../../api/app';
import { Icons } from '../../components/icons';
import '../../styles/AdminDashboard.css';

const RevenueIcon = Icons.cash;
const OrdersIcon = Icons.orders;
const DeliveredIcon = Icons.circleCheck;
const ProductsIcon = Icons.product;
const CategoryIcon = Icons.category;
const UsersIcon = Icons.users;
const PromotionIcon = Icons.promotion;
const SettingsIcon = Icons.settings;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const fmtM = (n) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + ' tr';
  return fmt(n);
};

const pctChange = (curr, prev) => {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
};

const STATUS_LABELS = {
  PendingPayment: 'admin.status.pendingPayment.short',
  Pending:        'admin.status.pending',
  Processing:     'admin.status.processing',
  Paid:           'admin.status.paid.short',
  Shipped:        'admin.status.shipped',
  Delivered:      'admin.status.delivered',
  Cancelled:      'admin.status.cancelled',
};

const STATUS_COLORS = {
  PendingPayment: '#f59e0b',
  Pending:        '#94a3b8',
  Processing:     '#3b82f6',
  Paid:           '#8b5cf6',
  Shipped:        '#06b6d4',
  Delivered:      '#22c55e',
  Cancelled:      '#ef4444',
};

const MONTH_NAMES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

// ── Mini bar chart (SVG, no lib needed) ──────────────────────────────────────
function MiniBarChart({ data, color = '#a7484e', label = '' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 320, H = 80, barW = Math.floor(W / data.length) - 3;

  return (
    <div className="mini-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.value / max) * (H - 16)));
          const x = i * (W / data.length) + 1;
          const y = H - h - 2;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} fill={color} rx={2} opacity={0.85} />
              <text x={x + barW / 2} y={H} textAnchor="middle" fontSize="9" fill="#9a9a9a">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {label && <div className="mini-chart-label">{label}</div>}
    </div>
  );
}

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────
function DonutChart({ segments, size = 140, emptyLabel, orderLabel }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return <div className="donut-empty">{emptyLabel}</div>;

  const r = 52, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const arcs = segments
    .filter(s => s.value > 0)
    .map(seg => {
      const pct = seg.value / total;
      const dash = pct * circumference;
      const arc = { ...seg, pct, dash, offset };
      offset += dash;
      return arc;
    });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={20} />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={20}
          strokeDasharray={`${arc.dash} ${circumference}`}
          strokeDashoffset={-arc.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#0d0d0d">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#9a9a9a">
        {orderLabel}
      </text>
    </svg>
  );
}

// ── Trend arrow ───────────────────────────────────────────────────────────────
function Trend({ pct, comparisonLabel }) {
  if (pct === 0) return <span className="trend neutral">— 0%</span>;
  const up = pct > 0;
  return (
    <span className={`trend ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
      <span className="trend-label"> {comparisonLabel}</span>
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdminUser } = useAuth();
  const { addNotification } = useNotification();
  const { t, locale } = usePreferences();
  const dateLocale = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' }[locale];
  const addNotificationRef = useRef(addNotification);
  useEffect(() => { addNotificationRef.current = addNotification; }, [addNotification]);

  const [orders,   setOrders]   = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        ordersAPI.getAllOrders(),
        productsAPI.getProducts(),
      ]);
      // Normalize: API có thể trả về array trực tiếp hoặc { data: [...] } hoặc { items: [...] }
      const toArray = (res) => {
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.data))  return res.data;
        if (res && Array.isArray(res.items)) return res.items;
        return [];
      };
      setOrders(toArray(ordersRes));
      setProducts(toArray(productsRes));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      addNotificationRef.current('Lỗi khi tải dữ liệu dashboard', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminUser) { navigate('/'); return; }
    fetchAll();
  }, [fetchAll, isAdminUser, navigate]);

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now   = new Date();
    const thisM = now.getMonth();
    const thisY = now.getFullYear();
    const prevM = thisM === 0 ? 11 : thisM - 1;
    const prevY = thisM === 0 ? thisY - 1 : thisY;

    const isThisMonth = (o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === thisM && d.getFullYear() === thisY;
    };
    const isPrevMonth = (o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === prevM && d.getFullYear() === prevY;
    };

    // Only count revenue from non-cancelled, non-pendingPayment orders
    const countableStatuses = ['Pending','Processing','Paid','Shipped','Delivered'];
    const countable = orders.filter(o => countableStatuses.includes(o.status));

    const revThis  = countable.filter(isThisMonth).reduce((s, o) => s + (o.totalAmount || 0), 0);
    const revPrev  = countable.filter(isPrevMonth).reduce((s, o) => s + (o.totalAmount || 0), 0);
    const ordThis  = orders.filter(isThisMonth).length;
    const ordPrev  = orders.filter(isPrevMonth).length;

    // Status breakdown (all time)
    const byStatus = {};
    orders.forEach(o => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    // Revenue by month (last 6 months)
    const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(thisY, thisM - (5 - i), 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const val = countable
        .filter(o => { const od = new Date(o.createdAt); return od.getMonth() === m && od.getFullYear() === y; })
        .reduce((s, o) => s + (o.totalAmount || 0), 0);
      return { label: MONTH_NAMES[m], value: val };
    });

    // Orders by month (last 6 months)
    const ordersByMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(thisY, thisM - (5 - i), 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const val = orders.filter(o => {
        const od = new Date(o.createdAt); return od.getMonth() === m && od.getFullYear() === y;
      }).length;
      return { label: MONTH_NAMES[m], value: val };
    });

    // Recent orders (last 8)
    const recent = [...orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    // Top products (by qty sold from delivered orders)
    const soldMap = {};
    orders
      .filter(o => o.status === 'Delivered')
      .forEach(o => o.items?.forEach(item => {
        const key = item.productName || 'Unknown';
        soldMap[key] = (soldMap[key] || 0) + item.quantity;
      }));
    const topProducts = Object.entries(soldMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalOrders:     orders.length,
      totalRevenue:    countable.reduce((s, o) => s + (o.totalAmount || 0), 0),
      totalProducts:   products.length,
      deliveredOrders: byStatus['Delivered'] || 0,
      cancelledOrders: byStatus['Cancelled'] || 0,
      pendingOrders:   (byStatus['Pending'] || 0) + (byStatus['PendingPayment'] || 0) + (byStatus['Processing'] || 0),
      revThis, revPrev,
      ordThis, ordPrev,
      revPct:  pctChange(revThis, revPrev),
      ordPct:  pctChange(ordThis, ordPrev),
      byStatus,
      revenueByMonth,
      ordersByMonth,
      recent,
      topProducts,
    };
  }, [orders, products]);

  // ── Donut segments ──────────────────────────────────────────────────────────
  const donutSegments = useMemo(() =>
    Object.entries(stats.byStatus)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: STATUS_LABELS[k] ? t(STATUS_LABELS[k]) : k, value: v, color: STATUS_COLORS[k] || '#94a3b8' })),
    [stats.byStatus, t]
  );


  // ── Render ──────────────────────────────────────────────────────────────────
  return (
      <div className="db-page">

        {/* ── Header ── */}
        <div className="db-header">
          <div>
            <h1 className="db-title">{t('admin.dashboard.overview')}</h1>
            <p className="db-subtitle">
              {new Date().toLocaleDateString(dateLocale, { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          <button
            className={`db-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            title={t('admin.dashboard.refresh')}
          >
            ↻ {refreshing ? t('admin.dashboard.loading') : t('admin.dashboard.refresh')}
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div className="db-kpi-grid">

          <div className="db-kpi-card accent">
            <div className="kpi-top">
              <RevenueIcon className="kpi-icon" size={21} />
              <span className="kpi-label">{t('admin.dashboard.monthRevenue')}</span>
            </div>
            <div className="kpi-value">{fmtM(stats.revThis)} đ</div>
            <div className="kpi-sub">
              {t('admin.dashboard.total')} <strong>{fmtM(stats.totalRevenue)} đ</strong>
            </div>
            <Trend pct={stats.revPct} comparisonLabel={t('admin.dashboard.vsLastMonth')} />
          </div>

          <div className="db-kpi-card">
            <div className="kpi-top">
              <OrdersIcon className="kpi-icon" size={21} />
              <span className="kpi-label">{t('admin.dashboard.monthOrders')}</span>
            </div>
            <div className="kpi-value">{stats.ordThis}</div>
            <div className="kpi-sub">
              {t('admin.dashboard.total')} <strong>{stats.totalOrders}</strong> {t('admin.dashboard.ordersUnit')}
            </div>
            <Trend pct={stats.ordPct} comparisonLabel={t('admin.dashboard.vsLastMonth')} />
          </div>

          <div className="db-kpi-card">
            <div className="kpi-top">
              <DeliveredIcon className="kpi-icon" size={21} />
              <span className="kpi-label">{t('admin.dashboard.delivered')}</span>
            </div>
            <div className="kpi-value">{stats.deliveredOrders}</div>
            <div className="kpi-sub">
              {t('admin.dashboard.deliveryRate')} <strong>
                {stats.totalOrders ? Math.round((stats.deliveredOrders / stats.totalOrders) * 100) : 0}%
              </strong>
            </div>
          </div>

          <div className="db-kpi-card">
            <div className="kpi-top">
              <ProductsIcon className="kpi-icon" size={21} />
              <span className="kpi-label">{t('admin.dashboard.products')}</span>
            </div>
            <div className="kpi-value">{stats.totalProducts}</div>
            <div className="kpi-sub">
              {t('admin.dashboard.pending')} <strong>{stats.pendingOrders}</strong> {t('admin.dashboard.ordersUnit')}
            </div>
          </div>

        </div>

        {/* ── Charts row ── */}
        <div className="db-charts-row">

          {/* Revenue bar chart */}
          <div className="db-card">
            <div className="db-card-header">
              <h3>{t('admin.dashboard.revenueChart')}</h3>
              <span className="db-card-badge">
                {MONTH_NAMES[new Date().getMonth()]}
              </span>
            </div>
            <MiniBarChart data={stats.revenueByMonth} color="#a7484e" />
            <div className="chart-axis-label">{t('admin.dashboard.currencyUnit')}</div>
          </div>

          {/* Orders bar chart */}
          <div className="db-card">
            <div className="db-card-header">
              <h3>{t('admin.dashboard.ordersChart')}</h3>
            </div>
            <MiniBarChart data={stats.ordersByMonth} color="#0d0d0d" />
            <div className="chart-axis-label">{t('admin.dashboard.orderCount')}</div>
          </div>

          {/* Donut status breakdown */}
          <div className="db-card donut-card">
            <div className="db-card-header">
              <h3>{t('admin.dashboard.orderStatus')}</h3>
            </div>
            <div className="donut-wrapper">
              <DonutChart segments={donutSegments} size={140} emptyLabel={t('admin.dashboard.noData')} orderLabel={t('admin.dashboard.orders')} />
              <div className="donut-legend">
                {donutSegments.map((seg, i) => (
                  <div key={i} className="legend-item">
                    <span className="legend-dot" style={{ background: seg.color }} />
                    <span className="legend-label">{seg.label}</span>
                    <span className="legend-val">{seg.value}</span>
                    <span className="legend-pct">
                      {Math.round((seg.value / stats.totalOrders) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── Bottom row ── */}
        <div className="db-bottom-row">

          {/* Recent orders */}
          <div className="db-card db-card-wide">
            <div className="db-card-header">
              <h3>{t('admin.dashboard.recentOrders')}</h3>
              <button className="db-link-btn" onClick={() => navigate('/admin/orders')}>
                {t('admin.dashboard.seeAll')}
              </button>
            </div>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('admin.dashboard.customer')}</th>
                    <th>{t('admin.dashboard.amount')}</th>
                    <th>{t('admin.dashboard.method')}</th>
                    <th>{t('admin.dashboard.status')}</th>
                    <th>{t('admin.dashboard.orderDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.length === 0 ? (
                    <tr><td colSpan={6} className="db-table-empty">{t('admin.dashboard.noOrders')}</td></tr>
                  ) : stats.recent.map(o => (
                    <tr
                      key={o.id}
                      className="db-table-row"
                      onClick={() => navigate(`/admin/orders`)}
                    >
                      <td className="order-num">#{o.id}</td>
                      <td>{o.customerName || o.customerEmail || '—'}</td>
                      <td className="order-amount">{fmt(o.totalAmount)} đ</td>
                      <td>
                        <span className="method-badge">
                          {o.paymentMethod === 'cod' ? 'COD' : o.paymentMethod?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          className="db-status-badge"
                          style={{ background: STATUS_COLORS[o.status] + '22', color: STATUS_COLORS[o.status] }}
                        >
                          {STATUS_LABELS[o.status] ? t(STATUS_LABELS[o.status]) : o.status}
                        </span>
                      </td>
                      <td className="order-date">
                        {new Date(o.createdAt).toLocaleDateString(dateLocale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top products + Quick nav */}
          <div className="db-side-col">

            {/* Top products */}
            <div className="db-card">
              <div className="db-card-header">
                <h3>{t('admin.dashboard.bestSelling')}</h3>
                <span className="db-card-badge">{t('admin.status.delivered')}</span>
              </div>
              {stats.topProducts.length === 0 ? (
                <p className="db-empty-note">{t('admin.dashboard.noData')}</p>
              ) : (
                <div className="top-products-list">
                  {stats.topProducts.map(([name, qty], i) => (
                    <div key={i} className="top-product-item">
                      <span className="top-rank">{i + 1}</span>
                      <span className="top-name">{name}</span>
                      <span className="top-qty">{qty} {t('admin.dashboard.sold')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick nav */}
            <div className="db-card">
              <div className="db-card-header"><h3>{t('admin.dashboard.quickManage')}</h3></div>
              <div className="db-quick-nav">
                {[
                  { Icon: ProductsIcon, key:'admin.dashboard.quick.products', path:'/admin/products' },
                  { Icon: CategoryIcon, key:'admin.dashboard.quick.categories', path:'/admin/categories' },
                  { Icon: OrdersIcon, key:'admin.dashboard.quick.orders', path:'/admin/orders' },
                  { Icon: UsersIcon, key:'admin.dashboard.quick.users', path:'/admin/users' },
                  { Icon: PromotionIcon, key:'admin.promotions', path:'/admin/promotions' },
                  { Icon: SettingsIcon, key:'admin.dashboard.quick.settings', path:'/admin/settings' },
                ].map(item => (
                  <button
                    key={item.path}
                    className="quick-nav-btn"
                    onClick={() => navigate(item.path)}
                  >
                    <item.Icon className="qnav-icon" size={19} />
                    <span className="qnav-label">{t(item.key)}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
  );
}
