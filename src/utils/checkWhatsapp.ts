import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a phone number has WhatsApp using WASender API (via edge function)
 * @param phone Algerian phone number (e.g. 0661234567)
 * @returns true if the number has WhatsApp
 */
export const checkWhatsApp = async (phone: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('wasender-check-whatsapp', {
      body: { phone },
    });

    if (error) {
      console.error('WhatsApp check error:', error);
      return false;
    }

    return data?.exists === true;
  } catch (error) {
    console.error('WhatsApp check failed:', error);
    return false;
  }
};
