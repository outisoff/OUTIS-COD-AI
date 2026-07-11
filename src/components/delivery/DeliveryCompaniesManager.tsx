import { useState } from 'react';
import { Plus, Trash2, Save, Loader2, Zap, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useIntegrations,
  useUpsertIntegration,
  useToggleIntegration,
  useDeleteIntegration,
  DELIVERY_COMPANIES,
  type Integration,
} from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FormData {
  api_key: string;
  api_secret: string;
  webhook_url: string;
}

export function DeliveryCompaniesManager() {
  const { data: integrations, isLoading } = useIntegrations('delivery');
  const upsertIntegration = useUpsertIntegration();
  const toggleIntegration = useToggleIntegration();
  const deleteIntegration = useDeleteIntegration();

  const [formData, setFormData] = useState<Record<string, FormData>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [testingCompany, setTestingCompany] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [newCompany, setNewCompany] = useState({ name: '', api_key: '', api_secret: '', webhook_url: '' });

  const customCompanies = (integrations || [])
    .map(i => i.name)
    .filter(name => !DELIVERY_COMPANIES.includes(name as typeof DELIVERY_COMPANIES[number]));
  const allCompanies = [...DELIVERY_COMPANIES, ...customCompanies];

  const getIntegration = (name: string): Integration | undefined => {
    return integrations?.find(i => i.name === name);
  };

  const getFormValue = (name: string, field: keyof FormData): string => {
    if (formData[name]?.[field] !== undefined) return formData[name][field];
    const existing = getIntegration(name);
    if (field === 'api_key') return existing?.api_key || '';
    if (field === 'api_secret') return existing?.api_secret || '';
    if (field === 'webhook_url') return existing?.webhook_url || '';
    return '';
  };

  const setFormValue = (name: string, field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  };

  const handleSave = async (name: string) => {
    const existing = getIntegration(name);
    const form = formData[name] || {} as FormData;

    await upsertIntegration.mutateAsync({
      integration_type: 'delivery',
      name,
      api_key: form.api_key !== undefined ? form.api_key : (existing?.api_key ?? null),
      api_secret: form.api_secret !== undefined ? form.api_secret : (existing?.api_secret ?? null),
      webhook_url: form.webhook_url !== undefined ? form.webhook_url : (existing?.webhook_url ?? null),
      is_enabled: existing?.is_enabled ?? false,
    });
  };

  const handleToggle = async (name: string, enabled: boolean) => {
    const existing = getIntegration(name);
    if (existing) {
      await toggleIntegration.mutateAsync({ id: existing.id, is_enabled: enabled });
    } else {
      await upsertIntegration.mutateAsync({
        integration_type: 'delivery',
        name,
        is_enabled: enabled,
      });
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name.trim()) {
      toast.error('Le nom de la société est requis');
      return;
    }
    if (allCompanies.map(n => n.toLowerCase()).includes(newCompany.name.trim().toLowerCase())) {
      toast.error('Cette société existe déjà');
      return;
    }

    await upsertIntegration.mutateAsync({
      integration_type: 'delivery',
      name: newCompany.name.trim(),
      api_key: newCompany.api_key || null,
      api_secret: newCompany.api_secret || null,
      webhook_url: newCompany.webhook_url || null,
      is_enabled: true,
    });

    setNewCompany({ name: '', api_key: '', api_secret: '', webhook_url: '' });
    setAddDialogOpen(false);
  };

  const handleDeleteCompany = async (name: string) => {
    const integration = getIntegration(name);
    if (integration) await deleteIntegration.mutateAsync(integration.id);
  };

  const handleTestConnection = async (company: string) => {
    const existing = getIntegration(company);
    const form = formData[company] || {} as FormData;
    const apiKey = form.api_key !== undefined ? form.api_key : (existing?.api_key ?? '');
    const apiSecret = form.api_secret !== undefined ? form.api_secret : (existing?.api_secret ?? '');

    if (!apiKey) {
      toast.error('Veuillez entrer une clé API avant de tester');
      return;
    }

    setTestingCompany(company);
    try {
      const { data, error } = await supabase.functions.invoke('test-delivery-api', {
        body: {
          company,
          api_key: apiKey,
          api_secret: apiSecret,
          webhook_url: form.webhook_url !== undefined ? form.webhook_url : (existing?.webhook_url ?? ''),
        },
      });
      if (error) throw error;
      setTestResults(prev => ({ ...prev, [company]: data }));
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch {
      const errorResult = { success: false, message: 'Erreur lors du test de connexion' };
      setTestResults(prev => ({ ...prev, [company]: errorResult }));
      toast.error(errorResult.message);
    } finally {
      setTestingCompany(null);
    }
  };

  const isCustomCompany = (name: string) => !DELIVERY_COMPANIES.includes(name as typeof DELIVERY_COMPANIES[number]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sociétés de Livraison</h3>
          <p className="text-sm text-muted-foreground">
            Ajoutez et configurez vos sociétés de livraison et leurs API
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une société
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle société de livraison</DialogTitle>
              <DialogDescription>
                Ajoutez une société de livraison personnalisée
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom de la société *</Label>
                <Input
                  placeholder="Ex: Express Delivery"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Clé API</Label>
                <Input
                  placeholder="Clé API"
                  value={newCompany.api_key}
                  onChange={(e) => setNewCompany(p => ({ ...p, api_key: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Secret API</Label>
                <Input
                  type="password"
                  placeholder="Secret API"
                  value={newCompany.api_secret}
                  onChange={(e) => setNewCompany(p => ({ ...p, api_secret: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://..."
                  value={newCompany.webhook_url}
                  onChange={(e) => setNewCompany(p => ({ ...p, webhook_url: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleAddCompany} disabled={upsertIntegration.isPending}>
                {upsertIntegration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {allCompanies.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Aucune société de livraison configurée. Cliquez sur "Ajouter une société" pour commencer.
        </div>
      )}

      {allCompanies.map((company) => {
        const integration = getIntegration(company);
        const isEnabled = integration?.is_enabled ?? false;
        const testResult = testResults[company];

        return (
          <Card key={company} className={isEnabled ? 'border-primary/30' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{company}</CardTitle>
                  {isEnabled ? (
                    <Badge variant="default" className="bg-emerald-500">Activé</Badge>
                  ) : (
                    <Badge variant="secondary">Désactivé</Badge>
                  )}
                  {isCustomCompany(company) && (
                    <Badge variant="outline">Personnalisé</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(company, checked)}
                  />
                  {isCustomCompany(company) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCompany(company)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                Configurez les identifiants API pour {company}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Clé API (Token)</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showSecrets[company] ? 'text' : 'password'}
                      placeholder="Entrez la clé API"
                      value={getFormValue(company, 'api_key')}
                      onChange={(e) => setFormValue(company, 'api_key', e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSecrets(p => ({ ...p, [company]: !p[company] }))}
                    >
                      {showSecrets[company] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secret API</Label>
                  <Input
                    type="password"
                    placeholder="Entrez le secret API"
                    value={getFormValue(company, 'api_secret')}
                    onChange={(e) => setFormValue(company, 'api_secret', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://api.example.com/webhook"
                  value={getFormValue(company, 'webhook_url')}
                  onChange={(e) => setFormValue(company, 'webhook_url', e.target.value)}
                />
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                  testResult.success
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testResult.message}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection(company)}
                  disabled={testingCompany === company}
                >
                  {testingCompany === company ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Tester
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(company)}
                  disabled={upsertIntegration.isPending}
                >
                  {upsertIntegration.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
