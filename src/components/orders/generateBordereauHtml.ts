import { format } from 'date-fns';
import type { OrderWithItems } from '@/hooks/useOrders';

export function generateBordereauHtml(order: OrderWithItems): string {
  const wilayaCode = order.wilaya?.match(/^(\d+)/)?.[1] || '';
  const wilayaName = order.wilaya?.replace(/^\d+\s*-\s*/, '') || '';
  const isStopDesk = order.delivery_type === 'stop_desk';
  const deliveryTypeLabel = isStopDesk ? 'SD' : 'DOM';
  const cleanAddress = order.customer_address?.replace(/^Stop Desk:\s*/, '') || '';
  const stopDeskMatch = order.customer_address?.match(/Stop Desk:\s*(.+?)(?:\s*—|$)/i);
  const stopDeskName = stopDeskMatch ? stopDeskMatch[1].trim() : '';
  const products = order.order_items || [];
  const trackingDisplay = order.tracking_number || order.order_number;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackingDisplay)}`;
  const barcodeUrl = `https://barcodeapi.org/api/128/${encodeURIComponent(trackingDisplay)}`;

  const companyName = order.delivery_company || 'Local';
  const departureBureau = 'Hub Ouled Fayet 16';
  const totalAmount = Number(order.total_price).toLocaleString('fr-DZ');

  const statusLabels = ['Livré', 'Erreur', 'Vers station', 'En station', 'Au bureau', 'En livraison', 'Échec de livr', 'Alerte', 'Retour'];
  const statusBoxesHtml = statusLabels.map(s =>
    '<div style="border:1.5px solid #000;border-radius:3px;padding:1.5mm 3mm;font-size:8px;font-weight:600;display:inline-flex;align-items:center;gap:1.5mm"><div style="width:3mm;height:3mm;border:1.5px solid #000;border-radius:1px;display:inline-block"></div> ' + s + '</div>'
  ).join(' ');

  return `<div class="label" style="page-break-after:always">

  <div class="row">
    <div class="cell border-r" style="width:30mm;display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <img src="${qrUrl}" style="width:26mm;height:26mm"/>
    </div>
    <div class="cell border-r" style="flex:1;font-size:9px;line-height:1.6">
      <div>Client: <span class="bold">${order.customer_name}</span></div>
      <div>N° Tél: <span class="bold">${order.customer_phone}</span></div>
      <div>Addresse du Client: <span class="bold">${cleanAddress}</span></div>
    </div>
    <div style="width:38mm;flex-shrink:0;display:flex;flex-direction:column">
      <div style="background:#d4a017;padding:2.5mm;text-align:center;border-bottom:1px solid #000">
        <div style="font-size:14px;font-weight:900;color:#000;font-family:Impact,Arial;letter-spacing:1px;line-height:1">
          ${companyName}
        </div>
      </div>
      <div class="cell" style="font-size:8px;line-height:1.6;flex:1">
        <div>Bureau de départ: <span class="bold">${departureBureau}</span></div>
        ${isStopDesk && stopDeskName
          ? `<div>Bureau de livraison: <span class="bold">${stopDeskName}</span></div>`
          : `<div>Livraison: <span class="bold">À domicile</span></div>`}
        <div>Type de livraison: <span class="bold">${deliveryTypeLabel}</span></div>
      </div>
    </div>
  </div>

  <div class="row" style="min-height:65mm">
    <div class="border-r" style="width:10mm;background:#e8e8e8;flex-shrink:0;position:relative">
      <div style="writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);font-weight:bold;font-size:9px;text-align:center;letter-spacing:0.5px;height:100%;display:flex;align-items:center;justify-content:center;padding:3mm 1mm">
        ${isStopDesk
          ? `SD / HUB ${(stopDeskName || wilayaName).toUpperCase()} ${wilayaCode} / STD`
          : `DOM / ${wilayaName.toUpperCase()} ${wilayaCode}`}
      </div>
    </div>
    <div class="cell border-r" style="flex:1;font-size:9px;line-height:1.7">
      <div class="bold" style="font-size:10px;margin-bottom:2mm;border-bottom:1px solid #ccc;padding-bottom:1mm">Détails de la commande</div>
      <div>Numéro de suivi:<br/><span class="bold" style="font-size:10px">${trackingDisplay}</span></div>
      <div style="margin-top:2mm">Suivi personnalisé:<br/><span class="bold" style="font-size:7px;word-break:break-all">${order.id}</span></div>
      <div style="margin-top:2mm">E-commerçant:<br/><span class="bold">${companyName}</span></div>
      <div style="margin-top:2mm">N° Tél. après-vente:<br/><span class="bold">${order.customer_phone}</span></div>
      <div style="margin-top:2mm">Date de la commande:<br/><span class="bold">${format(new Date(order.created_at), 'dd/MM/yyyy')}</span></div>
      <div style="margin-top:2mm">Description:<br/><span class="bold">${(order.remarks || '').replace(/\[\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\]/g, '').replace(/\[[^\]]*\]/g, '').replace(/LF:\S+/g, '').trim()}</span></div>
    </div>
    <div style="width:38mm;flex-shrink:0;display:flex;flex-direction:column">
      <div class="cell" style="flex:1;font-size:8px">
        <div class="bold" style="font-size:10px;margin-bottom:2mm;border-bottom:1px solid #ccc;padding-bottom:1mm">Liste des produits</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="border:1px solid #000;padding:2px 3px;text-align:left;font-size:8px;background:#f5f5f5">Produit</th>
            <th style="border:1px solid #000;padding:2px 3px;text-align:center;font-size:8px;background:#f5f5f5;width:10mm">SKU</th>
            <th style="border:1px solid #000;padding:2px 3px;text-align:center;font-size:8px;background:#f5f5f5;width:8mm">Qte</th>
          </tr></thead>
          <tbody>
            ${products.map(item => `<tr>
              <td style="border:1px solid #000;padding:2px 3px;font-size:8px">${item.product_name}${item.variant ? ` (${item.variant})` : ''}</td>
              <td style="border:1px solid #000;padding:2px 3px;text-align:center;font-size:8px">${(item as any).products?.sku || '--'}</td>
              <td style="border:1px solid #000;padding:2px 3px;text-align:center;font-size:8px">${item.quantity}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="border-top:2px solid #000;padding:4mm;text-align:right">
        <div style="font-size:13px;font-weight:bold;color:#333">Montant</div>
        <div style="font-size:26px;font-weight:bold;letter-spacing:1px">${totalAmount} DA</div>
      </div>
    </div>
  </div>

  <div class="row" style="background:#f5f5f5">
    <div class="cell border-r" style="width:30mm;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:4mm">
      <div style="border:3px solid #000;border-radius:12px;width:24mm;height:22mm;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff">
        <div style="font-size:32px;font-weight:bold;line-height:1">${wilayaCode}</div>
        <div style="font-size:8px;font-weight:bold;margin-top:1px">${wilayaName}</div>
      </div>
    </div>
    <div class="cell" style="flex:1">
      <p style="font-size:7.5px;color:#333;margin-bottom:3mm;line-height:1.4">
        L'expéditeur est seul responsable du contenu du colis. En le confiant à ${companyName}, il certifie que ce contenu respecte les conditions d'expédition.
      </p>
      <div style="text-align:center">
        <img src="${barcodeUrl}" alt="Barcode" style="height:12mm;max-width:100%"/>
        <div style="font-family:monospace;font-size:9px;font-weight:bold;letter-spacing:3px;margin-top:1mm">${trackingDisplay}</div>
      </div>
    </div>
  </div>

  <div class="row" style="background:#fff">
    <div class="cell" style="width:100%;padding:2mm 3mm">
      <div style="font-size:8px;font-weight:bold;margin-bottom:1.5mm;text-transform:uppercase;letter-spacing:0.5px">Bordereaux</div>
      <div style="display:flex;flex-wrap:wrap;gap:1.5mm">
        ${statusBoxesHtml}
      </div>
    </div>
  </div>

</div>`;
}

export function generateBulkBordereauPage(orders: OrderWithItems[]): void {
  const labels = orders.map(o => generateBordereauHtml(o)).join('\n');

  const htmlContent = `<html>
<head>
  <meta charset="UTF-8">
  <title>Bordereaux (${orders.length})</title>
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
<body>
${labels}
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => setTimeout(() => printWindow.print(), 1000);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
