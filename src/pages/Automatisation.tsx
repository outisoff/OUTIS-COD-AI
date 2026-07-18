import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bot, MessageSquare, MessageCircle, Bell, Settings, Play, Loader2, Save,
  CheckCircle2, XCircle, Clock, AlertCircle, Send, Zap, Key, Eye, EyeOff, User,
  GitBranch, ArrowDown, ArrowRight, Phone, MessageSquareText, Truck, Package, Radio
} from 'lucide-react';
import SchemaFlowView from '@/components/automation/SchemaFlowView';
import {
  useAutomationSettings,
  useUpsertAutomationSetting,
  useAutoConfirmationLogs,
  DEFAULT_CONFIRMATION_SYSTEM_PROMPT,
  DEFAULT_REPLY_SYSTEM_PROMPT,
  DEFAULT_TRACKING_MESSAGES,
  DEFAULT_TRACKING_MESSAGES_AR,
  ALL_TRACKING_STATUSES,
  ALL_SITUATION_STATUSES,
  SITUATION_LABELS,
  DEFAULT_SITUATION_MESSAGES,
  DEFAULT_SITUATION_MESSAGES_AR,
  RJ360_SITUATION_STATUSES,
  RJ360_SITUATION_LABELS,
  DEFAULT_RJ360_MESSAGES,
  DEFAULT_RJ360_MESSAGES_AR,
  ZR_SITUATION_STATUSES,
  ZR_SITUATION_LABELS,
  DEFAULT_ZR_MESSAGES,
  DEFAULT_ZR_MESSAGES_AR,
  ZR_STATE_STATUSES,
  ZR_STATE_LABELS,
  DEFAULT_ZR_STATE_MESSAGES,
  DEFAULT_ZR_STATE_MESSAGES_AR,
  LOCAL_SITUATION_STATUSES,
  LOCAL_SITUATION_LABELS,
  DEFAULT_LOCAL_MESSAGES,
  DEFAULT_LOCAL_MESSAGES_AR,
} from '@/hooks/useAutomationSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmé',
  preparing: 'En préparation',
  ready: 'Prêt',
  shipped: 'Expédié',
  to_station: 'Vers station',
  at_station: 'En station',
  au_bureau: 'Au bureau',
  en_livraison: 'En livraison',
  delivered: 'Livré',
  'Échec_de_livraison': 'Échec de livraison',
  cancelled: 'Annulé',
  failed_1: 'Échoué 1',
  failed_2: 'Échoué 2',
  failed_3: 'Échoué 3',
  failed_4: 'Échoué 4',
  failed_5: 'Échoué 5',
};

const AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (Rapide)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Équilibré)' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Ultra rapide)' },
  { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Puissant)' },
  { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro (Dernière génération)' },
  { value: 'google/gemini-2.0-pro', label: 'Gemini 2.0 Pro' },
];

import AutomationChatPanel from '@/components/automation/AutomationChatPanel';
import ExternalAIConfig from '@/components/automation/ExternalAIConfig';
import LovableAIConfig from '@/components/automation/LovableAIConfig';





export default function Automatisation() {
  const { subPage } = useParams();
  const navigate = useNavigate();
  const currentPage = subPage || 'confirmation-ia';
  const { data: settings, isLoading } = useAutomationSettings();
  const { data: logs, isLoading: logsLoading } = useAutoConfirmationLogs();
  const upsertSetting = useUpsertAutomationSetting();

  const [isRunning, setIsRunning] = useState(false);
  const [wasenderApiKey, setWasenderApiKey] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [savedApiKeyExists, setSavedApiKeyExists] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedApiKey, setSavedApiKey] = useState('');
  const [savedTokenExists, setSavedTokenExists] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [savedToken, setSavedToken] = useState('');

  // Load saved API key and webhook token from settings
  useEffect(() => {
    if (settings?.wasender_config) {
      const key = (settings.wasender_config as any)?.api_key || '';
      if (key) {
        setSavedApiKeyExists(true);
        setSavedApiKey(key);
      }
    }
    if (settings?.webhook_verify_token) {
      const token = (settings.webhook_verify_token as any)?.token || '';
      if (token) {
        setSavedToken(token);
        setSavedTokenExists(true);
        // Don't pre-fill the input - keep it empty
      }
    }
  }, [settings]);

  // Confirmation settings
  const confirmationConfig = settings?.confirmation || {
    enabled: false,
    system_prompt: DEFAULT_CONFIRMATION_SYSTEM_PROMPT,
    reply_system_prompt: DEFAULT_REPLY_SYSTEM_PROMPT,
    model: 'google/gemini-3-flash-preview',
  };

  // Tracking settings
  const trackingConfig = settings?.tracking_notifications || {
    enabled: false,
    statuses: ALL_TRACKING_STATUSES,
    custom_messages: DEFAULT_TRACKING_MESSAGES,
  };

  // Situation settings
  const situationConfig = settings?.situation_notifications || {
    enabled: false,
    situations: ALL_SITUATION_STATUSES,
    custom_messages: DEFAULT_SITUATION_MESSAGES,
  };

  const [confirmPrompt, setConfirmPrompt] = useState('');
  const [replyPrompt, setReplyPrompt] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [messageTemplateAr, setMessageTemplateAr] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionConfirm, setPollOptionConfirm] = useState('');
  const [pollOptionCancel, setPollOptionCancel] = useState('');
  const [expeditionTemplate, setExpeditionTemplate] = useState('');
  const [expeditionTemplateAr, setExpeditionTemplateAr] = useState('');
  const [avisTemplate, setAvisTemplate] = useState('');
  const [avisTemplateAr, setAvisTemplateAr] = useState('');
  const [deliveryTypeTemplate, setDeliveryTypeTemplate] = useState('');
  const [deliveryTypeTemplateAr, setDeliveryTypeTemplateAr] = useState('');
  const [deliveryTypePollQuestion, setDeliveryTypePollQuestion] = useState('');
  const [deliveryTypePollOptionHome, setDeliveryTypePollOptionHome] = useState('');
  const [deliveryTypePollOptionStopDesk, setDeliveryTypePollOptionStopDesk] = useState('');
  const [bureauTemplate, setBureauTemplate] = useState('');
  const [bureauTemplateAr, setBureauTemplateAr] = useState('');
  const [bureauPollQuestion, setBureauPollQuestion] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [trackingMessages, setTrackingMessages] = useState<Record<string, string>>({});
  const [trackingMessagesAr, setTrackingMessagesAr] = useState<Record<string, string>>({});
  const [trackingMessages2, setTrackingMessages2] = useState<Record<string, string>>({});
  const [trackingMessagesAr2, setTrackingMessagesAr2] = useState<Record<string, string>>({});
  const [enabledStatuses, setEnabledStatuses] = useState<string[]>([]);
  const [situationMessages, setSituationMessages] = useState<Record<string, string>>({});
  const [situationMessagesAr, setSituationMessagesAr] = useState<Record<string, string>>({});
  const [enabledSituations, setEnabledSituations] = useState<string[]>([]);

  // Initialize state from loaded settings
  const getConfirmPrompt = () => confirmPrompt || confirmationConfig.system_prompt || DEFAULT_CONFIRMATION_SYSTEM_PROMPT;
  const getReplyPrompt = () => replyPrompt || confirmationConfig.reply_system_prompt || DEFAULT_REPLY_SYSTEM_PROMPT;
  const DEFAULT_MESSAGE_TEMPLATE_FR = `Bonjour {name} 👋\n\nMerci pour votre commande ❤️\n\nVoici votre commande {order} :\n{products}\n\n💰 Total: {total} DA (livraison: {delivery_fee} DA)\n📍 {delivery_type} - {wilaya}\n📦 {address}\n\nMerci de choisir une option ci-dessous 👇`;
  const DEFAULT_MESSAGE_TEMPLATE_AR = `مرحباً {name} 👋\n\nشكراً لطلبك من متجرنا ❤️\n\nهذا هو طلبك {order} :\n{products}\n\n💰 المجموع: {total} دج (التوصيل: {delivery_fee} دج)\n📍 {delivery_type} - {wilaya}\n📦 {address}\n\nالرجاء اختيار أحد الخيارات أدناه 👇`;
  const getMessageTemplate = () => messageTemplate || (confirmationConfig as any).message_template || DEFAULT_MESSAGE_TEMPLATE_FR;
  const getMessageTemplateAr = () => messageTemplateAr || (confirmationConfig as any).message_template_ar || DEFAULT_MESSAGE_TEMPLATE_AR;
  const getPollQuestion = () => pollQuestion || (confirmationConfig as any).poll_question || 'يرجى الرد بـ:';
  const getPollOptionConfirm = () => pollOptionConfirm || (confirmationConfig as any).poll_option_confirm || '✅ نعم (لتأكيد الطلب)';
  const getPollOptionCancel = () => pollOptionCancel || (confirmationConfig as any).poll_option_cancel || '📞 تواصل مع الوكيل / Contacter un agent';
  const getExpeditionTemplate = () => expeditionTemplate || (settings?.expedition_template as any)?.template || '';
  const getExpeditionTemplateAr = () => expeditionTemplateAr || (settings?.expedition_template as any)?.template_ar || '';
  const getAvisTemplate = () => avisTemplate || (settings?.avis_template as any)?.template || '';
  const getAvisTemplateAr = () => avisTemplateAr || (settings?.avis_template as any)?.template_ar || '';
  const getDeliveryTypeTemplate = () => deliveryTypeTemplate || (settings?.delivery_type_template as any)?.template || '';
  const getDeliveryTypeTemplateAr = () => deliveryTypeTemplateAr || (settings?.delivery_type_template as any)?.template_ar || '';
  const getDeliveryTypePollQuestion = () => deliveryTypePollQuestion || (settings?.delivery_type_template as any)?.poll_question || '';
  const getDeliveryTypePollOptionHome = () => deliveryTypePollOptionHome || (settings?.delivery_type_template as any)?.poll_option_home || '🏠 Livraison à domicile / توصيل للبيت';
  const getDeliveryTypePollOptionStopDesk = () => deliveryTypePollOptionStopDesk || (settings?.delivery_type_template as any)?.poll_option_stop_desk || '📦 Stop Desk / نقطة استلام';
  const getBureauTemplate = () => bureauTemplate || (settings?.bureau_template as any)?.template || '';
  const getBureauTemplateAr = () => bureauTemplateAr || (settings?.bureau_template as any)?.template_ar || '';
  const getBureauPollQuestion = () => bureauPollQuestion || (settings?.bureau_template as any)?.poll_question || 'اختر مكتب التوصيل:';
  const getModel = () => selectedModel || confirmationConfig.model || 'google/gemini-3-flash-preview';
  const getTrackingMessages = () => ({ ...DEFAULT_TRACKING_MESSAGES, ...(trackingConfig.custom_messages || {}), ...trackingMessages });
  const getTrackingMessagesAr = () => ({ ...DEFAULT_TRACKING_MESSAGES_AR, ...(trackingConfig.custom_messages_ar || {}), ...trackingMessagesAr });
  const getTrackingMessages2 = () => ({ ...(trackingConfig.custom_messages_2 || {}), ...trackingMessages2 });
  const getTrackingMessagesAr2 = () => ({ ...(trackingConfig.custom_messages_ar_2 || {}), ...trackingMessagesAr2 });
  const getEnabledStatuses = () => enabledStatuses.length > 0 ? enabledStatuses : (trackingConfig.statuses || ALL_TRACKING_STATUSES);
  const getSituationMessages = () => ({ ...DEFAULT_SITUATION_MESSAGES, ...(situationConfig.custom_messages || {}), ...situationMessages });
  const getSituationMessagesAr = () => ({ ...DEFAULT_SITUATION_MESSAGES_AR, ...(situationConfig.custom_messages_ar || {}), ...situationMessagesAr });
  const getEnabledSituations = () => enabledSituations.length > 0 ? enabledSituations : (situationConfig.situations || ALL_SITUATION_STATUSES);

  const handleSaveConfirmation = async () => {
    await upsertSetting.mutateAsync({
      key: 'confirmation',
      value: {
        ...confirmationConfig,
        system_prompt: getConfirmPrompt(),
        reply_system_prompt: getReplyPrompt(),
        message_template: getMessageTemplate(),
        message_template_ar: getMessageTemplateAr(),
        model: getModel(),
        poll_question: getPollQuestion(),
        poll_option_confirm: getPollOptionConfirm(),
        poll_option_cancel: getPollOptionCancel(),
      },
    });
  };

  const handleToggleConfirmation = async (enabled: boolean) => {
    await upsertSetting.mutateAsync({
      key: 'confirmation',
      value: {
        ...confirmationConfig,
        enabled,
        system_prompt: getConfirmPrompt(),
        reply_system_prompt: getReplyPrompt(),
        message_template: getMessageTemplate(),
        model: getModel(),
      },
    });
  };

  const handleSaveTracking = async () => {
    await upsertSetting.mutateAsync({
      key: 'tracking_notifications',
      value: {
        ...trackingConfig,
        custom_messages: getTrackingMessages(),
        custom_messages_ar: getTrackingMessagesAr(),
        custom_messages_2: getTrackingMessages2(),
        custom_messages_ar_2: getTrackingMessagesAr2(),
        statuses: getEnabledStatuses(),
      },
    });
  };

  const handleToggleTracking = async (enabled: boolean) => {
    await upsertSetting.mutateAsync({
      key: 'tracking_notifications',
      value: {
        ...trackingConfig,
        enabled,
        custom_messages: getTrackingMessages(),
        custom_messages_ar: getTrackingMessagesAr(),
        custom_messages_2: getTrackingMessages2(),
        custom_messages_ar_2: getTrackingMessagesAr2(),
        statuses: getEnabledStatuses(),
      },
    });
  };

  const handleToggleStatus = (status: string, checked: boolean) => {
    const current = getEnabledStatuses();
    if (checked) {
      setEnabledStatuses([...current, status]);
    } else {
      setEnabledStatuses(current.filter(s => s !== status));
    }
  };

  const handleSaveSituation = async () => {
    await upsertSetting.mutateAsync({
      key: 'situation_notifications',
      value: {
        ...situationConfig,
        custom_messages: getSituationMessages(),
        custom_messages_ar: getSituationMessagesAr(),
        situations: getEnabledSituations(),
      },
    });
  };

  const handleToggleSituation = async (enabled: boolean) => {
    await upsertSetting.mutateAsync({
      key: 'situation_notifications',
      value: {
        ...situationConfig,
        enabled,
        custom_messages: getSituationMessages(),
        custom_messages_ar: getSituationMessagesAr(),
        situations: getEnabledSituations(),
      },
    });
  };

  const handleToggleSituationStatus = (situation: string, checked: boolean) => {
    const current = getEnabledSituations();
    if (checked) {
      setEnabledSituations([...current, situation]);
    } else {
      setEnabledSituations(current.filter(s => s !== situation));
    }
  };

  const getSituationIcon = (situation: string): { icon: React.ReactNode; color: string } => {
    const icons: Record<string, { icon: React.ReactNode; color: string }> = {
      // Preparation / pickup
      prete_a_expedier: { icon: <Package className="h-4 w-4" />, color: 'text-primary' },
      pret_a_expedier: { icon: <Package className="h-4 w-4" />, color: 'text-primary' },
      en_ramassage: { icon: <Truck className="h-4 w-4" />, color: 'text-chart-5' },
      en_preparation_stock: { icon: <Package className="h-4 w-4" />, color: 'text-chart-5' },
      en_preparation: { icon: <Package className="h-4 w-4" />, color: 'text-chart-5' },
      new: { icon: <Package className="h-4 w-4" />, color: 'text-muted-foreground' },
      confirmed: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-primary' },
      prise_en_charge: { icon: <Truck className="h-4 w-4" />, color: 'text-chart-5' },
      // Transit
      vers_hub: { icon: <ArrowRight className="h-4 w-4" />, color: 'text-chart-6' },
      en_hub: { icon: <Package className="h-4 w-4" />, color: 'text-chart-6' },
      vers_wilaya: { icon: <Truck className="h-4 w-4" />, color: 'text-chart-5' },
      transfere: { icon: <ArrowRight className="h-4 w-4" />, color: 'text-chart-6' },
      recu_au_hub: { icon: <Package className="h-4 w-4" />, color: 'text-chart-6' },
      confirme_au_bureau: { icon: <Package className="h-4 w-4" />, color: 'text-chart-6' },
      au_bureau: { icon: <Package className="h-4 w-4" />, color: 'text-chart-6' },
      dispatch: { icon: <ArrowRight className="h-4 w-4" />, color: 'text-chart-5' },
      dispatch_autre_wilaya: { icon: <ArrowRight className="h-4 w-4" />, color: 'text-chart-5' },
      dispatch_meme_wilaya: { icon: <ArrowRight className="h-4 w-4" />, color: 'text-chart-5' },
      // Delivery
      sorti_en_livraison: { icon: <Truck className="h-4 w-4" />, color: 'text-warning' },
      en_livraison: { icon: <Truck className="h-4 w-4" />, color: 'text-warning' },
      suspendu: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-warning' },
      // Success
      livre: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
      livre_non_encaisse: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
      encaisse: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
      encaisse_non_paye: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
      paiements_prets: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
      paye_et_archive: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
      // Failures / returns
      tentative_echouee: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      echec_de_livraison: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      retour_chez_livreur: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      retour_transit_entrepot: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      retour_en_traitement: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      retour_recu: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      retour_archive: { icon: <XCircle className="h-4 w-4" />, color: 'text-muted-foreground' },
      retourne: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      retour_vers_centre: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      recupere_par_fournisseur: { icon: <Package className="h-4 w-4" />, color: 'text-muted-foreground' },
      perdu: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-destructive' },
      alerte: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-warning' },
      annule: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
      commande_annulee: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
    };
    return icons[situation] || { icon: <Bell className="h-4 w-4" />, color: 'text-muted-foreground' };
  };

  const handleRunConfirmation = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-confirm-orders', {
        body: { mode: 'auto' },
      });

      if (error) throw error;

      if (data?.processed === 0) {
        toast.info('Aucune commande nouvelle à traiter');
      } else {
        toast.success(`${data?.processed || 0} commandes traitées`);
      }
    } catch (error: any) {
      console.error('Error running auto-confirmation:', error);
      if (error?.message?.includes('rate limit') || error?.status === 429) {
        toast.error('Limite de requêtes IA atteinte. Réessayez dans quelques minutes.');
      } else if (error?.status === 402) {
        toast.error('Crédits IA épuisés. Veuillez recharger vos crédits.');
      } else {
        toast.error('Erreur lors de l\'exécution');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'ask_customer':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700"><MessageSquare className="h-3 w-3 mr-1" />Message envoyé</Badge>;
      case 'auto_confirm':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmé</Badge>;
      case 'reject':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700"><XCircle className="h-3 w-3 mr-1" />Rejeté</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{decision}</Badge>;
    }
  };

  const getConversationBadge = (status: string | null) => {
    switch (status) {
      case 'awaiting_reply':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmé</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700"><XCircle className="h-3 w-3 mr-1" />Annulé</Badge>;
      default:
        return <Badge variant="outline">{status || 'Pending'}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automatisation</h1>
          <p className="text-muted-foreground">Gérez la confirmation IA et le suivi WhatsApp de vos commandes</p>
        </div>
      </div>



      {currentPage === 'confirmation-ia' && (
        <div className="space-y-4">
          <Tabs defaultValue="confirmation" className="space-y-4">
            <TabsList>
              <TabsTrigger value="confirmation"><Bot className="h-4 w-4 mr-2" />Confirmation IA</TabsTrigger>
              <TabsTrigger value="template"><Send className="h-4 w-4 mr-2" />Template Message</TabsTrigger>
              <TabsTrigger value="prompts"><MessageSquare className="h-4 w-4 mr-2" />Prompts IA</TabsTrigger>
              <TabsTrigger value="config"><Settings className="h-4 w-4 mr-2" />Configuration</TabsTrigger>
              <TabsTrigger value="logs"><Zap className="h-4 w-4 mr-2" />Journal</TabsTrigger>
              <TabsTrigger value="schema"><GitBranch className="h-4 w-4 mr-2" />Schéma</TabsTrigger>
            </TabsList>

            {/* Confirmation IA Tab */}
            <TabsContent value="confirmation" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Confirmation automatique par IA
                      </CardTitle>
                      <CardDescription>
                        L'IA envoie un message WhatsApp aux clients pour confirmer leurs commandes, puis interprète leurs réponses.
                      </CardDescription>
                    </div>
                    <Switch
                      checked={confirmationConfig.enabled}
                      onCheckedChange={handleToggleConfirmation}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-dashed">
                      <CardContent className="pt-6 text-center">
                        <Send className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                        <h3 className="font-semibold">1. Envoi du message</h3>
                        <p className="text-sm text-muted-foreground mt-1">L'IA génère un message personnalisé et l'envoie via WhatsApp</p>
                      </CardContent>
                    </Card>
                    <Card className="border-dashed">
                      <CardContent className="pt-6 text-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <h3 className="font-semibold">2. Réponse du client</h3>
                        <p className="text-sm text-muted-foreground mt-1">Le client répond OUI/NON et l'IA interprète sa réponse</p>
                      </CardContent>
                    </Card>
                    <Card className="border-dashed">
                      <CardContent className="pt-6 text-center">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                        <h3 className="font-semibold">3. Mise à jour</h3>
                        <p className="text-sm text-muted-foreground mt-1">Le statut de la commande est mis à jour automatiquement</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Seules les commandes au statut "Nouveau" sont traitées. L'IA vérifie le stock, le numéro de téléphone et le statut du client avant l'envoi.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Messages envoyés', value: logs?.filter(l => l.whatsapp_message_sent).length || 0, icon: Send, color: 'text-blue-500' },
                  { label: 'En attente', value: logs?.filter(l => l.conversation_status === 'awaiting_reply').length || 0, icon: Clock, color: 'text-yellow-500' },
                  { label: 'Confirmés', value: logs?.filter(l => l.conversation_status === 'confirmed').length || 0, icon: CheckCircle2, color: 'text-green-500' },
                  { label: 'Rejetés', value: logs?.filter(l => l.ai_decision === 'reject').length || 0, icon: XCircle, color: 'text-red-500' },
                ].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{stat.label}</p>
                          <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                        <stat.icon className={`h-8 w-8 ${stat.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Template Message Tab */}
            <TabsContent value="template" className="space-y-4">
              {/* Template Confirmation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Template Confirmation
                  </CardTitle>
                  <CardDescription>
                    Message envoyé au client pour confirmer sa commande. Si vide, l'IA génère le message.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium mb-2">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { var: '{name}', desc: 'Nom' }, { var: '{phone}', desc: 'Tél' }, { var: '{order}', desc: 'N° cmd' },
                        { var: '{products}', desc: 'Produits' }, { var: '{total}', desc: 'Total' }, { var: '{delivery_fee}', desc: 'Livraison' },
                        { var: '{address}', desc: 'Adresse' }, { var: '{wilaya}', desc: 'Wilaya' }, { var: '{commune}', desc: 'Commune' },
                        { var: '{delivery_type}', desc: 'Type' }, { var: '{delivery_company}', desc: 'Société livr.' },
                        { var: '{bureau_name}', desc: 'Nom bureau' }, { var: '{bureau_address}', desc: 'Adresse bureau' },
                        { var: '{bureau_maps_link}', desc: 'Lien Maps bureau' },
                      ].map(v => (
                        <Badge key={v.var} variant="secondary" className="font-mono text-xs cursor-pointer" onClick={() => setMessageTemplate(getMessageTemplate() + v.var)}>
                          {v.var}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Tabs defaultValue="fr" className="w-full">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
                      <TabsTrigger value="ar">🇩🇿 العربية</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fr">
                      <Textarea
                        value={getMessageTemplate()}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        rows={8}
                        placeholder={`Bonjour {name} 👋\n\nMerci pour votre commande ❤️\n\nVoici votre commande {order} :\n{products}\n\n💰 Total: {total} DA (livraison: {delivery_fee} DA)\n📍 {delivery_type} - {wilaya}\n📦 {address}\n\nMerci de choisir une option ci-dessous 👇`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                    <TabsContent value="ar">
                      <Textarea
                        value={getMessageTemplateAr()}
                        onChange={(e) => setMessageTemplateAr(e.target.value)}
                        rows={8}
                        dir="rtl"
                        placeholder={`مرحباً {name} 👋\n\nشكراً لطلبك من متجرنا ❤️\n\nهذا هو طلبك {order} :\n{products}\n\n💰 المجموع: {total} دج (التوصيل: {delivery_fee} دج)\n📍 {delivery_type} - {wilaya}\n📦 {address}\n\nالرجاء اختيار أحد الخيارات أدناه 👇`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                  </Tabs>
                  <p className="text-xs text-muted-foreground">💡 Le template par défaut est utilisé si vous ne le modifiez pas. L'IA n'est utilisée que pour répondre aux questions des clients.</p>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      📋 Quick Reply (Sondage WhatsApp)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Le sondage est envoyé juste après le message pour que le client puisse confirmer/annuler d'un clic.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-xs">Question du sondage</Label>
                      <Input
                        value={getPollQuestion()}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="يرجى الرد بـ:"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-green-600">✅ Option Confirmer</Label>
                        <Input
                          value={getPollOptionConfirm()}
                          onChange={(e) => setPollOptionConfirm(e.target.value)}
                          placeholder="✅ نعم (لتأكيد الطلب)"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-blue-600">📞 Option Contacté agent</Label>
                        <Input
                          value={getPollOptionCancel()}
                          onChange={(e) => setPollOptionCancel(e.target.value)}
                          placeholder="📞 تواصل مع الوكيل / Contacter un agent"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveConfirmation} disabled={upsertSetting.isPending}>
                    {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder
                  </Button>
                </CardContent>
              </Card>

              {/* Template Type de livraison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-orange-500" />
                    Template Type de livraison
                  </CardTitle>
                  <CardDescription>
                    Message envoyé au client après confirmation pour choisir le type de livraison (domicile ou stop desk).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium mb-2">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { var: '{name}', desc: 'Nom' }, { var: '{order}', desc: 'N° cmd' },
                        { var: '{total}', desc: 'Total' }, { var: '{wilaya}', desc: 'Wilaya' },
                        { var: '{commune}', desc: 'Commune' }, { var: '{address}', desc: 'Adresse' },
                        { var: '{delivery_home}', desc: 'Prix domicile' }, { var: '{delivery_desk}', desc: 'Prix stop desk' },
                      ].map(v => (
                        <Badge key={v.var} variant="secondary" className="font-mono text-xs cursor-pointer" onClick={() => setDeliveryTypeTemplate(getDeliveryTypeTemplate() + v.var)}>
                          {v.var} <span className="ml-1 opacity-60">{v.desc}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Tabs defaultValue="fr" className="w-full">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
                      <TabsTrigger value="ar">🇩🇿 العربية</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fr">
                      <Textarea
                        value={getDeliveryTypeTemplate()}
                        onChange={(e) => setDeliveryTypeTemplate(e.target.value)}
                        rows={6}
                        placeholder={`Merci {name} pour votre confirmation ! ✅\n\nComment souhaitez-vous recevoir votre commande {order} ?\n\n🏠 Livraison à domicile\n📦 Stop Desk (point relais)\n\nChoisissez une option ci-dessous 👇`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                    <TabsContent value="ar">
                      <Textarea
                        value={getDeliveryTypeTemplateAr()}
                        onChange={(e) => setDeliveryTypeTemplateAr(e.target.value)}
                        rows={6}
                        dir="rtl"
                        placeholder={`شكراً {name} على تأكيدك! ✅\n\nكيف تحب تستلم طلبيتك {order}؟\n\n🏠 توصيل للبيت\n📦 ستوب ديسك (نقطة استلام)\n\nاختر واحدة من الخيارات 👇`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                  </Tabs>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      📋 Quick Reply (Sondage WhatsApp)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Le sondage est envoyé avec le message pour que le client puisse choisir son type de livraison d'un clic.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-xs">Question du sondage</Label>
                      <Input
                        value={getDeliveryTypePollQuestion()}
                        onChange={(e) => setDeliveryTypePollQuestion(e.target.value)}
                        placeholder="اختر نوع التوصيل:"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-green-600">🏠 Option Domicile</Label>
                        <Input
                          value={getDeliveryTypePollOptionHome()}
                          onChange={(e) => setDeliveryTypePollOptionHome(e.target.value)}
                          placeholder="🏠 Livraison à domicile / توصيل للبيت"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-blue-600">📦 Option Stop Desk</Label>
                        <Input
                          value={getDeliveryTypePollOptionStopDesk()}
                          onChange={(e) => setDeliveryTypePollOptionStopDesk(e.target.value)}
                          placeholder="📦 Stop Desk / نقطة استلام"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={async () => {
                    await upsertSetting.mutateAsync({ key: 'delivery_type_template', value: { 
                      template: getDeliveryTypeTemplate(), 
                      template_ar: getDeliveryTypeTemplateAr(),
                      poll_question: getDeliveryTypePollQuestion(),
                      poll_option_home: getDeliveryTypePollOptionHome(),
                      poll_option_stop_desk: getDeliveryTypePollOptionStopDesk(),
                    } });
                    toast.success('Template type de livraison sauvegardé');
                  }} disabled={upsertSetting.isPending}>
                    {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder
                  </Button>
                </CardContent>
              </Card>

              {/* Template Bureau */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-teal-500" />
                    Template Bureau
                  </CardTitle>
                  <CardDescription>
                    Message envoyé au client après avoir choisi Stop Desk pour sélectionner le bureau de livraison.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium mb-2">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { var: '{name}', desc: 'Nom' }, { var: '{order}', desc: 'N° cmd' },
                        { var: '{total}', desc: 'Total' }, { var: '{wilaya}', desc: 'Wilaya' },
                        { var: '{commune}', desc: 'Commune' }, { var: '{bureaux}', desc: 'Liste bureaux' },
                      ].map(v => (
                        <Badge key={v.var} variant="secondary" className="font-mono text-xs cursor-pointer" onClick={() => setBureauTemplate(getBureauTemplate() + v.var)}>
                          {v.var}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Tabs defaultValue="fr" className="w-full">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
                      <TabsTrigger value="ar">🇩🇿 العربية</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fr">
                      <Textarea
                        value={getBureauTemplate()}
                        onChange={(e) => setBureauTemplate(e.target.value)}
                        rows={6}
                        placeholder={`Parfait {name} ! 📦\n\nVous avez choisi Stop Desk pour votre commande {order}.\n\nVeuillez choisir votre bureau de livraison parmi les options ci-dessous 👇`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                    <TabsContent value="ar">
                      <Textarea
                        value={getBureauTemplateAr()}
                        onChange={(e) => setBureauTemplateAr(e.target.value)}
                        rows={6}
                        dir="rtl"
                        placeholder={`ممتاز {name} ! 📦\n\nاخترت ستوب ديسك لطلبيتك {order}.\n\nاختر مكتب التوصيل من الخيارات 👇`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                  </Tabs>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      📋 Quick Reply (Sondage WhatsApp)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Le sondage est envoyé avec la liste des bureaux disponibles dans la wilaya du client.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-xs">Question du sondage</Label>
                      <Input
                        value={getBureauPollQuestion()}
                        onChange={(e) => setBureauPollQuestion(e.target.value)}
                        placeholder="اختر مكتب التوصيل:"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <Button onClick={async () => {
                    await upsertSetting.mutateAsync({ key: 'bureau_template', value: { 
                      template: getBureauTemplate(), 
                      template_ar: getBureauTemplateAr(),
                      poll_question: getBureauPollQuestion(),
                    } });
                    toast.success('Template bureau sauvegardé');
                  }} disabled={upsertSetting.isPending}>
                    {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder
                  </Button>
                </CardContent>
              </Card>

              {/* Template Expédition */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-500" />
                    Template Expédition
                  </CardTitle>
                  <CardDescription>
                    Message envoyé au client lorsque sa commande est expédiée.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium mb-2">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { var: '{name}', desc: 'Nom' }, { var: '{order}', desc: 'N° cmd' },
                        { var: '{tracking}', desc: 'Suivi' }, { var: '{wilaya}', desc: 'Wilaya' },
                        { var: '{commune}', desc: 'Commune' }, { var: '{delivery_company}', desc: 'Société' },
                      ].map(v => (
                        <Badge key={v.var} variant="secondary" className="font-mono text-xs cursor-pointer" onClick={() => setExpeditionTemplate(getExpeditionTemplate() + v.var)}>
                          {v.var}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Tabs defaultValue="fr" className="w-full">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
                      <TabsTrigger value="ar">🇩🇿 العربية</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fr">
                      <Textarea
                        value={getExpeditionTemplate()}
                        onChange={(e) => setExpeditionTemplate(e.target.value)}
                        rows={8}
                        placeholder={`Bonjour {name} 👋\n\n🚚 Votre commande {order} a été expédiée !\n\n📦 Suivi: {tracking}\n🏢 Via: {delivery_company}\n📍 Destination: {wilaya}\n\nBonne réception ! 🎉`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                    <TabsContent value="ar">
                      <Textarea
                        value={getExpeditionTemplateAr()}
                        onChange={(e) => setExpeditionTemplateAr(e.target.value)}
                        rows={8}
                        dir="rtl"
                        placeholder={`مرحبا {name} 👋\n\n🚚 طلبيتك {order} تبعثت!\n\n📦 رقم التتبع: {tracking}\n🏢 عبر: {delivery_company}\n📍 الوجهة: {wilaya}\n\nتوصيل سعيد! 🎉`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                  </Tabs>
                  <Button onClick={async () => {
                    await upsertSetting.mutateAsync({ key: 'expedition_template', value: { template: getExpeditionTemplate(), template_ar: getExpeditionTemplateAr() } });
                  }} disabled={upsertSetting.isPending}>
                    {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder
                  </Button>
                </CardContent>
              </Card>

              {/* Template Demande d'avis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-yellow-500" />
                    Template Demande d'avis
                  </CardTitle>
                  <CardDescription>
                    Message envoyé au client après la livraison pour demander son avis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium mb-2">Variables disponibles :</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { var: '{name}', desc: 'Nom' }, { var: '{order}', desc: 'N° cmd' },
                        { var: '{products}', desc: 'Produits' },
                      ].map(v => (
                        <Badge key={v.var} variant="secondary" className="font-mono text-xs cursor-pointer" onClick={() => setAvisTemplate(getAvisTemplate() + v.var)}>
                          {v.var}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Tabs defaultValue="fr" className="w-full">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
                      <TabsTrigger value="ar">🇩🇿 العربية</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fr">
                      <Textarea
                        value={getAvisTemplate()}
                        onChange={(e) => setAvisTemplate(e.target.value)}
                        rows={8}
                        placeholder={`Bonjour {name} 👋\n\nMerci pour votre achat ! 🎉\nVotre commande {order} a été livrée.\n\n⭐ Nous serions ravis d'avoir votre avis sur {products}.\n\nVotre retour nous aide à nous améliorer ! 🙏`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                    <TabsContent value="ar">
                      <Textarea
                        value={getAvisTemplateAr()}
                        onChange={(e) => setAvisTemplateAr(e.target.value)}
                        rows={8}
                        dir="rtl"
                        placeholder={`مرحبا {name} 👋\n\nشكرا على الشراء! 🎉\nطلبيتك {order} توصلت.\n\n⭐ نحبوا نسمعوا رأيك على {products}.\n\nرأيك يساعدنا نتحسنوا! 🙏`}
                        className="font-mono text-sm mt-2"
                      />
                    </TabsContent>
                  </Tabs>
                  <Button onClick={async () => {
                    await upsertSetting.mutateAsync({ key: 'avis_template', value: { template: getAvisTemplate(), template_ar: getAvisTemplateAr() } });
                  }} disabled={upsertSetting.isPending}>
                    {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Prompts IA Tab */}
            <TabsContent value="prompts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Prompt de confirmation initiale</CardTitle>
                  <CardDescription>
                    Ce prompt guide l'IA pour générer le premier message WhatsApp envoyé au client pour confirmer sa commande.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={getConfirmPrompt()}
                    onChange={(e) => setConfirmPrompt(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmPrompt(DEFAULT_CONFIRMATION_SYSTEM_PROMPT)}
                  >
                    Réinitialiser par défaut
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Prompt de gestion des réponses</CardTitle>
                  <CardDescription>
                    Ce prompt guide l'IA pour interpréter les réponses des clients et décider de l'action à prendre.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={getReplyPrompt()}
                    onChange={(e) => setReplyPrompt(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReplyPrompt(DEFAULT_REPLY_SYSTEM_PROMPT)}
                  >
                    Réinitialiser par défaut
                  </Button>
                </CardContent>
              </Card>

              <Button onClick={handleSaveConfirmation} disabled={upsertSetting.isPending}>
                {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Sauvegarder les prompts
              </Button>
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="space-y-4">
              <LovableAIConfig settings={settings} upsertSetting={upsertSetting} />
              <ExternalAIConfig
                settings={settings}
                upsertSetting={upsertSetting}
                getModel={getModel}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                handleSaveConfirmation={handleSaveConfirmation}
              />

              {/* WaSender Config */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                    WaSender WhatsApp
                  </CardTitle>
                  <CardDescription>Configurez votre clé API WaSender pour l'envoi des messages WhatsApp.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wasender-key">Clé API WaSender</Label>
                    {savedApiKeyExists && !wasenderApiKey && (
                      <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                        <Key className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-mono flex-1">
                          {showApiKey ? savedApiKey : '••••••••••••' + savedApiKey.slice(-6)}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setShowApiKey(!showApiKey)}>
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          navigator.clipboard.writeText(savedApiKey);
                          toast.success('Clé API copiée !');
                        }}>Copier</Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        id="wasender-key"
                        type="password"
                        value={wasenderApiKey}
                        onChange={(e) => setWasenderApiKey(e.target.value)}
                        placeholder={savedApiKeyExists ? "Entrez une nouvelle clé pour remplacer..." : "Collez votre clé API WaSender ici..."}
                        className="font-mono"
                      />
                      <Button
                        onClick={async () => {
                          if (!wasenderApiKey.trim()) {
                            toast.error('Veuillez entrer une clé API');
                            return;
                          }
                          setIsSavingApiKey(true);
                          try {
                            await upsertSetting.mutateAsync({
                              key: 'wasender_config',
                              value: { api_key: wasenderApiKey.trim() },
                            });
                            toast.success('Clé API sauvegardée avec succès');
                            setSavedApiKey(wasenderApiKey.trim());
                            setSavedApiKeyExists(true);
                            setWasenderApiKey('');
                          } catch (err: any) {
                            toast.error('Erreur lors de la sauvegarde: ' + (err?.message || 'Erreur inconnue'));
                          } finally {
                            setIsSavingApiKey(false);
                          }
                        }}
                        disabled={isSavingApiKey || !wasenderApiKey.trim()}
                      >
                        {isSavingApiKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      La clé sera stockée de manière sécurisée et utilisée pour l'envoi des messages WhatsApp.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Webhook URL :</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">
                          {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`);
                          toast.success('URL copiée !');
                        }}>Copier</Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Token de vérification :</p>
                      {savedTokenExists && (
                        <div className="flex items-center gap-2 p-2 rounded border bg-muted/30 mb-2">
                          <span className="text-xs font-mono flex-1">
                            {showToken ? savedToken : '••••••••••••' + savedToken.slice(-6)}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => setShowToken(!showToken)}>
                            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            navigator.clipboard.writeText(savedToken);
                            toast.success('Token copié !');
                          }}>Copier</Button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          value={webhookToken}
                          onChange={(e) => setWebhookToken(e.target.value)}
                          placeholder={savedTokenExists ? "Entrez un nouveau token pour remplacer..." : "Collez le token de vérification WaSender..."}
                          className="font-mono text-xs"
                          type="password"
                        />
                        <Button size="sm" onClick={async () => {
                          if (!webhookToken.trim()) { toast.error('Entrez un token'); return; }
                          await upsertSetting.mutateAsync({ key: 'webhook_verify_token', value: { token: webhookToken.trim() } });
                          setSavedToken(webhookToken.trim());
                          setSavedTokenExists(true);
                          setWebhookToken('');
                          toast.success('Token sauvegardé');
                        }} disabled={upsertSetting.isPending}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      📋 Copiez l'URL et le token dans votre tableau de bord WaSender → Webhook pour recevoir les réponses des clients.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Journal de confirmation automatique</CardTitle>
                  <CardDescription>Historique des 50 dernières confirmations automatiques</CardDescription>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : !logs?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Aucune confirmation automatique pour le moment</p>
                      <p className="text-sm mt-1">Lancez la confirmation IA pour commencer</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Commande</TableHead>
                            <TableHead>Téléphone</TableHead>
                            <TableHead>Décision IA</TableHead>
                            <TableHead>Conversation</TableHead>
                            <TableHead>WhatsApp</TableHead>
                            <TableHead>Raison</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Chat</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map(log => (
                            <TableRow key={log.id}>
                              <TableCell className="font-mono text-sm">{log.order_number}</TableCell>
                              <TableCell className="text-sm">{log.customer_phone}</TableCell>
                              <TableCell>{getDecisionBadge(log.ai_decision)}</TableCell>
                              <TableCell>{getConversationBadge(log.conversation_status)}</TableCell>
                              <TableCell>
                                {log.whatsapp_message_sent ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {log.ai_reason}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: fr })}
                              </TableCell>
                              <TableCell>
                                <Sheet>
                                  <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MessageCircle className="h-4 w-4" />
                                    </Button>
                                  </SheetTrigger>
                                  <SheetContent className="w-[400px] sm:w-[450px] flex flex-col">
                                    <SheetHeader>
                                      <SheetTitle className="flex items-center gap-2">
                                        <MessageCircle className="h-5 w-5 text-green-600" />
                                        Chat - {log.order_number}
                                      </SheetTitle>
                                      <p className="text-sm text-muted-foreground">{log.customer_phone}</p>
                                    </SheetHeader>
                                    <AutomationChatPanel log={log} />
                                  </SheetContent>
                                </Sheet>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Schema Tab */}
            <TabsContent value="schema" className="space-y-4">
              <SchemaFlowView />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {currentPage === 'tracking-notif' && (
        <div className="space-y-4">
          <Tabs defaultValue="par-statut">
            <TabsList className="mb-4">
              <TabsTrigger value="par-statut">Suivi par statut</TabsTrigger>
              <TabsTrigger value="par-situation">Suivi par situation</TabsTrigger>
            </TabsList>

            {/* Suivi par statut */}
            <TabsContent value="par-statut">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notifications par statut
                      </CardTitle>
                      <CardDescription>
                        Notifications WhatsApp automatiques à chaque changement de statut de commande.
                      </CardDescription>
                    </div>
                    <Switch
                      checked={trackingConfig.enabled}
                      onCheckedChange={handleToggleTracking}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-xs text-muted-foreground mr-1">Variables :</span>
                    {['{order}', '{tracking}', '{name}', '{wilaya}', '{commune}', '{address}', '{phone}', '{total}', '{product}', '{delivery_fee}', '{delivery_company}', '{bureau_name}', '{bureau_address}', '{bureau_maps_link}'].map(v => (
                      <Badge key={v} variant="secondary" className="font-mono text-[10px] px-1.5 py-0">{v}</Badge>
                    ))}
                  </div>

                  <Accordion type="multiple" className="space-y-2">
                    {ALL_TRACKING_STATUSES.map((status) => {
                      const isEnabled = getEnabledStatuses().includes(status);
                      const label = STATUS_LABELS[status] || status;
                      const statusIcons: Record<string, { icon: React.ReactNode; color: string }> = {
                        confirmed: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
                        preparing: { icon: <Package className="h-4 w-4" />, color: 'text-chart-5' },
                        ready: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-primary' },
                        shipped: { icon: <Truck className="h-4 w-4" />, color: 'text-chart-6' },
                        to_station: { icon: <ArrowRight className="h-4 w-4" />, color: 'text-chart-5' },
                        at_station: { icon: <Package className="h-4 w-4" />, color: 'text-chart-5' },
                        au_bureau: { icon: <Package className="h-4 w-4" />, color: 'text-chart-6' },
                        en_livraison: { icon: <Truck className="h-4 w-4" />, color: 'text-warning' },
                        delivered: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success' },
                        'Échec_de_livraison': { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
                        cancelled: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
                        failed_3: { icon: <Phone className="h-4 w-4" />, color: 'text-warning' },
                      };
                      const meta = statusIcons[status] || { icon: <Bell className="h-4 w-4" />, color: 'text-muted-foreground' };

                      return (
                        <AccordionItem key={status} value={status} className="border rounded-lg px-1">
                          <AccordionTrigger className="py-3 px-3 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              <span className={meta.color}>{meta.icon}</span>
                              <span className="text-sm font-medium">{label}</span>
                              <div className="ml-auto mr-3" onClick={e => e.stopPropagation()}>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => handleToggleStatus(status, checked)}
                                />
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">🇫🇷 Message Français</Label>
                              <Textarea
                                value={getTrackingMessages()[status] || ''}
                                onChange={(e) => setTrackingMessages(prev => ({ ...prev, [status]: e.target.value }))}
                                placeholder={DEFAULT_TRACKING_MESSAGES[status]}
                                className="text-sm min-h-[60px]"
                                rows={2}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">🇩🇿 Message Arabe</Label>
                              <Textarea
                                value={getTrackingMessagesAr()[status] || ''}
                                onChange={(e) => setTrackingMessagesAr(prev => ({ ...prev, [status]: e.target.value }))}
                                placeholder={DEFAULT_TRACKING_MESSAGES_AR[status]}
                                dir="rtl"
                                className="text-sm min-h-[60px]"
                                rows={2}
                              />
                            </div>
                            {(status === 'au_bureau' || status === 'en_livraison') && (
                              <>
                                <Separator className="my-2" />
                                <p className="text-xs text-muted-foreground font-medium">📩 2ème message (envoyé juste après le 1er)</p>
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">🇫🇷 2ème Message Français</Label>
                                  <Textarea
                                    value={getTrackingMessages2()[status] || ''}
                                    onChange={(e) => setTrackingMessages2(prev => ({ ...prev, [status]: e.target.value }))}
                                    placeholder="Laisser vide pour ne pas envoyer de 2ème message"
                                    className="text-sm min-h-[60px]"
                                    rows={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">🇩🇿 2ème Message Arabe</Label>
                                  <Textarea
                                    value={getTrackingMessagesAr2()[status] || ''}
                                    onChange={(e) => setTrackingMessagesAr2(prev => ({ ...prev, [status]: e.target.value }))}
                                    placeholder="اتركه فارغًا لعدم إرسال رسالة ثانية"
                                    dir="rtl"
                                    className="text-sm min-h-[60px]"
                                    rows={2}
                                  />
                                </div>
                              </>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>

                  <Button onClick={handleSaveTracking} disabled={upsertSetting.isPending}>
                    {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder les notifications
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Suivi par situation */}
            <TabsContent value="par-situation" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Radio className="h-5 w-5" />
                        Notifications par situation de livraison
                      </CardTitle>
                      <CardDescription>
                        Notifications WhatsApp basées sur la situation rapportée par le transporteur.
                      </CardDescription>
                    </div>
                    <Switch
                      checked={situationConfig.enabled}
                      onCheckedChange={handleToggleSituation}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="text-xs text-muted-foreground mr-1">Variables :</span>
                    {['{order}', '{tracking}', '{name}', '{wilaya}'].map(v => (
                      <Badge key={v} variant="secondary" className="font-mono text-[10px] px-1.5 py-0">{v}</Badge>
                    ))}
                  </div>

                  <Tabs defaultValue="rj360">
                    <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-0 w-full justify-start">
                      <TabsTrigger value="rj360" className="gap-2 px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-red-50 data-[state=active]:shadow-none data-[state=active]:text-red-700 font-medium text-muted-foreground dark:data-[state=active]:bg-red-950/30 dark:data-[state=active]:text-red-400">
                        <span>🚚</span> RJ360
                      </TabsTrigger>
                      <TabsTrigger value="zr" className="gap-2 px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-amber-50 data-[state=active]:shadow-none data-[state=active]:text-amber-700 font-medium text-muted-foreground dark:data-[state=active]:bg-amber-950/30 dark:data-[state=active]:text-amber-400">
                        <span>📦</span> ZR Express
                      </TabsTrigger>
                      <TabsTrigger value="local" className="gap-2 px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:shadow-none data-[state=active]:text-blue-700 font-medium text-muted-foreground dark:data-[state=active]:bg-blue-950/30 dark:data-[state=active]:text-blue-400">
                        <span>🛵</span> Livreur local
                      </TabsTrigger>
                    </TabsList>

                    {/* RJ360 */}
                    <TabsContent value="rj360" className="mt-4">
                      <Accordion type="multiple" className="space-y-2">
                        {RJ360_SITUATION_STATUSES.map((situation) => {
                          const isEnabled = getEnabledSituations().includes(`rj360_${situation}`);
                          const label = RJ360_SITUATION_LABELS[situation] || situation;
                          const meta = getSituationIcon(situation);
                          return (
                            <AccordionItem key={`rj360_${situation}`} value={`rj360_${situation}`} className="border rounded-lg px-1">
                              <AccordionTrigger className="py-3 px-3 hover:no-underline">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className={meta.color}>{meta.icon}</span>
                                  <span className="text-sm font-medium">{label}</span>
                                  <div className="ml-auto mr-3" onClick={e => e.stopPropagation()}>
                                    <Switch checked={isEnabled} onCheckedChange={(checked) => handleToggleSituationStatus(`rj360_${situation}`, checked)} />
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-4 space-y-3">
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">🇫🇷 Message Français</Label>
                                  <Textarea value={getSituationMessages()[`rj360_${situation}`] || ''} onChange={(e) => setSituationMessages(prev => ({ ...prev, [`rj360_${situation}`]: e.target.value }))} placeholder={DEFAULT_RJ360_MESSAGES[situation]} className="text-sm min-h-[60px]" rows={2} />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">🇩🇿 Message Arabe</Label>
                                  <Textarea value={getSituationMessagesAr()[`rj360_${situation}`] || ''} onChange={(e) => setSituationMessagesAr(prev => ({ ...prev, [`rj360_${situation}`]: e.target.value }))} placeholder={DEFAULT_RJ360_MESSAGES_AR[situation]} dir="rtl" className="text-sm min-h-[60px]" rows={2} />
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </TabsContent>

                    {/* ZR Express */}
                     <TabsContent value="zr" className="mt-4 space-y-6">
                      {/* ZR États */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          États
                        </h4>
                        <Accordion type="multiple" className="space-y-2">
                          {ZR_STATE_STATUSES.map((situation) => {
                            const isEnabled = getEnabledSituations().includes(`zr_state_${situation}`);
                            const label = ZR_STATE_LABELS[situation] || situation;
                            const meta = getSituationIcon(situation);
                            return (
                              <AccordionItem key={`zr_state_${situation}`} value={`zr_state_${situation}`} className="border rounded-lg px-1">
                                <AccordionTrigger className="py-3 px-3 hover:no-underline">
                                  <div className="flex items-center gap-3 flex-1">
                                    <span className={meta.color}>{meta.icon}</span>
                                    <span className="text-sm font-medium">{label}</span>
                                    <div className="ml-auto mr-3" onClick={e => e.stopPropagation()}>
                                      <Switch checked={isEnabled} onCheckedChange={(checked) => handleToggleSituationStatus(`zr_state_${situation}`, checked)} />
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-3 pb-4 space-y-3">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium">🇫🇷 Message Français</Label>
                                    <Textarea value={getSituationMessages()[`zr_state_${situation}`] || ''} onChange={(e) => setSituationMessages(prev => ({ ...prev, [`zr_state_${situation}`]: e.target.value }))} placeholder={DEFAULT_ZR_STATE_MESSAGES[situation]} className="text-sm min-h-[60px]" rows={2} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium">🇩🇿 Message Arabe</Label>
                                    <Textarea value={getSituationMessagesAr()[`zr_state_${situation}`] || ''} onChange={(e) => setSituationMessagesAr(prev => ({ ...prev, [`zr_state_${situation}`]: e.target.value }))} placeholder={DEFAULT_ZR_STATE_MESSAGES_AR[situation]} dir="rtl" className="text-sm min-h-[60px]" rows={2} />
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>

                      {/* ZR Situations */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          Situations
                        </h4>
                        <Accordion type="multiple" className="space-y-2">
                          {ZR_SITUATION_STATUSES.map((situation) => {
                            const isEnabled = getEnabledSituations().includes(`zr_${situation}`);
                            const label = ZR_SITUATION_LABELS[situation] || situation;
                            const meta = getSituationIcon(situation);
                            return (
                              <AccordionItem key={`zr_${situation}`} value={`zr_${situation}`} className="border rounded-lg px-1">
                                <AccordionTrigger className="py-3 px-3 hover:no-underline">
                                  <div className="flex items-center gap-3 flex-1">
                                    <span className={meta.color}>{meta.icon}</span>
                                    <span className="text-sm font-medium">{label}</span>
                                    <div className="ml-auto mr-3" onClick={e => e.stopPropagation()}>
                                      <Switch checked={isEnabled} onCheckedChange={(checked) => handleToggleSituationStatus(`zr_${situation}`, checked)} />
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-3 pb-4 space-y-3">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium">🇫🇷 Message Français</Label>
                                    <Textarea value={getSituationMessages()[`zr_${situation}`] || ''} onChange={(e) => setSituationMessages(prev => ({ ...prev, [`zr_${situation}`]: e.target.value }))} placeholder={DEFAULT_ZR_MESSAGES[situation]} className="text-sm min-h-[60px]" rows={2} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium">🇩🇿 Message Arabe</Label>
                                    <Textarea value={getSituationMessagesAr()[`zr_${situation}`] || ''} onChange={(e) => setSituationMessagesAr(prev => ({ ...prev, [`zr_${situation}`]: e.target.value }))} placeholder={DEFAULT_ZR_MESSAGES_AR[situation]} dir="rtl" className="text-sm min-h-[60px]" rows={2} />
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    </TabsContent>

                    {/* Livreur local */}
                    <TabsContent value="local" className="mt-4">
                      <Accordion type="multiple" className="space-y-2">
                        {LOCAL_SITUATION_STATUSES.map((situation) => {
                          const isEnabled = getEnabledSituations().includes(`local_${situation}`);
                          const label = LOCAL_SITUATION_LABELS[situation] || situation;
                          const meta = getSituationIcon(situation);
                          return (
                            <AccordionItem key={`local_${situation}`} value={`local_${situation}`} className="border rounded-lg px-1">
                              <AccordionTrigger className="py-3 px-3 hover:no-underline">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className={meta.color}>{meta.icon}</span>
                                  <span className="text-sm font-medium">{label}</span>
                                  <div className="ml-auto mr-3" onClick={e => e.stopPropagation()}>
                                    <Switch checked={isEnabled} onCheckedChange={(checked) => handleToggleSituationStatus(`local_${situation}`, checked)} />
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-4 space-y-3">
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">🇫🇷 Message Français</Label>
                                  <Textarea value={getSituationMessages()[`local_${situation}`] || ''} onChange={(e) => setSituationMessages(prev => ({ ...prev, [`local_${situation}`]: e.target.value }))} placeholder={DEFAULT_LOCAL_MESSAGES[situation]} className="text-sm min-h-[60px]" rows={2} />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">🇩🇿 Message Arabe</Label>
                                  <Textarea value={getSituationMessagesAr()[`local_${situation}`] || ''} onChange={(e) => setSituationMessagesAr(prev => ({ ...prev, [`local_${situation}`]: e.target.value }))} placeholder={DEFAULT_LOCAL_MESSAGES_AR[situation]} dir="rtl" className="text-sm min-h-[60px]" rows={2} />
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </TabsContent>
                  </Tabs>

                  <Button onClick={handleSaveSituation} disabled={upsertSetting.isPending} className="mt-4">
                    {upsertSetting.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder les notifications
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
