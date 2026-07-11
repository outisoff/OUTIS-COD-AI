import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Truck, 
  FileSpreadsheet, 
  ShoppingCart, 
  Loader2, 
  Save,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Zap,
  AlertCircle,
  RefreshCw,
  Link2,
  FolderOpen
} from 'lucide-react';
import { 
  useIntegrations, 
  useUpsertIntegration, 
  useToggleIntegration,
  useDeleteIntegration,
  DELIVERY_COMPANIES,
  ECOMMERCE_PLATFORMS,
  type Integration 
} from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface IntegrationFormData {
  api_key: string;
  api_secret: string;
  webhook_url: string;
  spreadsheet_id: string;
  store_url: string;
}

interface GoogleSheet {
  id: string;
  name: string;
  modifiedTime: string;
}

export function IntegrationsTab() {
  const { data: integrations, isLoading, refetch } = useIntegrations();
  const upsertIntegration = useUpsertIntegration();
  const toggleIntegration = useToggleIntegration();
  const deleteIntegration = useDeleteIntegration();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isImportingSheets, setIsImportingSheets] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<GoogleSheet[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);

  // Check if Google is connected via edge function (tokens not exposed to client)
  useEffect(() => {
    const checkGoogleConnection = async () => {
      if (!user) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke('check-google-connection', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        
        if (error) {
          console.error('Error checking Google connection:', error);
          return;
        }
        
        if (data?.connected) {
          setGoogleConnected(true);
          setGoogleEmail(data.email);
        } else {
          setGoogleConnected(false);
          setGoogleEmail(null);
        }
      } catch (error) {
        console.error('Error checking Google connection:', error);
      }
    };
    
    checkGoogleConnection();
  }, [user]);

  // Handle Google OAuth callback - tokens are now saved server-side
  useEffect(() => {
    const googleAuthSuccess = searchParams.get('google_auth_success');
    const googleEmail = searchParams.get('google_email');
    
    if (googleAuthSuccess === 'true') {
      // Tokens are saved server-side in the callback, just update UI state
      setGoogleConnected(true);
      if (googleEmail) {
        setGoogleEmail(googleEmail);
      }
      toast.success('Compte Google connecté avec succès');
      
      // Enable Google Sheets integration
      upsertIntegration.mutateAsync({
        integration_type: 'google_sheets',
        name: 'Google Sheets',
        is_enabled: true,
      }).catch(console.error);
      
      // Clean up URL params
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('google_auth_success');
      nextParams.delete('google_email');
      setSearchParams(nextParams);
    }
  }, [searchParams, setSearchParams, upsertIntegration]);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter');
        setIsConnectingGoogle(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('google-auth', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          redirectUrl: '/settings?tab=integrations',
        },
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting Google:', error);
      toast.error('Erreur lors de la connexion Google');
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous reconnecter');
        return;
      }

      const { data, error } = await supabase.functions.invoke('disconnect-google', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur lors de la déconnexion');
      
      setGoogleConnected(false);
      setGoogleEmail(null);
      toast.success('Compte Google déconnecté');
    } catch (error) {
      console.error('Error disconnecting Google:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const handleLoadSheets = async () => {
    setIsLoadingSheets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter');
        return;
      }

      const { data, error } = await supabase.functions.invoke('list-google-sheets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      setAvailableSheets(data.sheets || []);
      
      // Pre-select current sheet if exists
      const currentSheet = getIntegration('google_sheets', 'Google Sheets')?.spreadsheet_id;
      if (currentSheet) {
        setSelectedSheetId(currentSheet);
      }
      
      setSheetPickerOpen(true);
    } catch (error: unknown) {
      console.error('Error loading sheets:', error);
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement des feuilles';
      toast.error(message);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleSelectSheet = async () => {
    if (!selectedSheetId) {
      toast.error('Veuillez sélectionner une feuille');
      return;
    }

    try {
      await upsertIntegration.mutateAsync({
        integration_type: 'google_sheets',
        name: 'Google Sheets',
        spreadsheet_id: selectedSheetId,
        is_enabled: true,
      });
      
      setSheetPickerOpen(false);
      toast.success('Feuille sélectionnée avec succès');
      refetch();
    } catch (error) {
      console.error('Error selecting sheet:', error);
      toast.error('Erreur lors de la sélection');
    }
  };

  const handleSyncGoogleSheets = async () => {
    setIsSyncingSheets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter');
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-google-sheets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      toast.success(data.message || 'Export réussi');
      
      // Update spreadsheet ID if new one was created
      if (data?.spreadsheetId) {
        await upsertIntegration.mutateAsync({
          integration_type: 'google_sheets',
          name: 'Google Sheets',
          spreadsheet_id: data.spreadsheetId,
          is_enabled: true,
        });
        
        // Open spreadsheet in new tab
        if (data?.spreadsheetUrl) {
          window.open(data.spreadsheetUrl, '_blank');
        }
      }
      
      refetch();
    } catch (error: unknown) {
      console.error('Error syncing:', error);
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'export';
      toast.error(message);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleImportFromSheets = async () => {
    setIsImportingSheets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter');
        return;
      }

      const { data, error } = await supabase.functions.invoke('import-from-google-sheets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      toast.success(data.message || `${data.imported} commandes importées`);
      
      if (data?.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} erreurs lors de l'import`);
      }
      
    } catch (error: unknown) {
      console.error('Error importing:', error);
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'import';
      toast.error(message);
    } finally {
      setIsImportingSheets(false);
    }
  };

  // Get all delivery integrations (predefined + custom)
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

    // For ZR Express, also save tenant_id in settings
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
      // Create with enabled state
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
    <div className="space-y-6">
      {/* Google Sheets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Google Sheets
          </CardTitle>
          <CardDescription>
            Synchronisez vos commandes avec Google Sheets automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Connection Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${googleConnected ? 'bg-green-500/10' : 'bg-muted'}`}>
                {googleConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {googleConnected ? 'Compte Google connecté' : 'Connectez votre compte Google'}
                </p>
                {googleEmail && (
                  <p className="text-sm text-muted-foreground">{googleEmail}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {googleConnected ? (
                <Button variant="outline" onClick={handleDisconnectGoogle}>
                  Déconnecter
                </Button>
              ) : (
                <Button onClick={handleConnectGoogle} disabled={isConnectingGoogle}>
                  {isConnectingGoogle ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Connecter Google
                </Button>
              )}
            </div>
          </div>

          {googleConnected && (
            <>
              <div className="flex items-center justify-between">
                <Label>Activer la synchronisation automatique</Label>
                <Switch
                  checked={isConnected('google_sheets', 'Google Sheets')}
                  onCheckedChange={(checked) => handleToggle('google_sheets', 'Google Sheets', checked)}
                />
              </div>

              {/* Sheet Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Feuille Google Sheets</Label>
                    <p className="text-xs text-muted-foreground">
                      Choisissez une feuille existante ou créez-en une nouvelle lors de la synchronisation
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleLoadSheets}
                    disabled={isLoadingSheets}
                  >
                    {isLoadingSheets ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FolderOpen className="h-4 w-4 mr-2" />
                    )}
                    Parcourir
                  </Button>
                </div>

                {/* Spreadsheet Info */}
                {getIntegration('google_sheets', 'Google Sheets')?.spreadsheet_id && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Feuille liée</p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {availableSheets.find(s => s.id === getIntegration('google_sheets', 'Google Sheets')?.spreadsheet_id)?.name || 
                           `ID: ${getIntegration('google_sheets', 'Google Sheets')?.spreadsheet_id}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${getIntegration('google_sheets', 'Google Sheets')?.spreadsheet_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ouvrir
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Import automatique activé
                      </p>
                    <p className="text-xs text-muted-foreground">
                        Les nouvelles commandes de la feuille sont importées chaque minute
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handleImportFromSheets}
                    disabled={isImportingSheets}
                  >
                    {isImportingSheets ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Importer maintenant
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleSyncGoogleSheets}
                    disabled={isSyncingSheets}
                  >
                    {isSyncingSheets ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Exporter vers la feuille
                  </Button>
                </div>
              </div>

              {/* Sheet Picker Dialog */}
              <Dialog open={sheetPickerOpen} onOpenChange={setSheetPickerOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Sélectionner une feuille</DialogTitle>
                    <DialogDescription>
                      Choisissez une feuille Google Sheets existante pour la synchronisation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    {availableSheets.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucune feuille trouvée. Une nouvelle sera créée lors de la synchronisation.
                      </p>
                    ) : (
                      <Select value={selectedSheetId || ''} onValueChange={setSelectedSheetId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une feuille..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSheets.map((sheet) => (
                            <SelectItem key={sheet.id} value={sheet.id}>
                              <div className="flex flex-col">
                                <span>{sheet.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Modifié le {new Date(sheet.modifiedTime).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSheetPickerOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleSelectSheet} disabled={!selectedSheetId || availableSheets.length === 0}>
                      Sélectionner
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>

      {/* E-commerce Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Plateformes E-commerce
          </CardTitle>
          <CardDescription>
            Connectez vos boutiques en ligne pour importer automatiquement les commandes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {ECOMMERCE_PLATFORMS.map((platform) => (
              <AccordionItem key={platform} value={platform}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{platform}</span>
                    {isConnected('ecommerce', platform) ? (
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
                      checked={isConnected('ecommerce', platform)}
                      onCheckedChange={(checked) => handleToggle('ecommerce', platform, checked)}
                    />
                  </div>

                  {/* LightFunnel Webhook URL */}
                  {platform === 'LightFunnel' && (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <Label className="text-sm font-medium">URL Webhook (à copier dans LightFunnel)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/lightfunnel-webhook`}
                          className="font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/lightfunnel-webhook`
                            );
                            toast.success('URL copiée !');
                          }}
                        >
                          Copier
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Collez cette URL dans les paramètres Webhook de votre compte LightFunnel pour recevoir automatiquement les commandes.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>URL de la boutique</Label>
                    <Input
                      placeholder={platform === 'Shopify' ? 'votre-boutique.myshopify.com' : 'votre-boutique.lightfunnel.com'}
                      value={getFormValue('ecommerce', platform, 'store_url')}
                      onChange={(e) => setFormValue('ecommerce', platform, 'store_url', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{platform === 'LightFunnel' ? 'Clé API (pour sécuriser le webhook)' : 'Clé API'}</Label>
                    <Input
                      type="password"
                      placeholder="Entrez la clé API"
                      value={getFormValue('ecommerce', platform, 'api_key')}
                      onChange={(e) => setFormValue('ecommerce', platform, 'api_key', e.target.value)}
                    />
                    {platform === 'LightFunnel' && (
                      <p className="text-xs text-muted-foreground">
                        Ajoutez <code className="bg-muted px-1 rounded">?api_key=VOTRE_CLE</code> à l'URL webhook dans LightFunnel pour sécuriser la connexion.
                      </p>
                    )}
                  </div>
                  {platform !== 'LightFunnel' && (
                    <div className="space-y-2">
                      <Label>Secret API</Label>
                      <Input
                        type="password"
                        placeholder="Entrez le secret API"
                        value={getFormValue('ecommerce', platform, 'api_secret')}
                        onChange={(e) => setFormValue('ecommerce', platform, 'api_secret', e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleSave('ecommerce', platform)}
                      disabled={upsertIntegration.isPending}
                    >
                      {upsertIntegration.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Enregistrer
                    </Button>
                    {platform === 'Shopify' && (
                      <Button variant="outline" asChild>
                        <a 
                          href="https://admin.shopify.com/store" 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Admin Shopify
                        </a>
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
