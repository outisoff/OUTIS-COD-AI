export type BuiltinSlashCommand = {
  cmd: string;
  desc: string;
  prompt: string;
  iconName: 'FileText' | 'BarChart3' | 'Search' | 'ListChecks' | 'Columns' | 'Package' | 'Users' | 'TrendingUp' | 'ImageIcon' | 'Zap';
};

export const BUILTIN_SLASH_COMMANDS: BuiltinSlashCommand[] = [
  { iconName: 'FileText', cmd: '/orders', desc: 'Liste des commandes du jour', prompt: "Affiche les commandes d'aujourd'hui avec leur statut." },
  { iconName: 'BarChart3', cmd: '/report', desc: 'Rapport de performance', prompt: 'Génère un rapport de performance des ventes pour cette semaine.' },
  { iconName: 'Search', cmd: '/audit', desc: 'Audit complet du compte', prompt: 'Fais un audit complet: commandes, stock, taux de confirmation et livraison.' },
  { iconName: 'ListChecks', cmd: '/plan', desc: 'Plan de tâches complet', prompt: "Donne-moi un plan d'actions prioritaires pour aujourd'hui." },
  { iconName: 'Columns', cmd: '/compare', desc: 'Comparer périodes', prompt: 'Compare les ventes de cette semaine vs la semaine dernière.' },
  { iconName: 'Package', cmd: '/stock', desc: 'État du stock', prompt: 'Quels produits sont en rupture ou en stock faible ?' },
  { iconName: 'Users', cmd: '/agents', desc: 'Performance des agents', prompt: "Affiche la performance des agents de confirmation aujourd'hui." },
  { iconName: 'TrendingUp', cmd: '/top', desc: 'Top wilayas / produits', prompt: 'Top 5 des wilayas et des produits par commandes.' },
  { iconName: 'ImageIcon', cmd: '/pending', desc: 'Commandes en attente', prompt: 'Affiche toutes les commandes en attente de confirmation.' },
  { iconName: 'Zap', cmd: '/scale', desc: 'Plan de scaling', prompt: 'Suggère un plan de scaling basé sur les performances actuelles.' },
];

export const BUILTIN_OVERRIDES_KEY = 'outis_builtin_overrides';
export const BUILTIN_HIDDEN_KEY = 'outis_builtin_hidden';

export type BuiltinOverride = { desc?: string; prompt?: string };

export function loadBuiltinOverrides(): Record<string, BuiltinOverride> {
  try {
    const raw = localStorage.getItem(BUILTIN_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function loadBuiltinHidden(): string[] {
  try {
    const raw = localStorage.getItem(BUILTIN_HIDDEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getEffectiveBuiltins() {
  const overrides = loadBuiltinOverrides();
  const hidden = new Set(loadBuiltinHidden());
  return BUILTIN_SLASH_COMMANDS
    .filter(b => !hidden.has(b.cmd))
    .map(b => ({
      ...b,
      desc: overrides[b.cmd]?.desc ?? b.desc,
      prompt: overrides[b.cmd]?.prompt ?? b.prompt,
    }));
}
