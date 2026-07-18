import { useMemo } from 'react';
import { useDeliveryFees } from './useDeliveryFees';
import { useDeliveryCompanyFees } from './useDeliveryCompanyFees';
import { useActiveDeliveryPromotions, calculateDiscountedFee } from './useDeliveryPromotions';

interface Product {
  id: string;
  free_delivery?: boolean;
  custom_home_delivery_fee?: number | null;
  custom_stop_desk_fee?: number | null;
}

interface CalculateDeliveryFeeParams {
  wilayaCode: string | null;
  deliveryType: 'home' | 'stop_desk';
  deliveryCompany: string | null;
  products?: Product[];
}

export function useCalculateDeliveryFee({
  wilayaCode,
  deliveryType,
  deliveryCompany,
  products = [],
}: CalculateDeliveryFeeParams) {
  const { data: generalFees } = useDeliveryFees();
  const { data: companyFees } = useDeliveryCompanyFees(deliveryCompany || '');
  const { data: activePromotions } = useActiveDeliveryPromotions();

  const result = useMemo(() => {
    // Check for free delivery products
    const hasFreeDelivery = products.some(p => p.free_delivery);
    if (hasFreeDelivery) {
      return {
        baseFee: 0,
        finalFee: 0,
        hasFreeDelivery: true,
        hasCustomProductFee: false,
        hasCompanyFee: false,
        hasPromotion: false,
        source: 'free_delivery' as const,
      };
    }

    // Check for product-specific custom fees (use the first product with custom fee)
    const productWithCustomFee = products.find(p => {
      const fee = deliveryType === 'home' ? p.custom_home_delivery_fee : p.custom_stop_desk_fee;
      return fee !== null && fee !== undefined;
    });

    if (productWithCustomFee) {
      const customFee = deliveryType === 'home' 
        ? productWithCustomFee.custom_home_delivery_fee! 
        : productWithCustomFee.custom_stop_desk_fee!;
      
      // Apply promotions to custom fee
      const activePromotion = activePromotions?.[0] || null;
      const finalFee = activePromotion 
        ? calculateDiscountedFee(customFee, activePromotion, deliveryType)
        : customFee;

      return {
        baseFee: customFee,
        finalFee,
        hasFreeDelivery: false,
        hasCustomProductFee: true,
        hasCompanyFee: false,
        hasPromotion: !!activePromotion,
        source: 'product' as const,
      };
    }

    if (!wilayaCode) {
      return {
        baseFee: 0,
        finalFee: 0,
        hasFreeDelivery: false,
        hasCustomProductFee: false,
        hasCompanyFee: false,
        hasPromotion: false,
        source: 'none' as const,
      };
    }

    // Extract code from "16 - Alger" format if needed
    const code = wilayaCode.includes(' - ') 
      ? wilayaCode.split(' - ')[0].trim() 
      : wilayaCode;

    let baseFee = 0;
    let source: 'company' | 'general' | 'none' = 'none';

    // Priority 1: Company-specific fee
    if (deliveryCompany && companyFees && companyFees.length > 0) {
      const companyFee = companyFees.find(f => f.wilaya_code === code);
      if (companyFee) {
        baseFee = deliveryType === 'home' 
          ? companyFee.home_delivery_fee 
          : companyFee.stop_desk_fee;
        source = 'company';
      }
    }

    // Priority 2: General fee (fallback if no company fee or company fee is 0)
    if (source === 'none' || baseFee === 0) {
      if (generalFees) {
        const generalFee = generalFees.find(f => f.wilaya_code === code);
        if (generalFee) {
          baseFee = deliveryType === 'home' 
            ? generalFee.home_delivery_fee 
            : generalFee.stop_desk_fee;
          source = 'general';
        }
      }
    }

    // Apply promotions
    const activePromotion = activePromotions?.[0] || null;
    const finalFee = activePromotion 
      ? calculateDiscountedFee(baseFee, activePromotion, deliveryType)
      : baseFee;

    return {
      baseFee,
      finalFee,
      hasFreeDelivery: false,
      hasCustomProductFee: false,
      hasCompanyFee: source === 'company',
      hasPromotion: !!activePromotion,
      source,
    };
  }, [wilayaCode, deliveryType, deliveryCompany, products, generalFees, companyFees, activePromotions]);

  return result;
}

// Simple function for synchronous calculation (when you already have the data)
export function calculateDeliveryFee(params: {
  wilayaCode: string | null;
  deliveryType: 'home' | 'stop_desk';
  deliveryCompany: string | null;
  companyFees: Array<{ wilaya_code: string; home_delivery_fee: number; stop_desk_fee: number }> | null;
  generalFees: Array<{ wilaya_code: string; home_delivery_fee: number; stop_desk_fee: number }> | null;
  products?: Array<{ free_delivery?: boolean; custom_home_delivery_fee?: number | null; custom_stop_desk_fee?: number | null }>;
}): number {
  const { wilayaCode, deliveryType, deliveryCompany, companyFees, generalFees, products = [] } = params;

  // Check for free delivery
  if (products.some(p => p.free_delivery)) {
    return 0;
  }

  // Check for custom product fee
  const productWithCustomFee = products.find(p => {
    const fee = deliveryType === 'home' ? p.custom_home_delivery_fee : p.custom_stop_desk_fee;
    return fee !== null && fee !== undefined;
  });

  if (productWithCustomFee) {
    return deliveryType === 'home' 
      ? productWithCustomFee.custom_home_delivery_fee! 
      : productWithCustomFee.custom_stop_desk_fee!;
  }

  if (!wilayaCode) return 0;

  const code = wilayaCode.includes(' - ') 
    ? wilayaCode.split(' - ')[0].trim() 
    : wilayaCode;

  // Priority 1: Company fee
  if (deliveryCompany && companyFees) {
    const companyFee = companyFees.find(f => f.wilaya_code === code);
    if (companyFee) {
      const fee = deliveryType === 'home' 
        ? companyFee.home_delivery_fee 
        : companyFee.stop_desk_fee;
      if (fee > 0) return fee;
    }
  }

  // Priority 2: General fee
  if (generalFees) {
    const generalFee = generalFees.find(f => f.wilaya_code === code);
    if (generalFee) {
      return deliveryType === 'home' 
        ? generalFee.home_delivery_fee 
        : generalFee.stop_desk_fee;
    }
  }

  return 0;
}
