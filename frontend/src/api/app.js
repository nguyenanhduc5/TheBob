const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5110/api';

const TOKEN_KEY = 'thebob-token';
const USER_KEY = 'thebob-current-user';

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const readToken = () => localStorage.getItem(TOKEN_KEY);

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

const buildUrl = (path) => {
  if (isAbsoluteUrl(path)) return path;

  return `${API_BASE_URL}${
    path.startsWith('/') ? path : `/${path}`
  }`;
};

const redirectToLogin = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  if (!window.location.pathname.startsWith('/login')) {
    const returnUrl =
      window.location.pathname + window.location.search;

    window.location.assign(
      `/login?returnUrl=${encodeURIComponent(returnUrl)}`
    );
  }
};

const getMessageFromPayload = (payload, fallback) => {
  if (!payload) return fallback;

  if (typeof payload === 'string') return payload;

  if (payload.message) return payload.message;

  if (payload.error) return payload.error;

  if (payload.title) return payload.title;

  if (payload.errors) {
    return Object.values(payload.errors)
      .flat()
      .join(' ');
  }

  return fallback;
};

const parseResponse = async (response) => {
  if (response.status === 204) return null;

  const text = await response.text();

  if (!text) return null;

  const contentType =
    response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const apiClient = async (path, options = {}) => {
  const {
    auth = false,
    headers = {},
    body,
    ...rest
  } = options;

  const requestHeaders = {
    Accept: 'application/json',
    ...headers
  };

  let requestBody = body;

  if (
    body !== undefined &&
    !(body instanceof FormData)
  ) {
    requestHeaders['Content-Type'] =
      'application/json';

    requestBody = JSON.stringify(body);
  }

  const token = readToken();

  if (auth && token) {
    requestHeaders.Authorization =
      `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: requestHeaders,
    body: requestBody
  });

  const payload = await parseResponse(response);

  if (response.status === 401) {
    redirectToLogin();

    throw new ApiError(
      'Phiên đăng nhập đã hết hạn',
      401,
      payload
    );
  }

  if (!response.ok) {
    throw new ApiError(
      getMessageFromPayload(
        payload,
        'Không thể xử lý yêu cầu'
      ),
      response.status,
      payload
    );
  }

  return payload;
};

const safeArray = (value) =>
  Array.isArray(value) ? value : [];

export const authAPI = {
  register(data) {
    return apiClient('/auth/register', {
      method: 'POST',
      body: data
    });
  },

  login(data) {
    return apiClient('/auth/login', {
      method: 'POST',
      body: data
    });
  },

  getProfile() {
    return apiClient('/auth/profile', {
      auth: true
    });
  },

  updateProfile(data) {
    return apiClient('/auth/profile', {
      method: 'PUT',
      auth: true,
      body: data
    });
  }
};

export const productsAPI = {
  async getProducts() {
    return safeArray(
      await apiClient('/products')
    );
  },

  getProduct(id) {
    return apiClient(`/products/${id}`);
  },

  async getCategories() {
    return safeArray(
      await apiClient('/products/categories')
    );
  },

  async getBrands() {
    return safeArray(
      await apiClient('/products/brands')
    );
  },

  async getSizes() {
    return safeArray(
      await apiClient('/products/sizes')
    );
  },

  async getColors() {
    return safeArray(
      await apiClient('/products/colors')
    );
  },

  createColor(data) {
    return apiClient('/products/colors', {
      method: 'POST',
      auth: true,
      body: data
    });
  },

  createSize(data) {
    return apiClient('/products/sizes', {
      method: 'POST',
      auth: true,
      body: data
    });
  },

  createProduct(data) {
    return apiClient('/products', {
      method: 'POST',
      auth: true,
      body: data
    });
  },

  updateProduct(id, data) {
    return apiClient(`/products/${id}`, {
      method: 'PUT',
      auth: true,
      body: data
    });
  },

  deleteProduct(id) {
    return apiClient(`/products/${id}`, {
      method: 'DELETE',
      auth: true
    });
  }
};

export const ordersAPI = {
  async getAllOrders(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    return await apiClient(`/admin/orders?${query}`, {
      auth: true
    });
  },

  async getUserOrders() {
    return safeArray(
      await apiClient('/orders', {
        auth: true
      })
    );
  },

  getOrder(id) {
    return apiClient(`/orders/${id}`, {
      auth: true
    });
  },

  getOrderStatus(id) {
    return apiClient(`/orders/status/${id}`, {
      auth: true
    });
  },

  createOrder(data) {
    return apiClient('/orders', {
      method: 'POST',
      auth: true,
      body: data
    });
  },

  updateOrderStatus(id, status) {
    return apiClient(`/orders/${id}/status`, {
      method: 'PUT',
      auth: true,
      body: { status }
    });
  },

  cancelOrder(id) {
    return apiClient(`/orders/${id}/cancel`, {
      method: 'PUT',
      auth: true
    });
  },

  confirmOrder(id) {
    return apiClient(`/admin/orders/${id}/confirm`, {
      method: 'PATCH',
      auth: true
    });
  },

  cancelAdminOrder(id) {
    return apiClient(`/admin/orders/${id}/cancel`, {
      method: 'PATCH',
      auth: true
    });
  }
};

export const cartAPI = {
  getCart() {
    return apiClient('/cart', {
      auth: true
    });
  },

  clearCart() {
    return apiClient('/cart', {
      method: 'DELETE',
      auth: true
    });
  },

  addItem(variantId, quantity) {
    return apiClient('/cart/add', {
      method: 'POST',
      auth: true,
      body: { variantId, quantity }
    });
  },

  updateItem(itemId, quantity) {
    return apiClient(`/cart/items/${itemId}`, {
      method: 'PUT',
      auth: true,
      body: { quantity }
    });
  },

  removeItem(itemId) {
    return apiClient(`/cart/items/${itemId}`, {
      method: 'DELETE',
      auth: true
    });
  },

  sync(body) {
    return apiClient('/cart/sync', {
      method: 'POST',
      auth: true,
      body
    });
  },

  syncCart(items) {
    const payload = { items };
    syncCartQueue = syncCartQueue
      .then(() => this.sync(payload))
      .catch(() => this.sync(payload));
    return syncCartQueue;
  }
};

let syncCartQueue = Promise.resolve();


export const couponsAPI = {
  async getAll() {
    return safeArray(
      await apiClient('/coupons', {
        auth: true
      })
    );
  },

  getByCode(code) {
    return apiClient(
      `/coupons/code/${code}`
    );
  },

  create(data) {
    return apiClient('/coupons', {
      method: 'POST',
      auth: true,
      body: data
    });
  },

  delete(id) {
    return apiClient(`/coupons/${id}`, {
      method: 'DELETE',
      auth: true
    });
  }
};

export const paymentAPI = {
  async createPayment(orderId, amount) {
    const response = await apiClient('/payment/create', {
      method: 'POST',
      auth: true,
      body: { orderId, amount }
    });
    return response?.data || response;
  },

  createPaymentLink(orderId) {
    return paymentAPI.createPayment(orderId);
  },

  async createQrPayment(data) {
    const response = await apiClient('/payment/create-qr', {
      method: 'POST',
      auth: true,
      body: data
    });
    return response?.data || response;
  },

  async getPaymentStatus(orderId) {
    const response = await apiClient(`/payment/status/${orderId}`, {
      auth: true
    });
    return response?.data || response;
  },

  async cancelPayment(orderId) {
    const response = await apiClient(`/payment/cancel/${orderId}`, {
      method: 'POST',
      auth: true
    });
    return response?.data || response;
  },

  async confirmPayment(data) {
    const response = await apiClient('/payment/confirm', {
      method: 'POST',
      auth: true,
      body: data
    });
    return response?.data || response;
  },

  async getPaymentHistory() {
    const response = await apiClient('/payment/history', {
      auth: true
    });
    return response?.data || response;
  },

  async getTransactions({ status = 'All', page = 1, pageSize = 20 } = {}) {
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
    const response = await apiClient(`/payment/admin/transactions?${params.toString()}`, {
      auth: true
    });
    return response?.data || response;
  }
};

export const ORDER_HUB_URL =
  API_BASE_URL.replace(/\/api\/?$/, '') +
  '/hubs/order';

export {
  ApiError,
  apiClient,
  API_BASE_URL
};
