import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

const LOVABLE_AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', desc: 'Rapide et intelligent (Recommandé)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Équilibré - bon rapport qualité/prix' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', desc: 'Ultra rapide, économique' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Très puissant, meilleure qualité' },
  { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview', desc: 'Dernière génération' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', desc: 'OpenAI - bon rapport qualité/prix' },
  { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano', desc: 'OpenAI - ultra rapide' },
  { value: 'openai/gpt-5', label: 'GPT-5', desc: 'OpenAI - le plus puissant' },
];

export default function LovableAIConfig({ settings, upsertSetting }: { settings: any; upsertSetting: any }) {
  const lovableConfig = settings?.lovable_ai || { enabled: false, model: 'google/gemini-3-flash-preview' };
  const [enabled, setEnabled] = useState(lovableConfig.enabled || false);
  const [model, setModel] = useState(lovableConfig.model || 'google/gemini-3-flash-preview');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings?.lovable_ai) {
      setEnabled(settings.lovable_ai.enabled || false);
      setModel(settings.lovable_ai.model || 'google/gemini-3-flash-preview');
    }
  }, [settings?.lovable_ai]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertSetting.mutateAsync({
        key: 'lovable_ai',
        value: { enabled, model },
      });
      toast.success('Configuration Lovable AI sauvegardée');
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
            <Zap className="h-5 w-5 text-amber-500" />
            Lovable AI
          </CardTitle>
          <CardDescription>IA intégrée sans clé API. Utilisée comme fallback ou en mode principal.</CardDescription>
        </div>
        <Switch checked={enabled} onCheckedChange={async (val) => {
          setEnabled(val);
          try {
            await upsertSetting.mutateAsync({
              key: 'lovable_ai',
              value: { enabled: val, model },
            });
            toast.success(val ? 'Lovable AI activé' : 'Lovable AI désactivé');
          } catch (e: any) {
            toast.error(e.message || 'Erreur');
            setEnabled(!val);
          }
        }} />
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modèle IA</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Choisir un modèle" />
              </SelectTrigger>
              <SelectContent>
                {LOVABLE_AI_MODELS.map(m => (
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
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              💡 Si un <strong>Agent IA externe</strong> est activé, Lovable AI sera utilisé comme <strong>fallback</strong> en cas d'erreur. Sinon, il sera le fournisseur principal.
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Sauvegarder
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
