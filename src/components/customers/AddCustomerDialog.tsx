import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WilayaSelect } from '@/components/orders/WilayaSelect';
import { CommuneSelect } from '@/components/orders/CommuneSelect';
import { algeriaWilayas, communesByWilaya } from '@/data/algeriaLocations';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { toast } from 'sonner';

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCustomerDialog({ open, onOpenChange }: AddCustomerDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [commune, setCommune] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<string>('new');
  const [notes, setNotes] = useState('');
  const createCustomer = useCreateCustomer();

  const reset = () => {
    setName('');
    setPhone('');
    setWilaya('');
    setCommune('');
    setAddress('');
    setStatus('new');
    setNotes('');
  };

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim() || !wilaya) {
      toast.error('Veuillez remplir les champs obligatoires (nom, téléphone, wilaya)');
      return;
    }

    createCustomer.mutate(
      {
        name: name.trim(),
        phone: phone.trim(),
        wilaya,
        commune: commune || null,
        address: address.trim() || null,
        status: status as 'new' | 'regular' | 'vip' | 'blacklisted',
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Client ajouté avec succès');
          reset();
          onOpenChange(false);
        },
        onError: (error: any) => {
          if (error?.code === '23505') {
            toast.error('Un client avec ce numéro de téléphone existe déjà');
          } else {
            toast.error("Erreur lors de l'ajout du client");
          }
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone *</Label>
              <Input placeholder="0555123456" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Wilaya *</Label>
              <WilayaSelect value={wilaya} onChange={setWilaya} />
            </div>
            <div className="space-y-1.5">
              <Label>Commune</Label>
              {(() => {
                const selectedWilaya = algeriaWilayas.find(w => w.name === wilaya || w.code === wilaya || `${w.code} - ${w.name}` === wilaya);
                const communes = selectedWilaya ? communesByWilaya[selectedWilaya.code] || [] : [];
                return <CommuneSelect value={commune} onChange={setCommune} communes={communes} disabled={!wilaya} />;
              })()}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input placeholder="Adresse complète" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nouveau</SelectItem>
                <SelectItem value="regular">Régulier</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="blacklisted">Blacklisté</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Notes sur le client..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={createCustomer.isPending}>
            {createCustomer.isPending ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
