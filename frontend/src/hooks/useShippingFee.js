import { useState, useEffect, useCallback } from 'react';
import { shippingAPI } from '../api/shipping';

/**
 * useShippingFee
 * @param {object} address  { toDistrictId, toWardCode }
 * @param {object} parcel   { weight, length, width, height, insuranceValue }
 * @returns { fee, loading, error }
 *
 * Ví dụ dùng:
 *   const { fee, loading } = useShippingFee(
 *     { toDistrictId: 1442, toWardCode: '20314' },
 *     { weight: 500, length: 20, width: 15, height: 10, insuranceValue: 250000 }
 *   );
 */
export function useShippingFee(address, parcel) {
  const [fee, setFee]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const calculate = useCallback(async () => {
    if (!address?.toDistrictId || !address?.toWardCode) return;

    setLoading(true);
    setError(null);
    try {
      const result = await shippingAPI.calculateFee({
        toDistrictId:   address.toDistrictId,
        toWardCode:     address.toWardCode,
        weight:         parcel?.weight         ?? 500,
        length:         parcel?.length         ?? 20,
        width:          parcel?.width          ?? 15,
        height:         parcel?.height         ?? 10,
        insuranceValue: parcel?.insuranceValue ?? 0,
      });
      setFee(result.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address?.toDistrictId, address?.toWardCode, parcel?.weight, parcel?.insuranceValue]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  return { fee, loading, error, refetch: calculate };
}
