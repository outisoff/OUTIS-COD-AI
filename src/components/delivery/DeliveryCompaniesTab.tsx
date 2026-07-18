import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Truck,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Zap,
  AlertCircle,
} from 'lucide-react';
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

interface IntegrationFormData {
  api_key: string;
  api_secret: string;
  webhook_url: string;
  spreadsheet_id: string;
  store_url: string;
}

export function DeliveryCompaniesTab() {
  const { data: integrations, isLoading } = useIntegrations();
  const upsertIntegration = useUpsertIntegration();
  const toggleIntegration = useToggleIntegration();
  const deleteIntegration = useDeleteIntegration();

  const [formData, setFormData] = useState<Record<string, IntegrationFormData>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [testingCompany, setTestingCompany] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [newCompany, setNewCompany] = useState({
    name: '',
    api_key: '',
    api_secret: '',
    webhook_url: '',
  });

  const deliveryIntegrations = integrations?.filter(i => i.integration_type === 'delivery') || [];
  const customDeliveryCompanies = deliveryIntegrations
    .map(i => i.name)
    .filter(name => !DELIVERY_COMPANIES.includes(name as typeof DELIVERY_COMPANIES[number]));
  const allDeliveryCompanies = [...DELIVERY_COMPANIES, ...customDeliveryCompanies];

  const getIntegration = (type: string, name: string): Integration | undefined => {
    return integrations?.find(i => i.integration_type === type && i.name === name);
  };

  const getFormValue = (type: string, name: string, field: keyof IntegrationFormData): string => {
    const key = `${type}_${name}`;
    if (formData[key]?.[field] !== undefined) {
      return formData[key][field];
    }
    const existing = getIntegration(type, name);
    return (existing?.[field] as string) || '';
  };

  const setFormValue = (type: string, name: string, field: keyof IntegrationFormData, value: string) => {
    const key = `${type}_${name}`;
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSave = async (type: string, name: string) => {
    const key = `${type}_${name}`;
    const existing = getIntegration(type, name);
    const form = formData[key] || {} as IntegrationFormData;

    const apiKey = form.api_key !== undefined ? form.api_key : (existing?.api_key ?? null);
    const apiSecret = form.api_secret !== undefined ? form.api_secret : (existing?.api_secret ?? null);

    let settings = existing?.settings ?? null;
    if (type === 'delivery' && name === 'ZR Express' && apiKey) {
      settings = { ...(settings as Record<string, unknown> || {}), tenant_id: apiKey };
    }

    await upsertIntegration.mutateAsync({
      integration_type: type,
      name,
      api_key: apiKey,
      api_secret: apiSecret,
      webhook_url: form.webhook_url !== undefined ? form.webhook_url : (existing?.webhook_url ?? null),
      spreadsheet_id: form.spreadsheet_id !== undefined ? form.spreadsheet_id : (existing?.spreadsheet_id ?? null),
      store_url: form.store_url !== undefined ? form.store_url : (existing?.store_url ?? null),
      is_enabled: existing?.is_enabled ?? false,
      settings,
    });
  };

  const handleToggle = async (type: string, name: string, enabled: boolean) => {
    const existing = getIntegration(type, name);
    if (existing) {
      await toggleIntegration.mutateAsync({ id: existing.id, is_enabled: enabled });
    } else {
      await upsertIntegration.mutateAsync({
        integration_type: type,
        name,
        is_enabled: enabled,
      });
    }
  };

  const isConnected = (type: string, name: string): boolean => {
    const integration = getIntegration(type, name);
    return integration?.is_enabled ?? false;
  };

  const handleAddCompany = async () => {
    if (!newCompany.name.trim()) {
      toast.error('Le nom de la société est requis');
      return;
    }

    const existingNames = allDeliveryCompanies.map(n => n.toLowerCase());
    if (existingNames.includes(newCompany.name.trim().toLowerCase())) {
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
    const integration = getIntegration('delivery', name);
    if (integration) {
      await deleteIntegration.mutateAsync(integration.id);
    }
  };

  const isCustomCompany = (name: string): boolean => {
    return !DELIVERY_COMPANIES.includes(name as typeof DELIVERY_COMPANIES[number]);
  };

  const handleTestConnection = async (company: string) => {
    const key = `delivery_${company}`;
    const existing = getIntegration('delivery', company);
    const form = formData[key] || {} as IntegrationFormData;

    const apiKey = form.api_key !== undefined ? form.api_key : (existing?.api_key ?? '');
    const apiSecret = form.api_secret !== undefined ? form.api_secret : (existing?.api_secret ?? '');

    if (!apiKey) {
      toast.error('Veuillez entrer une clé API avant de tester');
      return;
    }

    setTestingCompany(company);
    setTestResults(prev => ({ ...prev, [company]: { success: false, message: '' } }));

    try {
      const { data, error } = await supabase.functions.invoke('test-delivery-api', {
        body: {
          company,
          api_key: apiKey,
          api_secret: apiSecret,
          webhook_url: form.webhook_url !== undefined ? form.webhook_url : (existing?.webhook_url ?? ''),
          store_url: form.store_url !== undefined ? form.store_url : (existing?.store_url ?? ''),
        },
      });

      if (error) throw error;

      setTestResults(prev => ({ ...prev, [company]: data }));

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      const errorResult = { success: false, message: 'Erreur lors du test de connexion' };
      setTestResults(prev => ({ ...prev, [company]: errorResult }));
      toast.error(errorResult.message);
    } finally {
      setTestingCompany(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Sociétés de livraison
            </CardTitle>
            <CardDescription>
              Connectez vos comptes de sociétés de livraison pour l'expédition automatique.
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une société de livraison</DialogTitle>
                <DialogDescription>
                  Configurez une nouvelle société de livraison avec ses paramètres API.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nom de la société *</Label>
                  <Input
                    placeholder="Ex: DHL, FedEx, ..."
                    value={newCompany.name}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Clé API</Label>
                    <Input
                      type="password"
                      placeholder="Clé API"
                      value={newCompany.api_key}
                      onChange={(e) => setNewCompany(prev => ({ ...prev, api_key: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Secret API</Label>
                    <Input
                      type="password"
                      placeholder="Secret API"
                      value={newCompany.api_secret}
                      onChange={(e) => setNewCompany(prev => ({ ...prev, api_secret: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>URL Webhook (optionnel)</Label>
                  <Input
                    placeholder="https://..."
                    value={newCompany.webhook_url}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, webhook_url: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAddCompany} disabled={upsertIntegration.isPending}>
                  {upsertIntegration.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {allDeliveryCompanies.map((company) => (
            <AccordionItem key={company} value={company}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{company}</span>
                  {isCustomCompany(company) && (
                    <Badge variant="secondary" className="text-xs">
                      Personnalisé
                    </Badge>
                  )}
                  {isConnected('delivery', company) ? (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connecté
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <XCircle className="h-3 w-3 mr-1" />
                      Non connecté
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label>Activer l'intégration</Label>
                  <Switch
                    checked={isConnected('delivery', company)}
                    onCheckedChange={(checked) => handleToggle('delivery', company, checked)}
                  />
                </div>
                {company === 'RJ360' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Token API</Label>
                      <Input
                        type="password"
                        placeholder="Entrez le token API"
                        value={getFormValue('delivery', company, 'api_key')}
                        onChange={(e) => setFormValue('delivery', company, 'api_key', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL de la plateforme</Label>
                      <Input
                        placeholder="https://example.ecotrack.dz"
                        value={getFormValue('delivery', company, 'store_url')}
                        onChange={(e) => setFormValue('delivery', company, 'store_url', e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{company === 'ZR Express' ? 'Tenant ID' : 'Clé API'}</Label>
                        <Input
                          type="password"
                          placeholder={company === 'ZR Express' ? 'Entrez le Tenant ID' : 'Entrez la clé API'}
                          value={getFormValue('delivery', company, 'api_key')}
                          onChange={(e) => setFormValue('delivery', company, 'api_key', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{company === 'ZR Express' ? 'API Key (Secret Key)' : 'Secret API'}</Label>
                        <Input
                          type="password"
                          placeholder={company === 'ZR Express' ? 'Entrez la Secret Key' : 'Entrez le secret API'}
                          value={getFormValue('delivery', company, 'api_secret')}
                          onChange={(e) => setFormValue('delivery', company, 'api_secret', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>URL Webhook (optionnel)</Label>
                      <Input
                        placeholder="https://..."
                        value={getFormValue('delivery', company, 'webhook_url')}
                        onChange={(e) => setFormValue('delivery', company, 'webhook_url', e.target.value)}
                      />
                    </div>
                  </>
                )}
                {testResults[company] && (
                  <div className={`flex items-center gap-2 p-3 rounded-md ${
                    testResults[company].success
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {testResults[company].success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm">{testResults[company].message}</span>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => handleTestConnection(company)}
                    disabled={testingCompany === company}
                  >
                    {testingCompany === company ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Tester la connexion
                  </Button>
                  <Button
                    onClick={() => handleSave('delivery', company)}
                    disabled={upsertIntegration.isPending}
                  >
                    {upsertIntegration.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Enregistrer
                  </Button>
                  {isCustomCompany(company) && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteCompany(company)}
                      disabled={deleteIntegration.isPending}
                    >
                      {deleteIntegration.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
