import { apiClient } from './app';

export const shippingAPI = {
  // Địa chỉ
  getProvinces() {
    return apiClient('/shipping/provinces', { auth: true });
  },

  getDistricts(provinceId) {
    return apiClient(`/shipping/districts/${provinceId}`, { auth: true });
  },

  getWards(districtId) {
    return apiClient(`/shipping/wards/${districtId}`, { auth: true });
  },

  // Tính phí ship (gọi từ checkout)
  calculateFee(data) {
    return apiClient('/shipping/fee', {
      method: 'POST',
      auth: true,
      body: data
    });
  },

  // Admin: tạo đơn vận chuyển
  createShipment(orderId, data) {
    return apiClient(`/shipping/orders/${orderId}/create-shipment`, {
      method: 'POST',
      auth: true,
      body: data
    });
  },

  // Tracking
  getTracking(ghnOrderCode) {
    return apiClient(`/shipping/tracking/${ghnOrderCode}`, { auth: true });
  },

  // Admin: hủy đơn vận chuyển
  cancelShipment(orderId, ghnOrderCode) {
    return apiClient(`/shipping/orders/${orderId}/shipment/${ghnOrderCode}`, {
      method: 'DELETE',
      auth: true
    });
  }
};
