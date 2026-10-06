// src/services/settingsService.js

const STORAGE_KEY = 'thebob-admin-settings';

const DEFAULT_SETTINGS = {
  store: {
    name: 'TheBob',
    logoUrl: '',
    address: '',
    phone: '',
    email: '',
  },
  payment: {
    bankName: '',
    accountNumber: '',
    accountName: '',
    sepayApiToken: '',
  },
  shipping: {
    baseFee: 0,
    freeShipThreshold: 0,
    regions: [],
  },
};

export async function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      store: { ...DEFAULT_SETTINGS.store, ...parsed.store },
      payment: { ...DEFAULT_SETTINGS.payment, ...parsed.payment },
      shipping: { ...DEFAULT_SETTINGS.shipping, ...parsed.shipping },
    };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export async function saveSettings(section, data) {
  try {
    const current = await getSettings();
    const updated = { ...current, [section]: data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw new Error('Không thể lưu cài đặt. Vui lòng thử lại.');
  }
}