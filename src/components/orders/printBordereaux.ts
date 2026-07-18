import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OrderWithItems } from '@/hooks/useOrders';
import { generateBordereauHtml } from './generateBordereauHtml';

/**
 * Fetch the original PDF label for a single order from its carrier API.
 * Returns a Blob URL to the PDF, or null on failure.
 */
async function fetchCarrierLabel(orderId: string, carrier: 'RJ360' | 'ZR Express'): Promise<string | null> {
  const fnName = carrier === 'RJ360' ? 'ecotrack-label' : 'zr-express-label';
  try {
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: { order_id: orderId },
    });
    console.log(`${carrier} label response:`, { data, error });
    if (error) throw error;
    if (data?.success && data?.label_type === 'pdf' && data?.label_data) {
      const byteCharacters = atob(data.label_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    }
    if (data?.success && data?.label_type === 'url' && data?.label_url) {
      return data.label_url;
    }
    if (data && typeof data === 'object' && !data.success) {
      console.error(`${carrier} label unexpected response:`, data);
    }
    return null;
  } catch (err) {
    console.error(`${carrier} label error:`, err);
    return null;
  }
}

// Only RJ360 supports API label download; ZR Express does not have a label endpoint
const PDF_CARRIERS = ['RJ360'] as const;

/**
 * Print bordereaux for a list of orders.
 * - RJ360 orders with tracking: fetch original PDF from API
 * - Others (including ZR Express): generate local HTML label
 */
export async function printBordereaux(orders: OrderWithItems[]): Promise<void> {
  const carrierOrders = orders.filter(o => PDF_CARRIERS.includes(o.delivery_company as any) && !!o.tracking_number);
  const localOrders = orders.filter(o => !PDF_CARRIERS.includes(o.delivery_company as any) || !o.tracking_number);

  // Print local labels in one window
  if (localOrders.length > 0) {
    const labels = localOrders.map(o => generateBordereauHtml(o)).join('\n');
    const htmlContent = `<html>
<head>
  <meta charset="UTF-8">
  <title>Bordereaux (${localOrders.length})</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 0; color: #000; background: #fff; }
    @media print { body { padding: 0; } @page { size: 105mm 148mm; margin: 0; } }
    .label { border: 2px solid #000; width: 105mm; font-family: Arial, sans-serif; color: #000; background: #fff; }
    .row { display: flex; border-bottom: 2px solid #000; }
    .row:last-child { border-bottom: none; }
    .cell { padding: 3mm; }
    .border-r { border-right: 2px solid #000; }
    .bold { font-weight: bold; }
  </style>
</head>
<body>${labels}</body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) w.onload = () => setTimeout(() => w.print(), 1000);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Fetch & open carrier PDFs
  if (carrierOrders.length > 0) {
    const toastId = toast.loading(`Téléchargement des bordereaux (${carrierOrders.length})...`);
    let success = 0;
    let failed = 0;

    for (const order of carrierOrders) {
      const carrier = order.delivery_company as 'RJ360' | 'ZR Express';
      const pdfUrl = await fetchCarrierLabel(order.id, carrier);
      if (pdfUrl) {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `bordereau-${order.tracking_number || order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (pdfUrl.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
        success++;
      } else {
        failed++;
        toast.error(`Erreur téléchargement bordereau ${carrier} pour ${order.order_number}`);
      }
    }

    if (failed === 0) {
      toast.success(`${success} bordereau(x) téléchargé(s)`, { id: toastId });
    } else {
      toast.warning(`${success} téléchargé(s), ${failed} en erreur`, { id: toastId });
    }
  }
}
