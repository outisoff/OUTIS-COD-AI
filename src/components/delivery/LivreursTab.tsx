import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, Loader2, Trash2, Pencil, Phone, MapPin, MessageSquare, Save, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { WilayaSelect } from '@/components/orders/WilayaSelect';
import { Checkbox } from '@/components/ui/checkbox';

interface LivreurForm {
  name: string;
  phone: string;
  wilaya: string;
  tarif: string;
  return_tarif: string;
}

const DEFAULT_TEMPLATE = `📦 *Nouvelle commande à livrer*

📋 *Commande:* {order_number}
👤 *Client:* {customer_name}
📞 *Téléphone:* {customer_phone}
📍 *Adresse:* {customer_address}
🏙️ *Wilaya:* {wilaya}
🏘️ *Commune:* {commune}
🚚 *Type:* {delivery_type}
💰 *Montant:* {total_price} DA

📝 *Produits:*
{products}

━━━━━━━━━━━━━━━━
📲 *Mettre à jour le statut:*

{action_buttons}`;

const TEMPLATE_VARIABLES = [
  { key: '{order_number}', label: 'N° commande' },
  { key: '{customer_name}', label: 'Nom client' },
  { key: '{customer_phone}', label: 'Téléphone client' },
  { key: '{customer_address}', label: 'Adresse' },
  { key: '{wilaya}', label: 'Wilaya' },
  { key: '{commune}', label: 'Commune' },
  { key: '{delivery_type}', label: 'Type livraison' },
  { key: '{total_price}', label: 'Montant' },
  { key: '{products}', label: 'Liste produits' },
  { key: '{notes}', label: 'Notes' },
  { key: '{action_buttons}', label: 'Boutons statut (Livré/Retour/...)' },
];

const TRIGGER_STATUSES = [
  { value: 'preparing', label: 'En Préparation' },
  { value: 'ready', label: 'Prête' },
  { value: 'en_livraison', label: 'En Livraison' },
  { value: 'shipped', label: 'Expédiée' },
];

const AVAILABLE_STATUSES = [
  { value: 'delivered', label: 'Livré' },
  { value: 'delivered_paid', label: 'Livré et payé' },
  { value: 'returned', label: 'Retourné' },
  { value: 'alerte', label: 'Alerte' },
  { value: 'Échec_de_livraison', label: 'Échec de livraison' },
  { value: 'no_answer', label: 'Pas de réponse' },
  { value: 'postponed', label: 'Reporté' },
  { value: 'en_livraison', label: 'En livraison' },
  { value: 'at_station', label: 'En station' },
];

interface PollOption {
  label: string;
  status: string;
}

const DEFAULT_POLL_OPTIONS: PollOption[] = [
  { label: 'livre', status: 'delivered' },
  { label: 'repondre pas', status: 'alerte' },
  { label: 'retour', status: 'Échec_de_livraison' },
  { label: 'reporter', status: 'alerte' },
];

export function LivreursTab() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LivreurForm>({ name: '', phone: '', wilaya: '', tarif: '', return_tarif: '' });
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [triggerStatuses, setTriggerStatuses] = useState<string[]>(['preparing']);
  const [pollOptions, setPollOptions] = useState<PollOption[]>(DEFAULT_POLL_OPTIONS);
  

  const { data: livreurs, isLoading } = useQuery({
    queryKey: ['local-livreurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('local_livreurs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Load saved template
  const { data: savedConfig } = useQuery({
    queryKey: ['livreur-whatsapp-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('setting_value')
        .eq('setting_key', 'livreur_whatsapp_template')
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value as { template?: string; enabled?: boolean; trigger_statuses?: string[]; poll_options?: PollOption[] } | null;
    },
  });

  useEffect(() => {
    if (savedConfig) {
      if (savedConfig.template) setMessageTemplate(savedConfig.template);
      if (typeof savedConfig.enabled === 'boolean') setWhatsappEnabled(savedConfig.enabled);
      if (Array.isArray(savedConfig.trigger_statuses)) setTriggerStatuses(savedConfig.trigger_statuses);
      if (Array.isArray(savedConfig.poll_options) && savedConfig.poll_options.length > 0) {
        setPollOptions(savedConfig.poll_options);
      }
    }
  }, [savedConfig]);

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const value = { template: messageTemplate, enabled: whatsappEnabled, trigger_statuses: triggerStatuses, poll_options: pollOptions.map(o => ({ label: o.label, status: o.status })) } as any;
      const { data: existing } = await supabase
        .from('automation_settings')
        .select('id')
        .eq('setting_key', 'livreur_whatsapp_template')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('automation_settings')
          .update({ setting_value: value })
          .eq('setting_key', 'livreur_whatsapp_template');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('automation_settings')
          .insert({ setting_key: 'livreur_whatsapp_template', setting_value: value });
        if (error) throw error;
      }

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livreur-whatsapp-config'] });
      toast.success('Configuration sauvegardée');
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: LivreurForm & { id?: string }) => {
      const tarifNum = data.tarif ? Number(data.tarif) : 0;
      const returnTarifNum = data.return_tarif ? Number(data.return_tarif) : 0;
      if (data.id) {
        const { error } = await supabase
          .from('local_livreurs')
          .update({ name: data.name, phone: data.phone, wilaya: data.wilaya || null, tarif: tarifNum, return_tarif: returnTarifNum } as any)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('local_livreurs')
          .insert({ name: data.name, phone: data.phone, wilaya: data.wilaya || null, tarif: tarifNum, return_tarif: returnTarifNum } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-livreurs'] });
      toast.success(editId ? 'Livreur modifié' : 'Livreur ajouté');
      resetForm();
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('local_livreurs')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-livreurs'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('local_livreurs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-livreurs'] });
      toast.success('Livreur supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const resetForm = () => {
    setForm({ name: '', phone: '', wilaya: '', tarif: '', return_tarif: '' });
    setEditId(null);
    setAddOpen(false);
  };

  const handleEdit = (livreur: any) => {
    setForm({ name: livreur.name, phone: livreur.phone, wilaya: livreur.wilaya || '', tarif: livreur.tarif?.toString() || '', return_tarif: livreur.return_tarif?.toString() || '' });
    setEditId(livreur.id);
    setAddOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Le nom et le téléphone sont requis');
      return;
    }
    upsertMutation.mutate({ ...form, id: editId || undefined });
  };

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Livreurs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Livreurs Locaux
              </CardTitle>
              <CardDescription>
                Gérez vos livreurs locaux pour les livraisons directes.
              </CardDescription>
            </div>
            <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetForm(); else setAddOpen(true); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editId ? 'Modifier le livreur' : 'Ajouter un livreur'}</DialogTitle>
                  <DialogDescription>
                    {editId ? 'Modifiez les informations du livreur.' : 'Ajoutez un nouveau livreur local.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      placeholder="Nom du livreur"
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input
                      placeholder="0555123456"
                      value={form.phone}
                      onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wilaya (optionnel)</Label>
                    <WilayaSelect
                      value={form.wilaya}
                      onChange={(value) => setForm(prev => ({ ...prev, wilaya: value }))}
                      placeholder="Sélectionner une wilaya"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tarif Livraison (DA)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={form.tarif}
                        onChange={(e) => setForm(prev => ({ ...prev, tarif: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tarif Retour (DA)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={form.return_tarif}
                        onChange={(e) => setForm(prev => ({ ...prev, return_tarif: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>Annuler</Button>
                  <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editId ? 'Modifier' : 'Ajouter'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!livreurs || livreurs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Aucun livreur ajouté</p>
              <p className="text-xs mt-1">Cliquez sur "Ajouter" pour créer un livreur</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead>Tarif Livraison</TableHead>
                  <TableHead>Tarif Retour</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {livreurs.map((livreur) => (
                  <TableRow key={livreur.id}>
                    <TableCell className="font-medium">{livreur.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {livreur.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {livreur.wilaya ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {livreur.wilaya}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{Number(livreur.tarif || 0).toLocaleString('fr-DZ')} DA</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{Number((livreur as any).return_tarif || 0).toLocaleString('fr-DZ')} DA</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={livreur.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: livreur.id, is_active: checked })}
                        />
                        <Badge variant={livreur.is_active ? 'default' : 'secondary'}>
                          {livreur.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(livreur)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(livreur.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Template Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message WhatsApp automatique
              </CardTitle>
              <CardDescription>
                Personnalisez le message envoyé au livreur lors de l'expédition d'une commande.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="wa-enabled" className="text-sm text-muted-foreground">Activer</Label>
              <Switch
                id="wa-enabled"
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trigger statuses */}
          <div className="space-y-2">
            <Label>Envoyer le message quand le statut passe à :</Label>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_STATUSES.map((status) => {
                const isSelected = triggerStatuses.includes(status.value);
                return (
                  <button
                    key={status.value}
                    type="button"
                    disabled={!whatsappEnabled}
                    onClick={() => {
                      setTriggerStatuses(prev =>
                        isSelected
                          ? prev.filter(s => s !== status.value)
                          : [...prev, status.value]
                      );
                    }}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
                      !whatsappEnabled
                        ? 'opacity-50 cursor-not-allowed border-border text-muted-foreground bg-muted/30'
                        : isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer'
                    }`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full transition-colors ${isSelected ? 'bg-primary-foreground' : 'bg-muted-foreground/40'}`} />
                    {status.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Template du message</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={14}
              className="font-mono text-sm"
              disabled={!whatsappEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Variables disponibles (cliquez pour insérer)</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors text-xs"
                  onClick={() => {
                    if (whatsappEnabled) {
                      setMessageTemplate(prev => prev + v.key);
                    }
                  }}
                >
                  {v.key} — {v.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Poll Options Config - attractive card style */}
          <div className="border border-border rounded-xl bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                  <Vote className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Configuration du sondage</h4>
                  <p className="text-xs text-muted-foreground">
                    Options du sondage et statut associé à chaque vote
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {pollOptions.length}/12 options
              </Badge>
            </div>

            <div className="space-y-2">
              {pollOptions.map((opt, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5 transition-all hover:shadow-sm">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                    {index + 1}
                  </div>
                  <Input
                    value={opt.label}
                    onChange={(e) => {
                      const updated = [...pollOptions];
                      updated[index] = { ...updated[index], label: e.target.value };
                      setPollOptions(updated);
                    }}
                    placeholder="Nom de l'option"
                    disabled={!whatsappEnabled}
                    className="h-8 text-sm"
                  />
                  <span className="text-muted-foreground text-xs shrink-0">→</span>
                  <Select
                    value={opt.status}
                    onValueChange={(value) => {
                      const updated = [...pollOptions];
                      updated[index] = { ...updated[index], status: value };
                      setPollOptions(updated);
                    }}
                    disabled={!whatsappEnabled}
                  >
                    <SelectTrigger className="h-8 text-sm min-w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pollOptions.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive/60 hover:text-destructive shrink-0"
                      onClick={() => setPollOptions(prev => prev.filter((_, i) => i !== index))}
                      disabled={!whatsappEnabled}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 12 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => setPollOptions(prev => [...prev, { label: '', status: 'alerte' }])}
                disabled={!whatsappEnabled}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une option
              </Button>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMessageTemplate(DEFAULT_TEMPLATE)}
              disabled={!whatsappEnabled}
            >
              Réinitialiser
            </Button>
            <Button
              size="sm"
              onClick={() => saveTemplateMutation.mutate()}
              disabled={saveTemplateMutation.isPending}
            >
              {saveTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
