const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5110/api';
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

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

const buildUrl = (path) => {
  if (isAbsoluteUrl(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const readToken = () => localStorage.getItem(TOKEN_KEY);

const redirectToLogin = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  if (!window.location.pathname.startsWith('/login')) {
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  }
};

const getMessageFromPayload = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload.message === 'string') return payload.message;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.errors && typeof payload.errors === 'object') {
    return Object.values(payload.errors).flat().filter(Boolean).join(' ') || fallback;
  }
  if (typeof payload.title === 'string') return payload.title;
  return fallback;
};

const parseResponse = async (response) => {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return text;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const apiClient = async (path, options = {}) => {
  const { auth = false, headers = {}, body, ...rest } = options;
  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

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
    throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401, payload);
  }

  if (!response.ok) {
    throw new ApiError(
      getMessageFromPayload(payload, 'Không thể xử lý yêu cầu.'),
      response.status,
      payload
    );
  }

  return payload;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

export const authAPI = {
  register(userData) {
    return apiClient('/auth/register', {
      method: 'POST',
      body: userData,
    });
  },

  login(credentials) {
    return apiClient('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  },
};

export const productsAPI = {
  async getProducts() {
    return safeArray(await apiClient('/products'));
  },

  getProduct(id) {
    return apiClient(`/products/${id}`);
  },

  async getCategories() {
    return safeArray(await apiClient('/products/categories'));
  },

  async getBrands() {
    return safeArray(await apiClient('/products/brands'));
  },

  async getSizes() {
    return safeArray(await apiClient('/products/sizes'));
  },

  async getColors() {
    return safeArray(await apiClient('/products/colors'));
  },

  createProduct(product) {
    return apiClient('/products', {
      method: 'POST',
      auth: true,
      body: product,
    });
  },

  updateProduct(id, product) {
    return apiClient(`/products/${id}`, {
      method: 'PUT',
      auth: true,
      body: product,
    });
  },

  deleteProduct(id) {
    return apiClient(`/products/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  },
};

export { ApiError };
