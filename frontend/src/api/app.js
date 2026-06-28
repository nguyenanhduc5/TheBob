const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5110/api';

const TOKEN_KEY = 'thebob-token';
const USER_KEY  = 'thebob-current-user';

// ─── OrderStatus enum — phải khớp với backend C# ─────────────────────────────
const ORDER_STATUS_MAP = {
  Pending:        0,
  Processing:     1,
  Paid:           2,
  Shipped:        3,
  Delivered:      4,
  Cancelled:      5,
  PendingPayment: 6,
};

// ─── Error ────────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.payload = payload;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const readToken = () => localStorage.getItem(TOKEN_KEY);

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

const buildUrl = (path) => {
  if (isAbsoluteUrl(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const redirectToLogin = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (!window.location.pathname.startsWith('/login')) {
    const returnUrl = window.location.pathname + window.location.search;
    window.location.assign(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  }
};

const getMessageFromPayload = (payload, fallback) => {
  if (!payload)                 return fallback;
  if (typeof payload === 'string') return payload;
  if (payload.message)          return payload.message;
  if (payload.error)            return payload.error;
  if (payload.title)            return payload.title;
  if (payload.errors)           return Object.values(payload.errors).flat().join(' ');
  return fallback;
};

const parseResponse = async (response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return text;
  try { return JSON.parse(text); } catch { return text; }
};

// ─── Core client ─────────────────────────────────────────────────────────────

const apiClient = async (path, options = {}) => {
  const { auth = false, headers = {}, body, ...rest } = options;

  const requestHeaders = { Accept: 'application/json', ...headers };
  let requestBody = body;

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const token = readToken();
  if (auth && token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: requestHeaders,
    body: requestBody,
  });

  const payload = await parseResponse(response);

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError('Phiên đăng nhập đã hết hạn', 401, payload);
  }

  if (!response.ok) {
    throw new ApiError(
      getMessageFromPayload(payload, 'Không thể xử lý yêu cầu'),
      response.status,
      payload
    );
  }

  return payload;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (data) => apiClient('/auth/register', { method: 'POST', body: data }),
  login:    (data) => apiClient('/auth/login',    { method: 'POST', body: data }),
  getProfile:      () => apiClient('/auth/profile', { auth: true }),
  updateProfile: (data) => apiClient('/auth/profile', { method: 'PUT', auth: true, body: data }),
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const productsAPI = {
  async getProducts()   { return safeArray(await apiClient('/products')); },
  getProduct: (id)      => apiClient(`/products/${id}`),
  async getCategories() { return safeArray(await apiClient('/products/categories')); },
  async getBrands()     { return safeArray(await apiClient('/products/brands')); },
  async getSizes()      { return safeArray(await apiClient('/products/sizes')); },
  async getColors()     { return safeArray(await apiClient('/products/colors')); },

  createColor:   (data)     => apiClient('/products/colors',  { method: 'POST',   auth: true, body: data }),
  createSize:    (data)     => apiClient('/products/sizes',   { method: 'POST',   auth: true, body: data }),
  createProduct: (data)     => apiClient('/products',         { method: 'POST',   auth: true, body: data }),
  updateProduct: (id, data) => apiClient(`/products/${id}`,  { method: 'PUT',    auth: true, body: data }),
  deleteProduct: (id)       => apiClient(`/products/${id}`,  { method: 'DELETE', auth: true }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersAPI = {
  async getAllOrders() {
    return safeArray(await apiClient('/orders/admin/all', { auth: true }));
  },

  async getUserOrders() {
    return safeArray(await apiClient('/orders', { auth: true }));
  },

  getOrder: (id) => apiClient(`/orders/${id}`, { auth: true }),

  getOrderStatus: (id) => apiClient(`/orders/status/${id}`, { auth: true }),

  createOrder: (data) => apiClient('/orders', { method: 'POST', auth: true, body: data }),

  /**
   * Cập nhật trạng thái đơn hàng.
   * @param {number} id - Order ID
   * @param {string} statusString - Tên trạng thái: 'Shipped' | 'Delivered' | 'Cancelled' | ...
   * Backend nhận enum number, không nhận string.
   */
  updateOrderStatus(id, statusString) {
    const statusNum = ORDER_STATUS_MAP[statusString];
    if (statusNum === undefined) {
      throw new Error(`Trạng thái không hợp lệ: ${statusString}`);
    }
    return apiClient(`/orders/${id}/status`, {
      method: 'PUT',
      auth: true,
      body: { status: statusNum },
    });
  },

  cancelOrder: (id) => apiClient(`/orders/${id}/cancel`, { method: 'PUT', auth: true }),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const cartAPI = {
  clearCart: ()            => apiClient('/cart',      { method: 'DELETE', auth: true }),
  addItem:   (variantId, quantity) => apiClient('/cart/add',  { method: 'POST', auth: true, body: { variantId, quantity } }),
  syncCart:  (items)       => apiClient('/cart/sync', { method: 'POST', auth: true, body: { items } }),
};

// ─── Coupons ──────────────────────────────────────────────────────────────────

export const couponsAPI = {
  async getAll() { return safeArray(await apiClient('/coupons', { auth: true })); },
  getByCode: (code) => apiClient(`/coupons/code/${code}`),
  create:    (data) => apiClient('/coupons',      { method: 'POST',   auth: true, body: data }),
  delete:    (id)   => apiClient(`/coupons/${id}`, { method: 'DELETE', auth: true }),
};

// ─── Payment ──────────────────────────────────────────────────────────────────

export const paymentAPI = {
  async createPayment(orderId, amount) {
    const res = await apiClient('/payment/create', { method: 'POST', auth: true, body: { orderId, amount } });
    return res?.data || res;
  },

  createPaymentLink: (orderId) => paymentAPI.createPayment(orderId),

  async createQrPayment(data) {
    const res = await apiClient('/payment/create-qr', { method: 'POST', auth: true, body: data });
    return res?.data || res;
  },

  async getPaymentStatus(orderId) {
    const res = await apiClient(`/payment/status/${orderId}`, { auth: true });
    return res?.data || res;
  },

  async cancelPayment(orderId) {
    const res = await apiClient(`/payment/cancel/${orderId}`, { method: 'POST', auth: true });
    return res?.data || res;
  },

  async confirmPayment(data) {
    const res = await apiClient('/payment/confirm', { method: 'POST', auth: true, body: data });
    return res?.data || res;
  },

  async getPaymentHistory() {
    const res = await apiClient('/payment/history', { auth: true });
    return res?.data || res;
  },

  async getTransactions({ status = 'All', page = 1, pageSize = 20 } = {}) {
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
    const res = await apiClient(`/payment/admin/transactions?${params}`, { auth: true });
    return res?.data || res;
  },
};

// ─── Shipping (GHN) ───────────────────────────────────────────────────────────

export const shippingAPI = {
  getProvinces: ()           => apiClient('/shipping/provinces', { auth: true }),
  getDistricts: (provinceId) => apiClient(`/shipping/districts/${provinceId}`, { auth: true }),
  getWards:     (districtId) => apiClient(`/shipping/wards/${districtId}`, { auth: true }),

  calculateFee: (data) => apiClient('/shipping/fee', { method: 'POST', auth: true, body: data }),

  createShipment: (orderId, data) =>
    apiClient(`/shipping/orders/${orderId}/create-shipment`, { method: 'POST', auth: true, body: data }),

  getTracking: (ghnOrderCode) =>
    apiClient(`/shipping/tracking/${ghnOrderCode}`, { auth: true }),

  cancelShipment: (orderId, ghnOrderCode) =>
    apiClient(`/shipping/orders/${orderId}/shipment/${ghnOrderCode}`, { method: 'DELETE', auth: true }),
};

// ─── SignalR hub URL ──────────────────────────────────────────────────────────

export const ORDER_HUB_URL =
  API_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/order';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { ApiError, apiClient, API_BASE_URL };