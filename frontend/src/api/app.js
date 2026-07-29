const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5110/api';

const TOKEN_KEY = 'thebob-token';
const USER_KEY  = 'thebob-current-user';
const REFRESH_TOKEN_KEY = 'thebob-refresh-token';

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
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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

// ─── Token Refresh logic ──────────────────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (newToken) => {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
};

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const tryRefreshToken = async () => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const token = localStorage.getItem(TOKEN_KEY);
  if (!refreshToken) return null;

  const response = await fetch(buildUrl('/auth/refresh-token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token: token || '', refreshToken }),
  });

  if (!response.ok) return null;

  const payload = await response.json();
  const data = payload?.data;
  if (!data?.token) return null;

  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.token;
};

// ─── Core client ─────────────────────────────────────────────────────────────

const apiClient = async (path, options = {}) => {
  const { auth = false, headers = {}, body, _isRetry = false, ...rest } = options;

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

  // ── Auto Refresh Token khi JWT hết hạn (401) ──────────────────────────────
  if (response.status === 401 && auth && !_isRetry) {
    if (isRefreshing) {
      // Đợi token mới từ luồng refresh đang chạy
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(async (newToken) => {
          try {
            resolve(await apiClient(path, { ...options, _isRetry: true }));
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    isRefreshing = true;
    const newToken = await tryRefreshToken();
    isRefreshing = false;

    if (newToken) {
      onRefreshed(newToken);
      return apiClient(path, { ...options, _isRetry: true });
    } else {
      redirectToLogin();
      throw new ApiError('Phiên đăng nhập đã hết hạn', 401, payload);
    }
  }

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
  refreshToken: (token, refreshToken) => apiClient('/auth/refresh-token', {
    method: 'POST',
    body: { token, refreshToken },
  }),
  logout: (refreshToken) => apiClient('/auth/logout', {
    method: 'POST',
    auth: true,
    body: { token: localStorage.getItem(TOKEN_KEY) || '', refreshToken: refreshToken || '' },
  }),
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
  updateColor: (id, payload) => apiClient(`/products/colors/${id}`, { method: 'PUT', auth: true, body: payload }),
  deleteColor: (id) => apiClient(`/products/colors/${id}`, { method: 'DELETE', auth: true }),
  updateSize: (id, payload) => apiClient(`/products/sizes/${id}`, { method: 'PUT', auth: true, body: payload }),
  deleteSize: (id) => apiClient(`/products/sizes/${id}`, { method: 'DELETE', auth: true }),
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
  confirmOrderManual: (id) => apiClient(`/admin/orders/${id}/confirm`, { method: 'PATCH', auth: true }),
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

// ─── Categories & Brands (standalone exports) ─────────────────────────────────

export const categoriesAPI = {
  getAll: () => apiClient('/products/categories'),
};

export const brandsAPI = {
  getAll: () => apiClient('/products/brands'),
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

// ─── Recommendation & Tracking ────────────────────────────────────────────────

export const recommendationAPI = {
  getRelated: (productId, limit = 5) => apiClient(`/recommendations/related?productId=${productId}&limit=${limit}`),
  getFrequentlyBought: (productIds, limit = 3) => apiClient(`/recommendations/frequently-bought?productIds=${productIds}&limit=${limit}`),
  getPersonalized: (limit = 10) => apiClient(`/recommendations/personalized?limit=${limit}`, { auth: true }),
  getTrending: (limit = 8) => apiClient(`/recommendations/trending?limit=${limit}`),
  trackView: (productId, sessionId, durationSeconds = 0) => apiClient('/tracking/view', { method: 'POST', body: { productId, sessionId, durationSeconds } }),
  trackSearch: (query, sessionId) => apiClient('/tracking/search', { method: 'POST', body: { query, sessionId } }),
  trackCart: (productId, action, quantity, sessionId) => apiClient('/tracking/cart', { method: 'POST', body: { productId, action, quantity, sessionId } }),
};

// ─── SignalR hub URL ──────────────────────────────────────────────────────────

export const ORDER_HUB_URL =
  API_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/order';

export const CHAT_HUB_URL =
  API_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/chat';

// ─── Notifications API ────────────────────────────────────────────────────────

export const notificationsAPI = {
  getAll: () => apiClient('/notifications', { auth: true }),
  markAsRead: (id) => apiClient(`/notifications/${id}/read`, { method: 'PUT', auth: true }),
  markAllAsRead: () => apiClient('/notifications/read-all', { method: 'PUT', auth: true }),
};

// ─── FAQ API ─────────────────────────────────────────────────────────────────

export const faqAPI = {
  getAll: () => apiClient('/faq', { auth: true }),
  create: (data) => apiClient('/faq', { method: 'POST', auth: true, body: data }),
  update: (id, data) => apiClient(`/faq/${id}`, { method: 'PUT', auth: true, body: data }),
  delete: (id) => apiClient(`/faq/${id}`, { method: 'DELETE', auth: true }),
};

// ─── Chat API ─────────────────────────────────────────────────────────────────

export const chatAPI = {
  getAdminStatus: () => apiClient('/chat/admin-status'),
  getConversations: () => apiClient('/chat/conversations', { auth: true }),
  getMessages: (conversationId, page = 1, pageSize = 50) =>
    apiClient(`/chat/messages/${conversationId}?page=${page}&pageSize=${pageSize}`, { auth: true }),
  sendMessage: (content, conversationId, productId) =>
    apiClient('/chat/send', {
      method: 'POST',
      auth: true,
      body: { content, conversationId: conversationId ?? undefined, productId: productId ?? undefined },
    }),
  searchProduct: (q) => apiClient(`/chat/search-product?q=${encodeURIComponent(q)}`, { auth: true }),
  sendBlogPost: (conversationId, blogPostId) =>
    apiClient('/chat/send-blog-post', {
      method: 'POST',
      auth: true,
      body: { conversationId, blogPostId },
    }),
};

// ─── Blog API ─────────────────────────────────────────────────────────────────

export const blogAPI = {
  // Public
  getPublished: (page = 1, pageSize = 12, categoryId, search) => {
    const params = new URLSearchParams({ page, pageSize });
    if (categoryId) params.append('categoryId', categoryId);
    if (search) params.append('search', search);
    return apiClient(`/blog?${params}`);
  },
  getFeatured: () => apiClient('/blog/featured'),
  getBySlug: (slug) => apiClient(`/blog/${encodeURIComponent(slug)}`),
  getCategories: () => apiClient('/blog/categories'),
  trackClick: (id, source = 'Direct', productId = null, sessionId = null) =>
    apiClient(`/blog/${id}/click`, {
      method: 'POST',
      body: { source, productId, sessionId },
    }),

  // Admin
  adminGetAll: (page = 1, pageSize = 20, status, categoryId, search) => {
    const params = new URLSearchParams({ page, pageSize });
    if (status) params.append('status', status);
    if (categoryId) params.append('categoryId', categoryId);
    if (search) params.append('search', search);
    return apiClient(`/blog/admin/all?${params}`, { auth: true });
  },
  adminGetById: (id) => apiClient(`/blog/admin/${id}`, { auth: true }),
  create: (data) => apiClient('/blog', { method: 'POST', auth: true, body: data }),
  update: (id, data) => apiClient(`/blog/${id}`, { method: 'PUT', auth: true, body: data }),
  delete: (id) => apiClient(`/blog/${id}`, { method: 'DELETE', auth: true }),
  createCategory: (data) => apiClient('/blog/categories', { method: 'POST', auth: true, body: data }),
  searchPublishedPosts: (q, limit = 10) =>
    apiClient(`/blog/admin/search-posts?q=${encodeURIComponent(q || '')}&limit=${limit}`, { auth: true }),
};

// ─── Blog Notifications API ───────────────────────────────────────────────────

export const blogNotificationsAPI = {
  send: (data) => apiClient('/blog-notifications/send', { method: 'POST', auth: true, body: data }),
  getMyNotifications: (page = 1, pageSize = 20) =>
    apiClient(`/blog-notifications?page=${page}&pageSize=${pageSize}`, { auth: true }),
  getUnreadCount: () => apiClient('/blog-notifications/unread-count', { auth: true }),
  markAsRead: (id) => apiClient(`/blog-notifications/${id}/read`, { method: 'PUT', auth: true }),
  markAllAsRead: () => apiClient('/blog-notifications/read-all', { method: 'PUT', auth: true }),
};

// ─── Promotions API ───────────────────────────────────────────────────────────

export const promotionsAPI = {
  // Admin
  getAll: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v))).toString();
    return apiClient(`/promotions${qs ? `?${qs}` : ''}`, { auth: true });
  },
  getById: (id) => apiClient(`/promotions/${id}`, { auth: true }),
  create: (data) => apiClient('/promotions', { method: 'POST', auth: true, body: data }),
  update: (id, data) => apiClient(`/promotions/${id}`, { method: 'PUT', auth: true, body: data }),
  updateStatus: (id, status) => apiClient(`/promotions/${id}/status`, { method: 'PUT', auth: true, body: { status } }),
  clone: (id) => apiClient(`/promotions/${id}/clone`, { method: 'POST', auth: true }),
  delete: (id) => apiClient(`/promotions/${id}`, { method: 'DELETE', auth: true }),
  getStats: (id) => apiClient(`/promotions/${id}/stats`, { auth: true }),
  getStatsSummary: () => apiClient('/promotions/stats/summary', { auth: true }),
  getUsages: (id, page = 1) => apiClient(`/promotions/${id}/usages?page=${page}`, { auth: true }),
  sendUserCoupon: (data) => apiClient('/promotions/send-user-coupon', { method: 'POST', auth: true, body: data }),
  sendBulkCoupon: (data) => apiClient('/promotions/send-bulk-coupon', { method: 'POST', auth: true, body: data }),
  getCustomerGroups: () => apiClient('/promotions/customer-groups', { auth: true }),
  createCustomerGroup: (data) => apiClient('/promotions/customer-groups', { method: 'POST', auth: true, body: data }),

  // User
  validateCoupon: (couponCode) => apiClient('/promotions/validate-coupon', { method: 'POST', auth: true, body: { couponCode } }),
  calculatePromotions: (couponCode, shippingFee, userCouponId) => apiClient('/promotions/calculate', {
    method: 'POST',
    auth: true,
    body: {
      couponCode: couponCode || undefined,
      shippingFee: typeof shippingFee === 'number' ? shippingFee : undefined,
      userCouponId: userCouponId ? Number(userCouponId) : undefined,
    },
  }),
  getMyVouchers: () => apiClient('/promotions/my-vouchers', { auth: true }),
  getApplicable: () => apiClient('/promotions/applicable', { auth: true }),
  getEligibleProducts: (id) => apiClient(`/promotions/${id}/eligible-products`),
};

// ─── Users API extended ───────────────────────────────────────────────────────

export const usersAPI = {
  findByEmail: (email) => apiClient(`/users/by-email?email=${encodeURIComponent(email)}`, { auth: true }),
  getAll: (page = 1, pageSize = 20) => apiClient(`/users?page=${page}&pageSize=${pageSize}`, { auth: true }),
};

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { ApiError, apiClient, API_BASE_URL };