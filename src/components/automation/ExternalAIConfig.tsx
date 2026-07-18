import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Loader2, Save, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDER_MODELS: Record<string, { value: string; label: string; desc?: string }[]> = {
  google: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash 🆓', desc: 'Recommandé - Rapide et intelligent' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro 💰', desc: 'Très puissant, quota limité' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash 🆓', desc: 'Rapide, bon quota gratuit' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite 🆓', desc: 'Ultra léger et rapide' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash 🆓', desc: 'Stable, bon quota gratuit' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro 🆓', desc: 'Plus puissant, quota limité' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', desc: 'Modèle phare OpenAI' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Rapide et économique' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', desc: 'Classique, très rapide' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', desc: 'Gratuit, rapide' },
  ],
};

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI (ChatGPT)' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq (Llama)' },
];

const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  google: '',
};

interface ExternalAIConfigProps {
  settings: any;
  upsertSetting: any;
  getModel: () => string;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  handleSaveConfirmation: () => Promise<void>;
}

export default function ExternalAIConfig({ settings, upsertSetting, getModel, selectedModel, setSelectedModel, handleSaveConfirmation }: ExternalAIConfigProps) {
  const aiProviderConfig = settings?.ai_provider || { use_external: false, api_key: '', base_url: '', model: '', provider: 'openai' };
  const [useExternal, setUseExternal] = useState(aiProviderConfig.use_external || false);
  const [externalApiKey, setExternalApiKey] = useState('');
  const [externalBaseUrl, setExternalBaseUrl] = useState(aiProviderConfig.base_url || '');
  const [externalModel, setExternalModel] = useState(aiProviderConfig.model || '');
  const [provider, setProvider] = useState(aiProviderConfig.provider || 'openai');
  const [showExtKey, setShowExtKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savedKey = aiProviderConfig.api_key || '';

  const handleProviderChange = (p: string) => {
    setProvider(p);
    setExternalBaseUrl(PROVIDER_URLS[p] || '');
    const models = PROVIDER_MODELS[p];
    if (models?.length) setExternalModel(models[0].value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertSetting.mutateAsync({
        key: 'ai_provider',
        value: {
          use_external: useExternal,
          provider,
          api_key: externalApiKey.trim() || savedKey,
          base_url: provider === 'google' ? '' : externalBaseUrl.trim(),
          model: externalModel.trim(),
        },
      });
      if (externalApiKey.trim()) setExternalApiKey('');
      toast.success('Configuration IA sauvegardée');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            Agent IA
          </CardTitle>
          <CardDescription>Configurez votre fournisseur IA externe (OpenAI, Gemini, Groq)</CardDescription>
        </div>
        <Switch checked={useExternal} onCheckedChange={setUseExternal} />
      </CardHeader>
      <CardContent className="space-y-4">

        {useExternal && (
          <div className="space-y-4 p-4 rounded-lg border border-dashed">
            {/* Provider selector */}
            <div className="space-y-2">
              <Label>Provider / Fournisseur</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger className="w-full md:w-[400px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* URL field - hidden for Google Gemini */}
            {provider !== 'google' && (
              <div className="space-y-2">
                <Label>URL de base de l'API</Label>
                <Input
                  value={externalBaseUrl}
                  onChange={(e) => setExternalBaseUrl(e.target.value)}
                  placeholder={PROVIDER_URLS[provider] || 'https://api.openai.com/v1/chat/completions'}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Compatible OpenAI, Groq, Together, Mistral, etc.</p>
              </div>
            )}

            {/* API Key */}
            <div className="space-y-2">
              <Label>Clé API</Label>
              {savedKey && !externalApiKey && (
                <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                  <span className="text-xs font-mono flex-1">
                    {showExtKey ? savedKey : '••••••••••••' + savedKey.slice(-6)}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setShowExtKey(!showExtKey)}>
                    {showExtKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              <Input
                type="password"
                value={externalApiKey}
                onChange={(e) => setExternalApiKey(e.target.value)}
                placeholder={savedKey ? "Entrez une nouvelle clé pour remplacer..." : (provider === 'google' ? 'AIza...' : 'sk-...')}
                className="font-mono text-sm"
              />
              {provider === 'google' && (
                <p className="text-xs text-muted-foreground">
                  Obtenez votre clé API gratuite sur : <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">ai.google.dev</a> 🆓
                </p>
              )}
            </div>

            {/* Model selector */}
            <div className="space-y-2">
              <Label>Nom du modèle</Label>
              <Select value={externalModel} onValueChange={setExternalModel}>
                <SelectTrigger className="w-full md:w-[400px]">
                  <SelectValue placeholder="Sélectionnez un modèle" />
                </SelectTrigger>
                <SelectContent>
                  {(PROVIDER_MODELS[provider] || []).map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        {m.desc && <span className="text-xs text-muted-foreground">{m.desc}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder la configuration IA
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
