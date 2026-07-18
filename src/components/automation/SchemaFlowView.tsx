import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  GitBranch, ShoppingCart, Bot, MessageCircle, Send, CheckCircle2,
  ArrowDown, Phone, Truck, Package, Users, FileText,
  Zap, HelpCircle, ChevronDown, ChevronRight, Pencil, X, Check,
  ArrowRight, Sparkles, Shield, Clock, Settings2, Save
} from 'lucide-react';
import { useAutomationSettings, useUpsertAutomationSetting } from '@/hooks/useAutomationSettings';
import { toast } from 'sonner';

interface StepAction {
  id: string;
  label: string;
  type: 'toggle' | 'select' | 'text' | 'textarea' | 'number';
  options?: { value: string; label: string }[];
  settingKey: string;
  defaultValue: any;
  placeholder?: string;
  hint?: string;
}

interface FlowStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
  badge?: string;
  badgeColor?: string;
  actions?: StepAction[];
  branches?: {
    label: string;
    color: string;
    dotColor: string;
    steps: FlowStep[];
  }[];
}

function ActionEditor({ 
  actions, 
  settings, 
  onSave 
}: { 
  actions: StepAction[]; 
  settings: Record<string, any>;
  onSave: (key: string, value: any) => void;
}) {
  const [localValues, setLocalValues] = useState<Record<string, any>>(() => {
    const vals: Record<string, any> = {};
    actions.forEach(a => {
      const saved = settings[a.settingKey];
      vals[a.settingKey] = saved !== undefined ? (typeof saved === 'string' ? saved : JSON.stringify(saved) === JSON.stringify(a.defaultValue) ? a.defaultValue : saved) : a.defaultValue;
    });
    return vals;
  });

  const handleChange = (key: string, value: any) => {
    setLocalValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    onSave(key, localValues[key]);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-dashed border-border/50 mt-3" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        <Settings2 className="h-3 w-3" />
        Configuration
      </div>
      {actions.map(action => (
        <div key={action.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">{action.label}</Label>
            {action.type !== 'toggle' && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 text-[10px] gap-1 px-2"
                onClick={() => handleSave(action.settingKey)}
              >
                <Save className="h-2.5 w-2.5" /> Sauvegarder
              </Button>
            )}
          </div>
          {action.hint && (
            <p className="text-[10px] text-muted-foreground/70">{action.hint}</p>
          )}
          
          {action.type === 'toggle' && (
            <div className="flex items-center gap-2">
              <Switch
                checked={localValues[action.settingKey] === true || localValues[action.settingKey] === 'true'}
                onCheckedChange={(checked) => {
                  handleChange(action.settingKey, checked);
                  onSave(action.settingKey, checked);
                }}
              />
              <span className="text-[11px] text-muted-foreground">
                {(localValues[action.settingKey] === true || localValues[action.settingKey] === 'true') ? 'Activé' : 'Désactivé'}
              </span>
            </div>
          )}

          {action.type === 'select' && (
            <Select
              value={String(localValues[action.settingKey] || action.defaultValue)}
              onValueChange={(v) => {
                handleChange(action.settingKey, v);
                onSave(action.settingKey, v);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {action.options?.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {action.type === 'text' && (
            <Input
              value={String(localValues[action.settingKey] || '')}
              onChange={e => handleChange(action.settingKey, e.target.value)}
              placeholder={action.placeholder}
              className="h-8 text-xs"
            />
          )}

          {action.type === 'textarea' && (
            <Textarea
              value={String(localValues[action.settingKey] || '')}
              onChange={e => handleChange(action.settingKey, e.target.value)}
              placeholder={action.placeholder}
              className="text-xs min-h-[60px] resize-none"
              rows={3}
            />
          )}

          {action.type === 'number' && (
            <Input
              type="number"
              value={localValues[action.settingKey] || ''}
              onChange={e => handleChange(action.settingKey, Number(e.target.value))}
              placeholder={action.placeholder}
              className="h-8 text-xs w-32"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FlowNode({ 
  step, 
  isLast, 
  depth = 0,
  configOpen,
  onToggleConfig,
  settings,
  onSaveSetting,
}: { 
  step: FlowStep; 
  isLast?: boolean; 
  depth?: number;
  configOpen: string | null;
  onToggleConfig: (id: string) => void;
  settings: Record<string, any>;
  onSaveSetting: (key: string, value: any) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasBranches = step.branches && step.branches.length > 0;
  const hasActions = step.actions && step.actions.length > 0;
  const isConfigOpen = configOpen === step.id;
  const isRoot = depth === 0;

  return (
    <div className="flex flex-col items-center w-full">
      <div className={`group relative w-full ${isRoot ? 'max-w-lg' : 'max-w-sm'}`}>
        {/* Glow */}
        <div className={`absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm ${step.gradient}`} />
        
        <div
          className={`relative border rounded-2xl p-4 transition-all duration-300 bg-card hover:shadow-xl ${
            isConfigOpen ? 'ring-2 ring-primary/50 shadow-lg border-primary/30' : 'hover:border-primary/30'
          } ${hasBranches ? 'cursor-pointer' : ''}`}
          onClick={() => hasBranches && !isConfigOpen && setExpanded(!expanded)}
        >
          <div className="flex items-start gap-3">
            <div className={`shrink-0 rounded-xl p-2.5 ${step.iconBg}`}>
              {step.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-foreground leading-tight">{step.title}</h4>
                {step.badge && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-none font-bold ${step.badgeColor || 'bg-muted text-muted-foreground'}`}>
                    {step.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {hasActions && (
                <button
                  className={`p-1.5 rounded-lg transition-all ${isConfigOpen ? 'bg-primary/10 text-primary' : 'opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground'}`}
                  onClick={e => { e.stopPropagation(); onToggleConfig(step.id); }}
                  title="Configurer cette étape"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              )}
              {hasBranches && (
                <div className="text-muted-foreground ml-1">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              )}
            </div>
          </div>

          {/* Inline config panel */}
          {isConfigOpen && hasActions && (
            <ActionEditor 
              actions={step.actions!} 
              settings={settings} 
              onSave={onSaveSetting} 
            />
          )}

          {/* Step number */}
          {isRoot && (
            <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shadow-md">
              {step.id === 'new_order' ? '1' : step.id === 'ai_check' ? '2' : step.id === 'template_check' ? '3' : step.id === 'wa_send' ? '4' : step.id === 'client_response' ? '5' : step.id === 'confirmed' ? '6' : step.id === 'assign' ? '7' : '8'}
            </div>
          )}
        </div>
      </div>

      {/* Branches */}
      {hasBranches && expanded && (
        <div className="w-full mt-2 animate-fade-in">
          <div className="flex justify-center">
            <div className="w-px h-5 bg-gradient-to-b from-border to-transparent" />
          </div>
          <div className={`grid gap-3 ${
            step.branches!.length === 2 ? 'grid-cols-2' : 
            step.branches!.length === 3 ? 'grid-cols-3' : 'grid-cols-1'
          }`}>
            {step.branches!.map((branch, bi) => (
              <div key={bi} className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`w-2 h-2 rounded-full ${branch.dotColor}`} />
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${branch.color}`}>
                    {branch.label}
                  </span>
                </div>
                <div className="w-px h-3 bg-border mb-2" />
                <div className="flex flex-col items-center gap-2 w-full">
                  {branch.steps.map((bs, bsi) => (
                    <div key={bs.id} className="w-full">
                      <FlowNode 
                        step={bs} 
                        isLast={bsi === branch.steps.length - 1} 
                        depth={depth + 1}
                        configOpen={configOpen}
                        onToggleConfig={onToggleConfig}
                        settings={settings}
                        onSaveSetting={onSaveSetting}
                      />
                      {bsi < branch.steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <ArrowDown className="h-3 w-3 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connector */}
      {!isLast && isRoot && (
        <div className="flex flex-col items-center py-1">
          <div className="w-px h-4 bg-gradient-to-b from-border via-primary/20 to-border" />
          <ArrowDown className="h-3.5 w-3.5 text-primary/40 -mt-0.5" />
        </div>
      )}
    </div>
  );
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: 'new_order',
    icon: <ShoppingCart className="h-5 w-5 text-primary" />,
    title: '📦 Nouvelle commande',
    description: 'Détection automatique des commandes au statut "Nouveau"',
    gradient: 'bg-gradient-to-r from-primary/20 to-primary/5',
    iconBg: 'bg-primary/10',
    badge: 'Trigger',
    badgeColor: 'bg-primary/10 text-primary',
    actions: [
      { id: 'auto_trigger', label: 'Déclencher automatiquement', type: 'toggle', settingKey: 'schema_auto_trigger', defaultValue: true, hint: 'Lancer le flux dès qu\'une commande arrive' },
      { id: 'trigger_delay', label: 'Délai avant déclenchement (secondes)', type: 'number', settingKey: 'schema_trigger_delay', defaultValue: 0, placeholder: '0' },
      { id: 'source_filter', label: 'Filtrer par source', type: 'select', settingKey: 'schema_source_filter', defaultValue: 'all', options: [
        { value: 'all', label: 'Toutes les sources' },
        { value: 'facebook', label: 'Facebook uniquement' },
        { value: 'instagram', label: 'Instagram uniquement' },
        { value: 'website', label: 'Site web uniquement' },
        { value: 'phone', label: 'Téléphone uniquement' },
      ]},
    ],
  },
  {
    id: 'ai_check',
    icon: <Shield className="h-5 w-5 text-chart-5" />,
    title: '🤖 Vérification IA',
    description: 'Vérifie stock, téléphone, statut client et si la confirmation auto est activée',
    gradient: 'bg-gradient-to-r from-chart-5/20 to-chart-5/5',
    iconBg: 'bg-chart-5/10',
    badge: 'Décision',
    badgeColor: 'bg-chart-5/10 text-chart-5',
    actions: [
      { id: 'check_stock', label: 'Vérifier le stock', type: 'toggle', settingKey: 'schema_check_stock', defaultValue: true, hint: 'Annuler si produit en rupture' },
      { id: 'check_phone', label: 'Vérifier le numéro WhatsApp', type: 'toggle', settingKey: 'schema_check_phone', defaultValue: true, hint: 'Vérifier si le numéro est un mobile valide' },
      { id: 'check_blacklist', label: 'Vérifier la blacklist client', type: 'toggle', settingKey: 'schema_check_blacklist', defaultValue: true },
      { id: 'check_duplicate', label: 'Détecter les doublons', type: 'toggle', settingKey: 'schema_check_duplicate', defaultValue: true, hint: 'Bloquer si commande similaire récente' },
    ],
    branches: [
      {
        label: '❌ Non', color: 'bg-destructive/10 text-destructive', dotColor: 'bg-destructive',
        steps: [{
          id: 'manual_assign',
          icon: <Users className="h-4 w-4 text-muted-foreground" />,
          title: 'Attribution manuelle',
          description: 'L\'agent traite la commande manuellement',
          gradient: '', iconBg: 'bg-muted',
          actions: [
            { id: 'manual_action', label: 'Action en cas d\'échec', type: 'select', settingKey: 'schema_manual_action', defaultValue: 'assign', options: [
              { value: 'assign', label: 'Assigner à un agent' },
              { value: 'notify', label: 'Notifier l\'admin seulement' },
              { value: 'hold', label: 'Mettre en attente' },
            ]},
          ],
        }],
      },
      {
        label: '✅ Oui', color: 'bg-success/10 text-success', dotColor: 'bg-success',
        steps: [{
          id: 'trigger_confirm',
          icon: <Zap className="h-4 w-4 text-warning" />,
          title: '⚡ Auto-confirm',
          description: 'Processus de confirmation lancé',
          gradient: '', iconBg: 'bg-warning/10',
        }],
      },
    ],
  },
  {
    id: 'template_check',
    icon: <FileText className="h-5 w-5 text-chart-6" />,
    title: '📝 Source du message',
    description: 'Priorité: Template AR → Template FR → Génération IA',
    gradient: 'bg-gradient-to-r from-chart-6/20 to-chart-6/5',
    iconBg: 'bg-chart-6/10',
    badge: 'Décision',
    badgeColor: 'bg-chart-6/10 text-chart-6',
    actions: [
      { id: 'msg_priority', label: 'Langue prioritaire', type: 'select', settingKey: 'schema_msg_priority', defaultValue: 'ar', options: [
        { value: 'ar', label: '🇩🇿 Arabe d\'abord' },
        { value: 'fr', label: '🇫🇷 Français d\'abord' },
        { value: 'ai', label: '🤖 IA toujours' },
      ]},
      { id: 'ai_model', label: 'Modèle IA pour génération', type: 'select', settingKey: 'schema_ai_model', defaultValue: 'gemini-flash', options: [
        { value: 'gemini-flash', label: 'Gemini 2.5 Flash (rapide)' },
        { value: 'gemini-pro', label: 'Gemini 2.5 Pro (précis)' },
        { value: 'gpt5-mini', label: 'GPT-5 Mini' },
        { value: 'lovable', label: 'Lovable AI (fallback)' },
      ]},
    ],
    branches: [
      {
        label: '🇩🇿 Arabe', color: 'bg-success/10 text-success', dotColor: 'bg-success',
        steps: [{
          id: 'tpl_ar',
          icon: <FileText className="h-4 w-4 text-success" />,
          title: 'Template Arabe',
          description: 'Message en arabe dialectal algérien',
          gradient: '', iconBg: 'bg-success/10',
          actions: [
            { id: 'tpl_ar_content', label: 'Contenu du template arabe', type: 'textarea', settingKey: 'schema_tpl_ar_content', defaultValue: '', placeholder: 'مرحبا {name}، طلبك {order} جاهز...' },
          ],
        }],
      },
      {
        label: '🇫🇷 Français', color: 'bg-chart-6/10 text-chart-6', dotColor: 'bg-chart-6',
        steps: [{
          id: 'tpl_fr',
          icon: <FileText className="h-4 w-4 text-chart-6" />,
          title: 'Template Français',
          description: 'Message en français',
          gradient: '', iconBg: 'bg-chart-6/10',
          actions: [
            { id: 'tpl_fr_content', label: 'Contenu du template français', type: 'textarea', settingKey: 'schema_tpl_fr_content', defaultValue: '', placeholder: 'Bonjour {name}, votre commande {order}...' },
          ],
        }],
      },
      {
        label: '🤖 IA', color: 'bg-chart-5/10 text-chart-5', dotColor: 'bg-chart-5',
        steps: [{
          id: 'ai_gen',
          icon: <Sparkles className="h-4 w-4 text-chart-5" />,
          title: 'Génération IA',
          description: 'Le modèle IA génère le message personnalisé',
          gradient: '', iconBg: 'bg-chart-5/10',
          actions: [
            { id: 'ai_system_prompt', label: 'System prompt IA', type: 'textarea', settingKey: 'schema_ai_system_prompt', defaultValue: '', placeholder: 'Tu es un assistant commercial...' },
          ],
        }],
      },
    ],
  },
  {
    id: 'wa_send',
    icon: <Send className="h-5 w-5 text-success" />,
    title: '💬 Envoi WhatsApp + Poll',
    description: 'Message + sondage envoyé via WaSender',
    gradient: 'bg-gradient-to-r from-success/20 to-success/5',
    iconBg: 'bg-success/10',
    badge: 'WhatsApp',
    badgeColor: 'bg-success/10 text-success',
    actions: [
      { id: 'send_poll', label: 'Envoyer un sondage de confirmation', type: 'toggle', settingKey: 'schema_send_poll', defaultValue: true },
      { id: 'poll_question', label: 'Question du sondage', type: 'text', settingKey: 'schema_poll_question', defaultValue: 'يرجى الرد بـ:', placeholder: 'يرجى الرد بـ:' },
      { id: 'poll_delay', label: 'Délai entre message et poll (secondes)', type: 'number', settingKey: 'schema_poll_delay', defaultValue: 3, placeholder: '3' },
    ],
  },
  {
    id: 'client_response',
    icon: <MessageCircle className="h-5 w-5 text-warning" />,
    title: '📊 Réponse client',
    description: 'Le client vote dans le sondage WhatsApp',
    gradient: 'bg-gradient-to-r from-warning/20 to-warning/5',
    iconBg: 'bg-warning/10',
    badge: 'Décision',
    badgeColor: 'bg-warning/10 text-warning',
    actions: [
      { id: 'timeout', label: 'Délai d\'attente max (minutes)', type: 'number', settingKey: 'schema_response_timeout', defaultValue: 120, placeholder: '120' },
      { id: 'timeout_action', label: 'Action si pas de réponse', type: 'select', settingKey: 'schema_timeout_action', defaultValue: 'assign', options: [
        { value: 'assign', label: 'Assigner à un agent' },
        { value: 'resend', label: 'Renvoyer le message' },
        { value: 'cancel', label: 'Annuler la commande' },
      ]},
      { id: 'max_retries', label: 'Nombre max de relances', type: 'number', settingKey: 'schema_max_retries', defaultValue: 1, placeholder: '1' },
    ],
    branches: [
      {
        label: '✅ Confirmé', color: 'bg-success/10 text-success', dotColor: 'bg-success',
        steps: [{
          id: 'poll2',
          icon: <Truck className="h-4 w-4 text-chart-6" />,
          title: 'Poll 2: Livraison',
          description: 'Domicile ou Stop Desk',
          gradient: '', iconBg: 'bg-chart-6/10',
          actions: [
            { id: 'ask_delivery', label: 'Demander le type de livraison', type: 'toggle', settingKey: 'schema_ask_delivery_type', defaultValue: true, hint: 'Si désactivé, utilise le type par défaut' },
            { id: 'default_delivery', label: 'Type par défaut', type: 'select', settingKey: 'schema_default_delivery', defaultValue: 'home', options: [
              { value: 'home', label: '🏠 Domicile' },
              { value: 'stop_desk', label: '📦 Stop Desk' },
            ]},
          ],
          branches: [
            {
              label: '🏠 Domicile', color: 'bg-success/10 text-success', dotColor: 'bg-success',
              steps: [{
                id: 'home',
                icon: <Truck className="h-4 w-4 text-success" />,
                title: 'Livraison domicile',
                description: 'Tarif domicile appliqué',
                gradient: '', iconBg: 'bg-success/10',
              }],
            },
            {
              label: '📦 Stop Desk', color: 'bg-chart-6/10 text-chart-6', dotColor: 'bg-chart-6',
              steps: [{
                id: 'stopdesk',
                icon: <Package className="h-4 w-4 text-chart-6" />,
                title: 'Stop Desk',
                description: 'Choix du bureau de livraison',
                gradient: '', iconBg: 'bg-chart-6/10',
                actions: [
                  { id: 'ask_bureau', label: 'Demander le choix du bureau', type: 'toggle', settingKey: 'schema_ask_bureau', defaultValue: true },
                ],
              }],
            },
          ],
        }],
      },
      {
        label: '💬 Questions', color: 'bg-warning/10 text-warning', dotColor: 'bg-warning',
        steps: [
          {
            id: 'ai_reply',
            icon: <Bot className="h-4 w-4 text-chart-5" />,
            title: 'IA contextuelle',
            description: 'L\'IA répond aux questions du client',
            gradient: '', iconBg: 'bg-chart-5/10',
            actions: [
              { id: 'ai_reply_enabled', label: 'Répondre automatiquement', type: 'toggle', settingKey: 'schema_ai_reply_enabled', defaultValue: true },
              { id: 'max_ai_replies', label: 'Max réponses IA par conversation', type: 'number', settingKey: 'schema_max_ai_replies', defaultValue: 3, placeholder: '3' },
            ],
          },
        ],
      },
      {
        label: '📞 Agent', color: 'bg-chart-6/10 text-chart-6', dotColor: 'bg-chart-6',
        steps: [{
          id: 'contact_agent',
          icon: <Phone className="h-4 w-4 text-chart-6" />,
          title: 'Assigner à agent',
          description: 'Notification envoyée à l\'agent',
          gradient: '', iconBg: 'bg-chart-6/10',
          actions: [
            { id: 'notify_method', label: 'Méthode de notification', type: 'select', settingKey: 'schema_notify_method', defaultValue: 'app', options: [
              { value: 'app', label: '🔔 Notification in-app' },
              { value: 'whatsapp', label: '💬 WhatsApp' },
              { value: 'both', label: '🔔+💬 Les deux' },
            ]},
          ],
        }],
      },
    ],
  },
  {
    id: 'confirmed',
    icon: <CheckCircle2 className="h-5 w-5 text-success" />,
    title: '✅ Commande confirmée',
    description: 'Statut → "Confirmé", frais de livraison calculés',
    gradient: 'bg-gradient-to-r from-success/20 to-success/5',
    iconBg: 'bg-success/10',
    badge: 'Statut',
    badgeColor: 'bg-success/10 text-success',
    actions: [
      { id: 'auto_calc_fees', label: 'Calculer frais de livraison auto', type: 'toggle', settingKey: 'schema_auto_calc_fees', defaultValue: true },
      { id: 'send_confirmation_msg', label: 'Envoyer message de confirmation', type: 'toggle', settingKey: 'schema_send_confirmation_msg', defaultValue: true, hint: 'Envoyer un message WhatsApp au client après confirmation' },
    ],
  },
  {
    id: 'assign',
    icon: <Users className="h-5 w-5 text-chart-5" />,
    title: '👤 Attribution agent',
    description: 'Round Robin, charge de travail ou règles personnalisées',
    gradient: 'bg-gradient-to-r from-chart-5/20 to-chart-5/5',
    iconBg: 'bg-chart-5/10',
    actions: [
      { id: 'assign_mode', label: 'Mode d\'attribution', type: 'select', settingKey: 'schema_assign_mode', defaultValue: 'round_robin', options: [
        { value: 'round_robin', label: '🔄 Round Robin' },
        { value: 'workload', label: '⚖️ Charge de travail' },
        { value: 'rules', label: '📋 Règles personnalisées' },
        { value: 'combined', label: '🔀 Combiné' },
      ]},
      { id: 'auto_assign', label: 'Attribution automatique', type: 'toggle', settingKey: 'schema_auto_assign', defaultValue: true },
    ],
  },
  {
    id: 'log',
    icon: <FileText className="h-5 w-5 text-muted-foreground" />,
    title: '📋 Log & Historique',
    description: 'Conversation et historique de commande enregistrés',
    gradient: 'bg-gradient-to-r from-muted/50 to-transparent',
    iconBg: 'bg-muted',
    badge: 'Fin',
    badgeColor: 'bg-muted text-muted-foreground',
    actions: [
      { id: 'log_conversation', label: 'Enregistrer les conversations', type: 'toggle', settingKey: 'schema_log_conversation', defaultValue: true },
      { id: 'log_ai_details', label: 'Enregistrer les détails IA', type: 'toggle', settingKey: 'schema_log_ai_details', defaultValue: true, hint: 'Prompt, réponse et tokens utilisés' },
    ],
  },
];

const AI_CHAIN = [
  { name: 'Provider externe', desc: 'Gemini / OpenAI / Groq', icon: '🔌', timeout: '15s', gradient: 'from-chart-5/20 to-chart-5/5', border: 'border-chart-5/20', num: '1' },
  { name: 'Lovable AI', desc: 'Fallback intégré', icon: '⚡', timeout: '15s', gradient: 'from-warning/20 to-warning/5', border: 'border-warning/20', num: '2' },
  { name: 'Message statique', desc: 'Fallback final', icon: '📄', timeout: '10s', gradient: 'from-muted/50 to-transparent', border: 'border-border', num: '3' },
];

const VARIABLES = [
  { var: '{name}', desc: 'Nom du client', icon: '👤' },
  { var: '{order}', desc: 'N° commande', icon: '📋' },
  { var: '{products}', desc: 'Liste produits', icon: '📦' },
  { var: '{total}', desc: 'Total en DA', icon: '💰' },
  { var: '{delivery_fee}', desc: 'Frais livraison', icon: '🚚' },
  { var: '{wilaya}', desc: 'Wilaya', icon: '📍' },
  { var: '{address}', desc: 'Adresse', icon: '🏠' },
  { var: '{tracking}', desc: 'N° suivi', icon: '🔍' },
  { var: '{delivery_type}', desc: 'Type livraison', icon: '📤' },
  { var: '{delivery_home}', desc: 'Prix domicile', icon: '🏡' },
  { var: '{delivery_desk}', desc: 'Prix stop desk', icon: '📬' },
  { var: '{delivery_company}', desc: 'Société', icon: '🏢' },
];

export default function SchemaFlowView() {
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const { data: settings = {} } = useAutomationSettings();
  const upsertSetting = useUpsertAutomationSetting();

  const onToggleConfig = useCallback((id: string) => {
    setConfigOpen(prev => prev === id ? null : id);
  }, []);

  const onSaveSetting = useCallback((key: string, value: any) => {
    upsertSetting.mutate({ key, value });
  }, [upsertSetting]);

  return (
    <div className="space-y-6">
      {/* Main Flow */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-chart-5/5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10">
                  <GitBranch className="h-5 w-5 text-primary" />
                </div>
                Flux de confirmation automatique
              </CardTitle>
              <CardDescription className="mt-1.5">
                Cliquez sur ⚙️ pour configurer chaque étape • Cliquez sur les nœuds pour développer
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              8 étapes
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col items-center gap-0 pl-4">
            {FLOW_STEPS.map((step, i) => (
              <FlowNode 
                key={step.id} 
                step={step} 
                isLast={i === FLOW_STEPS.length - 1}
                configOpen={configOpen}
                onToggleConfig={onToggleConfig}
                settings={settings}
                onSaveSetting={onSaveSetting}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Provider Chain */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-chart-5/5 via-transparent to-warning/5 border-b">
          <CardTitle className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-chart-5/10">
              <Bot className="h-5 w-5 text-chart-5" />
            </div>
            Chaîne de fallback IA
          </CardTitle>
          <CardDescription>Ordre de priorité des fournisseurs pour la génération de messages</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {AI_CHAIN.map((provider, i) => (
              <div key={i} className="flex items-center gap-3 flex-1">
                <div className={`flex-1 rounded-2xl border ${provider.border} bg-gradient-to-br ${provider.gradient} p-5 text-center relative overflow-hidden group hover:shadow-lg transition-shadow`}>
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-foreground/5 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {provider.num}
                  </div>
                  <div className="text-3xl mb-2">{provider.icon}</div>
                  <h4 className="font-bold text-sm text-foreground">{provider.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{provider.desc}</p>
                  <div className="flex items-center justify-center gap-1 mt-3">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground font-medium">{provider.timeout}</span>
                  </div>
                </div>
                {i < AI_CHAIN.length - 1 && (
                  <div className="hidden sm:flex text-muted-foreground/30">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Variables Reference */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border-b">
          <CardTitle className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-muted">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            Variables disponibles
          </CardTitle>
          <CardDescription>Utilisez ces variables dans vos templates de messages</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {VARIABLES.map(v => (
              <div key={v.var} className="group flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 hover:border-primary/30 hover:shadow-sm transition-all cursor-default">
                <span className="text-base">{v.icon}</span>
                <div className="min-w-0">
                  <code className="text-xs font-mono font-bold text-primary block">{v.var}</code>
                  <span className="text-[10px] text-muted-foreground leading-none">{v.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
