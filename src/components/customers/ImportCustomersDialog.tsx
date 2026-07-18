import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { readExcelFile, writeExcelFile } from '@/lib/excel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedCustomer {
  name: string;
  phone: string;
  wilaya: string;
  commune?: string;
  address?: string;
  total_orders?: number;
  total_spent?: number;
  notes?: string;
  status?: 'new' | 'regular' | 'vip' | 'blacklisted';
  last_order_date?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; reason: string }[];
}

export function ImportCustomersDialog({ open, onOpenChange }: ImportCustomersDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsedData, setParsedData] = useState<ParsedCustomer[]>([]);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setStep('upload');
    setParsedData([]);
    setFileName('');
    setProgress(0);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const json = await readExcelFile(buffer);

        const customers: ParsedCustomer[] = json.map((row) => {
          const name = row['Full name'] || row['name'] || row['nom'] || row['Nom'] || row['Name'] || row['client'] || row['Client'] || '';
          const phone = String(row['Phone'] || row['phone'] || row['téléphone'] || row['Téléphone'] || row['tel'] || row['Tel'] || '').trim();
          const wilaya = row['wilaya'] || row['Wilaya'] || row['ville'] || row['Ville'] || '';
          const commune = row['commune'] || row['Commune'] || '';
          const address = row['address'] || row['adresse'] || row['Adresse'] || row['Address'] || '';
          const totalOrders = Number(row['commandes'] || row['total_orders'] || row['Commandes'] || 0);
          const totalSpent = Number(row['Total depense'] || row['total_spent'] || row['total_depense'] || row['Total Dépensé'] || 0);
          const notes = row['notes'] || row['Notes'] || '';
          const statusRaw = (row['statu'] || row['status'] || row['Status'] || row['statut'] || row['Statut'] || 'new').toString().toLowerCase();
          const statusMap: Record<string, string> = { livre: 'regular', livré: 'regular', new: 'new', nouveau: 'new', regular: 'regular', vip: 'vip', blacklisted: 'blacklisted' };
          const status = (statusMap[statusRaw] || 'new') as ParsedCustomer['status'];

          // Parse Date & time column
          const rawDate = row['Date & time'] || row['date'] || row['Date'] || row['date & time'] || '';
          let lastOrderDate: string | undefined;
          if (rawDate) {
            // Handle Excel serial date numbers
            if (typeof rawDate === 'number') {
              const excelDate = new Date((rawDate - 25569) * 86400 * 1000);
              if (!isNaN(excelDate.getTime())) lastOrderDate = excelDate.toISOString();
            } else {
              const parsed = new Date(String(rawDate));
              if (!isNaN(parsed.getTime())) lastOrderDate = parsed.toISOString();
            }
          }

          return {
            name: String(name).trim(),
            phone: phone.replace(/\s/g, ''),
            wilaya: String(wilaya).trim(),
            commune: commune ? String(commune).trim() : undefined,
            address: address ? String(address).trim() : undefined,
            total_orders: totalOrders || 0,
            total_spent: totalSpent || 0,
            notes: notes ? String(notes).trim() : undefined,
            status,
            last_order_date: lastOrderDate,
          };
        }).filter(c => c.name && c.phone && c.wilaya);

        setParsedData(customers);
        setStep('preview');
    } catch {
      toast.error("Erreur lors de la lecture du fichier Excel");
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    setStep('importing');
    const errors: ImportResult['errors'] = [];
    let success = 0;
    const batchSize = 50;

    for (let i = 0; i < parsedData.length; i += batchSize) {
      const batch = parsedData.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('customers')
        .upsert(
          batch.map(c => ({
            name: c.name,
            phone: c.phone,
            wilaya: c.wilaya,
            commune: c.commune || null,
            address: c.address || null,
            total_orders: c.total_orders || 0,
            total_spent: c.total_spent || 0,
            notes: c.notes || null,
            status: c.status || 'new',
            last_order_date: c.last_order_date || null,
          })),
          { onConflict: 'phone' }
        );

      if (error) {
        batch.forEach((_, idx) => {
          errors.push({ row: i + idx + 2, reason: error.message });
        });
      } else {
        success += batch.length;
      }

      setProgress(Math.round(((i + batch.length) / parsedData.length) * 100));
    }

    setResult({ success, failed: errors.length, errors });
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const downloadTemplate = useCallback(() => {
    const templateData = [
      { 'Date & time': '29-10-25 19:24', 'Full name': 'Ahmed Bensalem', 'Phone': '0555123456', 'wilaya': 'Alger', 'commune': 'Bab El Oued', 'Ville': 'ville', 'Product name': 'alien mugler', 'commandes': 5, 'Total depense': 15000, 'statu': 'livre' },
      { 'Date & time': '30-10-25 10:15', 'Full name': 'Fatima Zahra', 'Phone': '0661987654', 'wilaya': 'Oran', 'commune': 'Bir El Djir', 'Ville': 'ville', 'Product name': 'sauvage dior', 'commandes': 2, 'Total depense': 6000, 'statu': 'new' },
    ];
    writeExcelFile([{ name: 'Clients', data: templateData }], 'modele_import_clients.xlsx');
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importer des clients depuis Excel
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-sm">Cliquez ou glissez un fichier Excel</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Colonnes attendues :</p>
              <p><strong>Obligatoires</strong> : Full name (ou nom), Phone (ou téléphone), wilaya</p>
              <p><strong>Optionnelles</strong> : commune, Ville, Product name, commandes, Total depense, statu, notes</p>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Télécharger fichier exemple
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{parsedData.length} clients trouvés</Badge>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Nom</th>
                    <th className="p-2 text-left">Téléphone</th>
                    <th className="p-2 text-left">Wilaya</th>
                    <th className="p-2 text-right">Commandes</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 100).map((c, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2 font-medium">{c.name}</td>
                      <td className="p-2">{c.phone}</td>
                      <td className="p-2">{c.wilaya}</td>
                      <td className="p-2 text-right">{c.total_orders}</td>
                      <td className="p-2 text-right">{c.total_spent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 100 && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  ... et {parsedData.length - 100} de plus
                </p>
              )}
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>Annuler</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importer {parsedData.length} clients
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-4 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="font-medium">Importation en cours...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold text-emerald-600">{result.success}</p>
                  <p className="text-xs text-muted-foreground">Importés avec succès</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-lg font-bold text-red-500">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Échoués</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <ScrollArea className="h-[150px] border rounded-lg p-3">
                {result.errors.slice(0, 20).map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1">
                    <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
                    <span>Ligne {err.row}: {err.reason}</span>
                  </div>
                ))}
              </ScrollArea>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Fermer</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
