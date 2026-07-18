import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  commune: string;
  type: string;
}

export function usePickupPoints(wilayaName: string, deliveryCompany: string, enabled: boolean) {
  return useQuery({
    queryKey: ['pickup-points', wilayaName, deliveryCompany],
    queryFn: async (): Promise<PickupPoint[]> => {
      if (!wilayaName) return [];

      // Only fetch for ZR Express for now
      if (!deliveryCompany?.toLowerCase().includes('zr')) return [];

      const { data, error } = await supabase.functions.invoke('zr-express-pickup-points', {
        body: { wilaya_name: wilayaName },
      });

      if (error) {
        console.error('Failed to fetch pickup points:', error);
        return [];
      }

      return data?.pickup_points || [];
    },
    enabled: enabled && !!wilayaName && !!deliveryCompany?.toLowerCase().includes('zr'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
