import { useState } from 'react';
import { Facebook, Instagram, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Copy, ExternalLink, Plus, Trash2, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useMetaIntegration, useMetaPages, useSaveMetaIntegration, useAddMetaPage, useToggleMetaPage, useDeleteMetaPage, useUpdateMetaSettings, useDisconnectMeta } from '@/hooks/useMetaIntegration';

export function SocialConnectionTab() {
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [pageId, setPageId] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [connectInstagram, setConnectInstagram] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [newPagePlatform, setNewPagePlatform] = useState<'facebook' | 'instagram' | 'tiktok'>('facebook');
  const [newPageName, setNewPageName] = useState('');
  const [newPageId, setNewPageId] = useState('');
  const [newPageToken, setNewPageToken] = useState('');
  const [showAddPage, setShowAddPage] = useState(false);

  const { data: metaIntegration, isLoading: loadingMeta } = useMetaIntegration();
  const { data: metaPages = [] } = useMetaPages();
  const saveMeta = useSaveMetaIntegration();
  const addPage = useAddMetaPage();
  const togglePage = useToggleMetaPage();
  const deletePage = useDeleteMetaPage();
  const updateSettings = useUpdateMetaSettings();
  const disconnectMeta = useDisconnectMeta();

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook`;
  const tiktokWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiktok-webhook`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié !');
  };

  const handleSaveMeta = () => {
    if (!appId.trim() || !appSecret.trim() || !pageAccessToken.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    saveMeta.mutate({
      app_id: appId.trim(),
      app_secret: appSecret.trim(),
      page_access_token: pageAccessToken.trim(),
      page_id: pageId.trim() || undefined,
      instagram_id: instagramId.trim() || undefined,
      connect_instagram: connectInstagram,
    });
  };

  const handleDisconnect = () => {
    if (metaIntegration?.id) {
      disconnectMeta.mutate(metaIntegration.id);
      setAppId('');
      setAppSecret('');
      setPageAccessToken('');
      setPageId('');
    }
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Statut de connexion
          </CardTitle>
          <CardDescription>
            Connectez vos réseaux sociaux pour gérer messages et commentaires.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMeta ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : metaIntegration?.is_connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Facebook</span>
                  {metaIntegration.facebook_connected ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-600" />
                  <span className="text-sm">Instagram</span>
                  {metaIntegration.instagram_connected ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnectMeta.isPending}>
                {disconnectMeta.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Déconnecter
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Non connecté</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials Form */}
      <Card>
        <CardHeader>
          <CardTitle>Identifiants Meta App</CardTitle>
          <CardDescription>
            Entrez les identifiants de votre application Meta Business.{' '}
            <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1">
              Créer une app <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-id">App ID *</Label>
            <Input id="app-id" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="123456789012345" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-secret">App Secret *</Label>
            <div className="flex gap-2">
              <Input id="app-secret" type={showSecret ? 'text' : 'password'} value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="••••••••••••••••" className="flex-1" />
              <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-token">Page Access Token *</Label>
            <div className="flex gap-2">
              <Input id="page-token" type={showToken ? 'text' : 'password'} value={pageAccessToken} onChange={(e) => setPageAccessToken(e.target.value)} placeholder="••••••••••••••••" className="flex-1" />
              <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-id">Page ID (optionnel)</Label>
            <Input id="page-id" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="ID de votre page Facebook" />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-600" />
                Connecter Instagram
              </Label>
              <p className="text-xs text-muted-foreground">Votre compte Instagram doit être un compte professionnel lié à votre page Facebook</p>
            </div>
            <Switch checked={connectInstagram} onCheckedChange={setConnectInstagram} />
          </div>

          {connectInstagram && (
            <div className="space-y-2">
              <Label htmlFor="instagram-id">Instagram Business Account ID (optionnel)</Label>
              <Input id="instagram-id" value={instagramId} onChange={(e) => setInstagramId(e.target.value)} placeholder="ID du compte Instagram Business" />
              <p className="text-xs text-muted-foreground">Si vide, il sera récupéré automatiquement via votre Page Access Token.</p>
            </div>
          )}

          <Button onClick={handleSaveMeta} disabled={saveMeta.isPending} className="w-full">
            {saveMeta.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {metaIntegration?.is_connected ? 'Mettre à jour' : 'Connecter'}
          </Button>
        </CardContent>
      </Card>

      {/* Webhook URLs */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook URLs</CardTitle>
          <CardDescription>Copiez ces URLs dans les paramètres de vos applications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Meta Webhook (Facebook / Instagram)</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="flex-1 font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>TikTok Webhook</Label>
            <div className="flex gap-2">
              <Input value={tiktokWebhookUrl} readOnly className="flex-1 font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(tiktokWebhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {metaIntegration?.verify_token && (
            <div className="space-y-2">
              <Label>Verify Token (Meta)</Label>
              <div className="flex gap-2">
                <Input value={metaIntegration.verify_token} readOnly className="flex-1 font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(metaIntegration.verify_token)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Meta → Webhooks : <strong>messages</strong>, <strong>messaging_postbacks</strong>, <strong>feed</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Connected Pages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pages & comptes connectés</CardTitle>
              <CardDescription>Gérez vos pages Facebook, comptes Instagram et TikTok.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowAddPage(!showAddPage)} className="gap-1">
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddPage && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Plateforme</Label>
                  <Select value={newPagePlatform} onValueChange={(v) => setNewPagePlatform(v as 'facebook' | 'instagram' | 'tiktok')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook"><span className="flex items-center gap-2"><Facebook className="h-4 w-4" /> Facebook</span></SelectItem>
                      <SelectItem value="instagram"><span className="flex items-center gap-2"><Instagram className="h-4 w-4" /> Instagram</span></SelectItem>
                      <SelectItem value="tiktok"><span className="flex items-center gap-2"><Music className="h-4 w-4" /> TikTok</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Nom de la page *</Label>
                  <Input value={newPageName} onChange={(e) => setNewPageName(e.target.value)} placeholder="Ma Page" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Page/Account ID *</Label>
                <Input value={newPageId} onChange={(e) => setNewPageId(e.target.value)} placeholder="123456789" />
              </div>
              <div className="space-y-1">
                <Label>Page Access Token (optionnel)</Label>
                <Input value={newPageToken} onChange={(e) => setNewPageToken(e.target.value)} placeholder="Token spécifique" type="password" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={!newPageName.trim() || !newPageId.trim() || addPage.isPending}
                  onClick={() => {
                    addPage.mutate({
                      integration_id: metaIntegration?.id,
                      platform: newPagePlatform,
                      page_name: newPageName.trim(),
                      page_id: newPageId.trim(),
                      page_access_token: newPageToken.trim() || undefined,
                    }, {
                      onSuccess: () => { setNewPageName(''); setNewPageId(''); setNewPageToken(''); setShowAddPage(false); },
                    });
                  }}
                >
                  {addPage.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Ajouter
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddPage(false)}>Annuler</Button>
              </div>
            </div>
          )}

          {metaPages.length === 0 && !showAddPage ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune page connectée.</p>
          ) : (
            <div className="space-y-2">
              {metaPages.map((page) => (
                <div key={page.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {page.platform === 'facebook' ? <Facebook className="h-5 w-5 text-blue-600" /> : page.platform === 'tiktok' ? <Music className="h-5 w-5 text-[#00f2ea]" /> : <Instagram className="h-5 w-5 text-pink-600" />}
                    <div>
                      <p className="text-sm font-medium">{page.page_name}</p>
                      <p className="text-xs text-muted-foreground">ID: {page.page_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={page.is_active} onCheckedChange={(checked) => togglePage.mutate({ id: page.id, is_active: checked })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePage.mutate(page.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-reply settings */}
      {metaIntegration?.is_connected && (
        <Card>
          <CardHeader>
            <CardTitle>Paramètres de réponse automatique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Répondre aux messages</Label>
                <p className="text-xs text-muted-foreground">L'IA répond automatiquement aux messages Messenger et Instagram</p>
              </div>
              <Switch checked={metaIntegration.auto_reply_messages} onCheckedChange={(checked) => updateSettings.mutate({ id: metaIntegration.id, auto_reply_messages: checked })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Répondre aux commentaires</Label>
                <p className="text-xs text-muted-foreground">L'IA répond automatiquement aux commentaires Facebook et Instagram</p>
              </div>
              <Switch checked={metaIntegration.auto_reply_comments} onCheckedChange={(checked) => updateSettings.mutate({ id: metaIntegration.id, auto_reply_comments: checked })} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
