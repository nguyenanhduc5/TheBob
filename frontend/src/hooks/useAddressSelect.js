import { useState, useEffect } from 'react';
import { shippingAPI } from '../api/shipping';

/**
 * useAddressSelect
 * @returns {object} provinces, districts, wards, selected, setters, loading
 *
 * Ví dụ dùng:
 *   const { provinces, districts, wards, selected, setProvince, setDistrict, setWard } =
 *     useAddressSelect();
 */
export function useAddressSelect() {
  const [provinces,  setProvinces]  = useState([]);
  const [districts,  setDistricts]  = useState([]);
  const [wards,      setWards]      = useState([]);

  const [selectedProvince, setSelectedProvinceState] = useState(null);
  const [selectedDistrict, setSelectedDistrictState] = useState(null);
  const [selectedWard,     setSelectedWardState]     = useState(null);

  const [loading, setLoading] = useState(false);

  // Load provinces once
  useEffect(() => {
    shippingAPI.getProvinces().then(setProvinces).catch(console.error);
  }, []);

  // Load districts when province changes
  const setProvince = async (province) => {
    setSelectedProvinceState(province);
    setSelectedDistrictState(null);
    setSelectedWardState(null);
    setWards([]);

    if (!province) { setDistricts([]); return; }

    setLoading(true);
    try {
      const data = await shippingAPI.getDistricts(province.provinceId);
      setDistricts(data);
    } finally {
      setLoading(false);
    }
  };

  // Load wards when district changes
  const setDistrict = async (district) => {
    setSelectedDistrictState(district);
    setSelectedWardState(null);

    if (!district) { setWards([]); return; }

    setLoading(true);
    try {
      const data = await shippingAPI.getWards(district.districtId);
      setWards(data);
    } finally {
      setLoading(false);
    }
  };

  const setWard = (ward) => setSelectedWardState(ward);

  return {
    provinces,
    districts,
    wards,
    selected: {
      province: selectedProvince,
      district: selectedDistrict,
      ward:     selectedWard,
    },
    setProvince,
    setDistrict,
    setWard,
    loading,
    // Giá trị gửi lên API
    addressPayload: selectedDistrict && selectedWard
      ? { toDistrictId: selectedDistrict.districtId, toWardCode: selectedWard.wardCode }
      : null
  };
}
