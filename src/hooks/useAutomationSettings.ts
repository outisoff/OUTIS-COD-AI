import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AutomationConfig {
  confirmation: {
    enabled: boolean;
    system_prompt: string;
    user_prompt_template: string;
    model: string;
  };
  tracking_notifications: {
    enabled: boolean;
    statuses: string[];
    custom_messages: Record<string, string>;
  };
  whatsapp: {
    platform: string;
    api_key_configured: boolean;
  };
}

const DEFAULT_CONFIRMATION_SYSTEM_PROMPT = `Tu es un assistant commercial professionnel et amical pour OUTIS COD, une plateforme e-commerce algérienne.
Tu contactes les clients par WhatsApp pour confirmer leurs commandes.
Tu dois être poli, professionnel mais chaleureux. Utilise un ton conversationnel naturel.
Tu parles en français ou en arabe dialectal algérien selon la préférence du client.
Commence toujours en français.
IMPORTANT: Le message doit être court, clair et direct. Pas plus de 10 lignes.
N'utilise PAS de formatage HTML. Utilise des émojis avec modération.
À la fin du message, demande clairement au client de répondre OUI pour confirmer ou NON pour annuler.`;

const DEFAULT_REPLY_SYSTEM_PROMPT = `Tu es un assistant commercial pour OUTIS COD, une plateforme e-commerce algérienne.
Tu gères une conversation WhatsApp avec un client pour confirmer sa commande.

RÈGLES:
- Si le client dit OUI, confirme, d'accord, ok, نعم, واه, يح → action: "confirm"
- Si le client dit NON, annule, لا → action: "cancel"
- Si le client pose des questions ou demande des modifications → action: "continue" et réponds à sa question
- Sois bref, poli et professionnel
- Réponds en français ou arabe dialectal selon la langue du client`;

const DEFAULT_TRACKING_MESSAGES: Record<string, string> = {
  confirmed: '✅ Votre commande {order} a été confirmée ! Elle sera bientôt préparée.',
  preparing: '📦 Votre commande {order} est en cours de préparation.',
  ready: '✅ Votre commande {order} est prête pour l\'expédition.',
  shipped: '🚚 Votre commande {order} a été expédiée ! Numéro de suivi: {tracking}',
  to_station: '📍 Votre commande {order} est en route vers la station.',
  at_station: '🏢 Votre commande {order} est arrivée à la station.',
  au_bureau: '🏢 Votre commande {order} est au bureau de livraison ({delivery_company}).\n📍 Bureau: {bureau_name}\n🗺️ Adresse: {bureau_address}\n📌 Localisation: {bureau_maps_link}',
  en_livraison: '🛵 Votre commande {order} est en cours de livraison !',
  delivered: '🎉 Votre commande {order} a été livrée. Merci !',
  'Échec_de_livraison': '⚠️ La livraison de votre commande {order} a échoué.',
  cancelled: '❌ Votre commande {order} a été annulée.',
  failed_1: '📞 1ère tentative échouée pour la commande {order}. Nous réessayerons.',
  failed_2: '📞 2ème tentative échouée pour la commande {order}. Nous réessayerons.',
  failed_3: '📞 3ème tentative échouée pour la commande {order}. Dernière chance de confirmer.',
  failed_4: '📞 4ème tentative échouée pour la commande {order}. Merci de nous rappeler.',
  failed_5: '📞 5ème tentative échouée pour la commande {order}. Dernier rappel.',
};

const DEFAULT_TRACKING_MESSAGES_AR: Record<string, string> = {
  confirmed: '✅ طلبك {order} تأكد! راح يتحضر قريب.',
  preparing: '📦 طلبك {order} راه يتحضر.',
  ready: '✅ طلبك {order} جاهز للشحن.',
  shipped: '🚚 طلبك {order} تشحن! رقم التتبع: {tracking}',
  to_station: '📍 طلبك {order} في الطريق للمحطة.',
  at_station: '🏢 طلبك {order} وصل للمحطة. تقدر تجيبو.',
  au_bureau: '🏢 طلبك {order} في مكتب التوصيل ({delivery_company}).\n📍 المكتب: {bureau_name}\n🗺️ العنوان: {bureau_address}\n📌 الموقع: {bureau_maps_link}',
  en_livraison: '🛵 طلبك {order} راه في التوصيل! الليفرور جاي!',
  delivered: '🎉 طلبك {order} توصل. شكرا على ثقتك!',
  'Échec_de_livraison': '⚠️ توصيل طلبك {order} ما نجحش. راح نعاودو نبرمجوه.',
  cancelled: '❌ طلبك {order} تلغى.',
  failed_1: '📞 المحاولة الأولى لطلبك {order} ما نجحتش. راح نعاودو.',
  failed_2: '📞 المحاولة الثانية لطلبك {order} ما نجحتش. راح نعاودو.',
  failed_3: '📞 المحاولة الثالثة لطلبك {order}. آخر فرصة باش تأكد.',
  failed_4: '📞 المحاولة الرابعة لطلبك {order}. عاود اتصل بينا.',
  failed_5: '📞 المحاولة الخامسة لطلبك {order}. آخر تذكير.',
};

const ALL_TRACKING_STATUSES = Object.keys(DEFAULT_TRACKING_MESSAGES);

// ── RJ360 (EcoTrack) situations ──
const RJ360_SITUATION_STATUSES = [
  'prete_a_expedier', 'en_ramassage', 'en_preparation_stock', 'vers_hub', 'en_hub',
  'vers_wilaya', 'en_preparation', 'en_livraison', 'suspendu',
  'livre_non_encaisse', 'encaisse_non_paye', 'paiements_prets', 'paye_et_archive',
  'retour_chez_livreur', 'retour_transit_entrepot', 'retour_en_traitement', 'retour_recu', 'retour_archive',
  'annule',
];

const RJ360_SITUATION_LABELS: Record<string, string> = {
  prete_a_expedier: 'Prête à expédier',
  en_ramassage: 'En ramassage',
  en_preparation_stock: 'En préparation stock',
  vers_hub: 'Vers hub',
  en_hub: 'En hub',
  vers_wilaya: 'Vers wilaya',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  suspendu: 'Suspendu',
  livre_non_encaisse: 'Livré non encaissé',
  encaisse_non_paye: 'Encaissé non payé',
  paiements_prets: 'Paiements prêts',
  paye_et_archive: 'Payé et archivé',
  retour_chez_livreur: 'Retour chez livreur',
  retour_transit_entrepot: 'Retour transit entrepôt',
  retour_en_traitement: 'Retour en traitement',
  retour_recu: 'Retour reçu',
  retour_archive: 'Retour archivé',
  annule: 'Annulé',
};

const DEFAULT_RJ360_MESSAGES: Record<string, string> = {
  prete_a_expedier: '📦 Votre commande {order} est prête à expédier.',
  en_ramassage: '🚛 Votre commande {order} est en cours de ramassage.',
  en_preparation_stock: '📦 Votre commande {order} est en préparation au stock.',
  vers_hub: '🚚 Votre commande {order} est en route vers le hub.',
  en_hub: '🏢 Votre commande {order} est arrivée au hub.',
  vers_wilaya: '🚚 Votre commande {order} est en route vers votre wilaya {wilaya}.',
  en_preparation: '📋 Votre commande {order} est en préparation pour la livraison.',
  en_livraison: '🛵 Votre commande {order} est en cours de livraison !',
  suspendu: '⏸️ La livraison de votre commande {order} est temporairement suspendue.',
  livre_non_encaisse: '✅ Votre commande {order} a été livrée !',
  encaisse_non_paye: '✅ Votre commande {order} a été livrée et encaissée.',
  paiements_prets: '💰 Le paiement de votre commande {order} est prêt.',
  paye_et_archive: '✅ Votre commande {order} est finalisée et archivée.',
  retour_chez_livreur: '↩️ Votre commande {order} est en retour chez le livreur.',
  retour_transit_entrepot: '↩️ Votre commande {order} est en transit retour vers l\'entrepôt.',
  retour_en_traitement: '↩️ Le retour de votre commande {order} est en traitement.',
  retour_recu: '📬 Le retour de votre commande {order} a été reçu.',
  retour_archive: '📁 Le retour de votre commande {order} a été archivé.',
  annule: '❌ Votre commande {order} a été annulée.',
};

const DEFAULT_RJ360_MESSAGES_AR: Record<string, string> = {
  prete_a_expedier: '📦 طلبك {order} جاهز للشحن.',
  en_ramassage: '🚛 طلبك {order} في مرحلة الاستلام.',
  en_preparation_stock: '📦 طلبك {order} يتحضر في المخزن.',
  vers_hub: '🚚 طلبك {order} في الطريق للمركز.',
  en_hub: '🏢 طلبك {order} وصل للمركز.',
  vers_wilaya: '🚚 طلبك {order} في الطريق لولاية {wilaya}.',
  en_preparation: '📋 طلبك {order} يتحضر للتوصيل.',
  en_livraison: '🛵 طلبك {order} في التوصيل!',
  suspendu: '⏸️ توصيل طلبك {order} متوقف مؤقتاً.',
  livre_non_encaisse: '✅ طلبك {order} توصل!',
  encaisse_non_paye: '✅ طلبك {order} توصل وتم الدفع.',
  paiements_prets: '💰 دفع طلبك {order} جاهز.',
  paye_et_archive: '✅ طلبك {order} تم وأرشف.',
  retour_chez_livreur: '↩️ طلبك {order} راجع عند الليفرور.',
  retour_transit_entrepot: '↩️ طلبك {order} راجع للمخزن.',
  retour_en_traitement: '↩️ رجوع طلبك {order} في المعالجة.',
  retour_recu: '📬 رجوع طلبك {order} تم استلامه.',
  retour_archive: '📁 رجوع طلبك {order} تأرشف.',
  annule: '❌ طلبك {order} تلغى.',
};

// ── ZR Express – États (states from API) ──
const ZR_STATE_STATUSES = [
  'commande_recue', 'pret_a_expedier', 'vers_wilaya', 'confirme_au_bureau',
  'dispatch', 'sortie_en_livraison', 'en_livraison',
  'livre', 'encaisse', 'recouvert',
  'attente_recuperation_fournisseur', 'recupere_par_fournisseur',
];

const ZR_STATE_LABELS: Record<string, string> = {
  commande_recue: 'Commande reçue',
  pret_a_expedier: 'Prêt à expédier',
  vers_wilaya: 'Dispatch dans une autre wilaya',
  confirme_au_bureau: 'Confirmé au bureau',
  dispatch: 'Dispatch dans la même wilaya',
  sortie_en_livraison: 'Sortie en livraison',
  en_livraison: 'En livraison',
  livre: 'Livré',
  encaisse: 'Encaissé',
  recouvert: 'Recouvert',
  attente_recuperation_fournisseur: 'En attente récupération fournisseur',
  recupere_par_fournisseur: 'Récupéré par fournisseur',
};

const DEFAULT_ZR_STATE_MESSAGES: Record<string, string> = {
  commande_recue: '📋 Votre commande {order} a été reçue.',
  pret_a_expedier: '📦 Votre commande {order} est prête à expédier.',
  vers_wilaya: '🚚 Votre commande {order} est en route vers votre wilaya {wilaya}.',
  confirme_au_bureau: '🏢 Votre commande {order} est confirmée au bureau.',
  dispatch: '📤 Votre commande {order} est dispatchée dans la même wilaya.',
  sortie_en_livraison: '🛵 Votre commande {order} est sortie en livraison !',
  en_livraison: '🛵 Votre commande {order} est en cours de livraison !',
  livre: '🎉 Votre commande {order} a été livrée. Merci !',
  encaisse: '✅ Votre commande {order} a été livrée et encaissée.',
  recouvert: '💰 Votre commande {order} a été recouvrée.',
  attente_recuperation_fournisseur: '📦 Votre commande {order} est en attente de récupération.',
  recupere_par_fournisseur: '📦 Votre commande {order} a été récupérée par le fournisseur.',
};

const DEFAULT_ZR_STATE_MESSAGES_AR: Record<string, string> = {
  commande_recue: '📋 طلبك {order} تم استلامه.',
  pret_a_expedier: '📦 طلبك {order} جاهز للشحن.',
  vers_wilaya: '🚚 طلبك {order} في الطريق لولاية {wilaya}.',
  confirme_au_bureau: '🏢 طلبك {order} تأكد في المكتب.',
  dispatch: '📤 طلبك {order} تم إرساله في نفس الولاية.',
  sortie_en_livraison: '🛵 طلبك {order} خرج للتوصيل!',
  en_livraison: '🛵 طلبك {order} في التوصيل!',
  livre: '🎉 طلبك {order} توصل. شكراً!',
  encaisse: '✅ طلبك {order} توصل وتم الدفع.',
  recouvert: '💰 طلبك {order} تم تحصيله.',
  attente_recuperation_fournisseur: '📦 طلبك {order} في انتظار الاسترجاع.',
  recupere_par_fournisseur: '📦 طلبك {order} تم استرجاعه.',
};

// ── ZR Express – Situations (from API) ──
const ZR_SITUATION_STATUSES = [
  'appel_telephonique', 'en_attente_du_client', 'sms_envoye',
  'ne_repond_pas_1', 'ne_repond_pas_2', 'ne_repond_pas_3',
  'reporte_date_ulterieure', 'commande_annulee',
];

const ZR_SITUATION_LABELS: Record<string, string> = {
  appel_telephonique: 'Appel téléphonique',
  en_attente_du_client: 'En attente du client',
  sms_envoye: 'SMS envoyé',
  ne_repond_pas_1: 'Ne répond pas 1',
  ne_repond_pas_2: 'Ne répond pas 2',
  ne_repond_pas_3: 'Ne répond pas 3',
  reporte_date_ulterieure: 'Reporté à une date ultérieure',
  commande_annulee: 'Commande annulée',
};

const DEFAULT_ZR_MESSAGES: Record<string, string> = {
  appel_telephonique: '📞 Appel téléphonique pour votre commande {order}.',
  en_attente_du_client: '⏳ Votre commande {order} est en attente de votre réponse.',
  sms_envoye: '📱 Un SMS a été envoyé concernant votre commande {order}.',
  ne_repond_pas_1: '📞 1ère tentative : pas de réponse pour la commande {order}.',
  ne_repond_pas_2: '📞 2ème tentative : pas de réponse pour la commande {order}.',
  ne_repond_pas_3: '📞 3ème tentative : pas de réponse pour la commande {order}. Dernière chance.',
  reporte_date_ulterieure: '📅 La livraison de votre commande {order} a été reportée.',
  commande_annulee: '❌ Votre commande {order} a été annulée.',
};

const DEFAULT_ZR_MESSAGES_AR: Record<string, string> = {
  appel_telephonique: '📞 اتصال هاتفي بخصوص طلبك {order}.',
  en_attente_du_client: '⏳ طلبك {order} في انتظار ردك.',
  sms_envoye: '📱 تم إرسال رسالة SMS بخصوص طلبك {order}.',
  ne_repond_pas_1: '📞 المحاولة الأولى: ما ردش على طلبك {order}.',
  ne_repond_pas_2: '📞 المحاولة الثانية: ما ردش على طلبك {order}.',
  ne_repond_pas_3: '📞 المحاولة الثالثة: ما ردش على طلبك {order}. آخر فرصة.',
  reporte_date_ulterieure: '📅 توصيل طلبك {order} تأجل.',
  commande_annulee: '❌ طلبك {order} تلغى.',
};

// ── Livreur local situations ──
const LOCAL_SITUATION_STATUSES = [
  'pris_en_charge', 'en_livraison', 'livre', 'echec_livraison',
  'ne_repond_pas', 'retour', 'annule',
];

const LOCAL_SITUATION_LABELS: Record<string, string> = {
  pris_en_charge: 'Pris en charge',
  en_livraison: 'En livraison',
  livre: 'Livré',
  echec_livraison: 'Échec de livraison',
  ne_repond_pas: 'Ne répond pas',
  retour: 'Retour',
  annule: 'Annulé',
};

const DEFAULT_LOCAL_MESSAGES: Record<string, string> = {
  pris_en_charge: '📦 Votre commande {order} a été prise en charge par le livreur.',
  en_livraison: '🛵 Votre commande {order} est en cours de livraison !',
  livre: '🎉 Votre commande {order} a été livrée. Merci !',
  echec_livraison: '⚠️ La livraison de votre commande {order} a échoué.',
  ne_repond_pas: '📞 Le client ne répond pas pour la commande {order}.',
  retour: '↩️ Votre commande {order} est en retour.',
  annule: '❌ Votre commande {order} a été annulée.',
};

const DEFAULT_LOCAL_MESSAGES_AR: Record<string, string> = {
  pris_en_charge: '📦 طلبك {order} تم استلامه من الليفرور.',
  en_livraison: '🛵 طلبك {order} في التوصيل!',
  livre: '🎉 طلبك {order} توصل. شكراً!',
  echec_livraison: '⚠️ توصيل طلبك {order} فشل.',
  ne_repond_pas: '📞 الزبون ما يردش على طلبك {order}.',
  retour: '↩️ طلبك {order} راجع.',
  annule: '❌ طلبك {order} تلغى.',
};

// Combined
const ALL_SITUATION_STATUSES = [...RJ360_SITUATION_STATUSES, ...ZR_SITUATION_STATUSES, ...ZR_STATE_STATUSES, ...LOCAL_SITUATION_STATUSES];
const SITUATION_LABELS: Record<string, string> = { ...RJ360_SITUATION_LABELS, ...ZR_SITUATION_LABELS, ...ZR_STATE_LABELS, ...LOCAL_SITUATION_LABELS };
const DEFAULT_SITUATION_MESSAGES: Record<string, string> = { ...DEFAULT_RJ360_MESSAGES, ...DEFAULT_ZR_MESSAGES, ...DEFAULT_ZR_STATE_MESSAGES, ...DEFAULT_LOCAL_MESSAGES };
const DEFAULT_SITUATION_MESSAGES_AR: Record<string, string> = { ...DEFAULT_RJ360_MESSAGES_AR, ...DEFAULT_ZR_MESSAGES_AR, ...DEFAULT_ZR_STATE_MESSAGES_AR, ...DEFAULT_LOCAL_MESSAGES_AR };

export {
  DEFAULT_CONFIRMATION_SYSTEM_PROMPT, DEFAULT_REPLY_SYSTEM_PROMPT,
  DEFAULT_TRACKING_MESSAGES, DEFAULT_TRACKING_MESSAGES_AR, ALL_TRACKING_STATUSES,
  ALL_SITUATION_STATUSES, SITUATION_LABELS,
  DEFAULT_SITUATION_MESSAGES, DEFAULT_SITUATION_MESSAGES_AR,
  RJ360_SITUATION_STATUSES, RJ360_SITUATION_LABELS, DEFAULT_RJ360_MESSAGES, DEFAULT_RJ360_MESSAGES_AR,
  ZR_SITUATION_STATUSES, ZR_SITUATION_LABELS, DEFAULT_ZR_MESSAGES, DEFAULT_ZR_MESSAGES_AR,
  ZR_STATE_STATUSES, ZR_STATE_LABELS, DEFAULT_ZR_STATE_MESSAGES, DEFAULT_ZR_STATE_MESSAGES_AR,
  LOCAL_SITUATION_STATUSES, LOCAL_SITUATION_LABELS, DEFAULT_LOCAL_MESSAGES, DEFAULT_LOCAL_MESSAGES_AR,
};

export function useAutomationSettings() {
  return useQuery({
    queryKey: ['automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings' as any)
        .select('*')
        .order('setting_key');

      if (error) throw error;

      const settings: Record<string, any> = {};
      (data as any[])?.forEach((row: any) => {
        settings[row.setting_key] = row.setting_value;
      });

      return settings;
    },
  });
}

export function useUpsertAutomationSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      // Try update first
      const { data: existing } = await supabase
        .from('automation_settings' as any)
        .select('id')
        .eq('setting_key', key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('automation_settings' as any)
          .update({ setting_value: value } as any)
          .eq('setting_key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('automation_settings' as any)
          .insert({ setting_key: key, setting_value: value } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
      toast.success('Paramètre sauvegardé');
    },
    onError: (error) => {
      console.error('Error saving automation setting:', error);
      toast.error('Erreur lors de la sauvegarde');
    },
  });
}

export function useAutoConfirmationLogs() {
  return useQuery({
    queryKey: ['auto-confirmation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_confirmation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
