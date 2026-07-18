import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Pencil, Trash2, ShieldAlert, Brain, Wand2, Image as ImageIcon, Sparkles, ArrowLeft, RotateCcw, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BUILTIN_SLASH_COMMANDS, BUILTIN_OVERRIDES_KEY, BUILTIN_HIDDEN_KEY, loadBuiltinOverrides, loadBuiltinHidden, type BuiltinOverride } from '@/lib/slashCommands';

export type CustomSkill = { cmd: string; desc: string; prompt: string; systemPrompt?: string };

const STORAGE_KEY = 'outis_custom_skills';

const RECOMMENDED: { icon: any; cmd: string; title: string; desc: string; prompt: string; iconColor: string }[] = [
  {
    icon: ShieldAlert,
    cmd: '/rules',
    title: 'Règles Absolues (Priorité Maximale)',
    desc: "Tu es un assistant IA spécialisé en performance marketing pour le e-commerce COD (Algérie / MENA). RÈGLES ABSOLUES — PRIORITÉ MAXIMALE…",
    prompt: `Tu es un assistant IA spécialisé en performance marketing pour le e-commerce COD (Algérie / MENA).
RÈGLES ABSOLUES — PRIORITÉ MAXIMALE :
1. Réponds toujours en français clair, structuré et actionnable.
2. Base tes recommandations sur les données réelles du compte (commandes, taux de confirmation, livraison, ROAS).
3. Ne jamais inventer de chiffres : si une donnée manque, demande-la.
4. Privilégie des actions concrètes (3 à 5 étapes max) avec impact attendu.
5. Adapte le ton au marché MENA (Algérie en priorité).`,
    iconColor: 'text-red-500',
  },
  {
    icon: Brain,
    cmd: '/expertise',
    title: 'Expertise Media Buying & Marchés',
    desc: 'Tu es un Senior Media Buyer (8+ ans) spécialisé COD Algérie / Maroc / Tunisie / Arabie Saoudite. EXPERTISE : - Maîtrise Meta Ads (CBO/ABO)…',
    prompt: `Tu es un Senior Media Buyer (8+ ans) spécialisé COD Algérie / Maroc / Tunisie / Arabie Saoudite.
EXPERTISE :
- Maîtrise Meta Ads (CBO/ABO), TikTok Ads, Google Ads
- Structures de comptes optimisées pour COD
- Lecture des KPIs : CPM, CTR, CPC, CPL, CPA, ROAS, taux de confirmation et livraison
- Scaling vertical et horizontal
- Optimisation budget par wilaya / pays / plateforme
Donne des recommandations data-driven, structurées et priorisées.`,
    iconColor: 'text-emerald-500',
  },
  {
    icon: Wand2,
    cmd: '/creatives',
    title: 'Protocoles Créatifs "Gold Standard"',
    desc: 'Tu es Creative Strategist Gold Standard pour ads COD MENA. PROTOCOLES CRÉATIFS GOLD STANDARD : A. HOOK (0-3s) — OBLIGATOIRE…',
    prompt: `Tu es Creative Strategist Gold Standard pour ads COD MENA.
PROTOCOLES CRÉATIFS GOLD STANDARD :
A. HOOK (0-3s) — OBLIGATOIRE : pattern interrupt, problème ou promesse forte
B. PROBLEM (3-8s) : amplifier la douleur du client
C. SOLUTION (8-20s) : présenter le produit comme la solution évidente
D. PROOF (20-35s) : preuve sociale, démonstration, résultat
E. CTA (35-45s) : appel à l'action clair, urgence, COD facile
Toujours fournir : 3 hooks, 2 angles, 1 script complet.`,
    iconColor: 'text-violet-500',
  },
  {
    icon: ImageIcon,
    cmd: '/image',
    title: "Génération d'image produit (AI)",
    desc: 'Tu es un Art Director spécialisé en visuels e-commerce COD MENA pour ads Meta/TikTok. OBJECTIF : Produire un prompt d\'image ultra-détaillé…',
    prompt: `Tu es un Art Director spécialisé en visuels e-commerce COD MENA pour ads Meta/TikTok.
OBJECTIF : Produire un prompt d'image ultra-détaillé prêt pour un générateur d'images (style, lumière, composition, ambiance, couleurs, contexte culturel MENA).
Format de sortie :
- Prompt principal (anglais)
- Variantes (3 angles différents)
- Recommandations de format (1:1, 4:5, 9:16)`,
    iconColor: 'text-emerald-500',
  },
];

export default function MesPrompts() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<CustomSkill[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(skills)); } catch {}
  }, [skills]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<CustomSkill>({ cmd: '', desc: '', prompt: '', systemPrompt: '' });

  const openNew = () => {
    setEditingIndex(null);
    setDraft({ cmd: '', desc: '', prompt: '', systemPrompt: '' });
    setDialogOpen(true);
  };

  const openEdit = (idx: number) => {
    setEditingIndex(idx);
    setDraft({ systemPrompt: '', ...skills[idx] });
    setDialogOpen(true);
  };

  const save = () => {
    let cmd = draft.cmd.trim();
    if (!cmd) {
      toast({ title: 'Commande requise', variant: 'destructive' });
      return;
    }
    if (cmd.startsWith('/')) cmd = cmd.slice(1);
    cmd = cmd.replace(/\s+/g, '-').toLowerCase();
    cmd = '/' + cmd;
    const desc = draft.desc.trim() || cmd;
    const prompt = draft.prompt.trim();
    if (!prompt) {
      toast({ title: 'Prompt utilisateur requis', variant: 'destructive' });
      return;
    }
    const systemPrompt = (draft.systemPrompt || '').trim();
    const dupIdx = skills.findIndex(s => s.cmd === cmd);
    if (dupIdx !== -1 && dupIdx !== editingIndex) {
      toast({ title: 'Doublon', description: `${cmd} existe déjà.`, variant: 'destructive' });
      return;
    }
    const next = [...skills];
    const entry: CustomSkill = { cmd, desc, prompt, systemPrompt: systemPrompt || undefined };
    if (editingIndex !== null) next[editingIndex] = entry;
    else next.push(entry);
    setSkills(next);
    setDialogOpen(false);
    toast({ title: editingIndex !== null ? 'Prompt mis à jour' : 'Prompt ajouté' });
  };

  const remove = (idx: number) => {
    setSkills(prev => prev.filter((_, i) => i !== idx));
  };

  const addFromTemplate = (t: typeof RECOMMENDED[number]) => {
    if (skills.some(s => s.cmd === t.cmd)) {
      toast({ title: 'Déjà ajouté', description: `${t.cmd} est déjà dans votre bibliothèque.` });
      return;
    }
    setSkills(prev => [...prev, { cmd: t.cmd, desc: t.title, prompt: t.prompt }]);
    toast({ title: 'Ajouté', description: `${t.cmd} ajouté à votre bibliothèque.` });
  };

  const sortedSkills = useMemo(() => [...skills].sort((a, b) => a.cmd.localeCompare(b.cmd)), [skills]);

  // ── Built-in commands (editable / hideable) ──
  const [overrides, setOverrides] = useState<Record<string, BuiltinOverride>>(() => loadBuiltinOverrides());
  const [hidden, setHidden] = useState<string[]>(() => loadBuiltinHidden());
  useEffect(() => { try { localStorage.setItem(BUILTIN_OVERRIDES_KEY, JSON.stringify(overrides)); } catch {} }, [overrides]);
  useEffect(() => { try { localStorage.setItem(BUILTIN_HIDDEN_KEY, JSON.stringify(hidden)); } catch {} }, [hidden]);

  const [builtinDialogOpen, setBuiltinDialogOpen] = useState(false);
  const [builtinDraft, setBuiltinDraft] = useState<{ cmd: string; desc: string; prompt: string } | null>(null);

  const openBuiltinEdit = (cmd: string) => {
    const base = BUILTIN_SLASH_COMMANDS.find(b => b.cmd === cmd);
    if (!base) return;
    const o = overrides[cmd] || {};
    setBuiltinDraft({ cmd, desc: o.desc ?? base.desc, prompt: o.prompt ?? base.prompt });
    setBuiltinDialogOpen(true);
  };

  const saveBuiltin = () => {
    if (!builtinDraft) return;
    const base = BUILTIN_SLASH_COMMANDS.find(b => b.cmd === builtinDraft.cmd);
    if (!base) return;
    const next = { ...overrides };
    const desc = builtinDraft.desc.trim();
    const prompt = builtinDraft.prompt.trim();
    if (desc === base.desc && prompt === base.prompt) {
      delete next[builtinDraft.cmd];
    } else {
      next[builtinDraft.cmd] = { desc, prompt };
    }
    setOverrides(next);
    setBuiltinDialogOpen(false);
    toast({ title: 'Commande mise à jour' });
  };

  const resetBuiltin = (cmd: string) => {
    const next = { ...overrides };
    delete next[cmd];
    setOverrides(next);
    setHidden(prev => prev.filter(c => c !== cmd));
    toast({ title: 'Réinitialisé' });
  };

  const toggleHideBuiltin = (cmd: string) => {
    setHidden(prev => prev.includes(cmd) ? prev.filter(c => c !== cmd) : [...prev, cmd]);
  };

  const PLATFORM_RULES: CustomSkill[] = [
    {
      cmd: '/rules',
      desc: 'Règles Absolues (Priorité Maximale)',
      prompt: "Applique les Règles Absolues. À partir des données fournies (ou demandées), produis une analyse + plan d'action priorisé.",
      systemPrompt: `Tu es l'assistant IA de gestion COD (Algérie / MENA) intégré à la plateforme Outis.

RÈGLES ABSOLUES — NE JAMAIS ENFREINDRE :
1. Réponds toujours en français clair, concis et structuré (titres, bullets, tableaux markdown).
2. Fuseau horaire = Africa/Algiers (UTC+1). Toutes les dates/heures sont locales.
3. N'invente JAMAIS de chiffres. Si une donnée manque, demande-la ou utilise un outil pour la chercher.
4. Toujours baser les recommandations sur les données réelles (commandes, stock, ROAS, taux confirmation/livraison).
5. Statuts terminaux = Livré / Retour / Annulé. Une commande Confirmée ne passe à Préparation que manuellement.
6. Téléphone toujours au format local 0XXXXXXXXX. Wilayas sans préfixe numérique ("16 - Alger" → "Alger").
7. Avant toute écriture (changer statut, modifier commande, supprimer, envoyer WhatsApp), demande confirmation.
8. Format de sortie type : Diagnostic → Causes → Plan d'action 3-5 étapes priorisées → KPIs à suivre.`,
    },
    {
      cmd: '/confirmation',
      desc: 'Règles équipe Confirmation',
      prompt: "Analyse la performance de l'équipe de confirmation aujourd'hui et propose des actions.",
      systemPrompt: `Tu es expert en optimisation d'équipes de confirmation COD Algérie.

RÈGLES :
- Analyse par agent : nb commandes traitées, taux confirmation, temps moyen, taux d'injoignable.
- Identifie les agents sous-performants (taux conf < moyenne -10%) et les top performers.
- Propose réassignations équitables selon les heures de travail (Africa/Algiers, gestion shifts overnight).
- Pour clients injoignables : recommander relance WhatsApp automatique avant annulation.
- Toute suggestion doit être chiffrée (ex : "Réassigner 12 commandes de X vers Y → +8% conf estimé").`,
    },
    {
      cmd: '/livraison',
      desc: 'Règles Logistique & ZR Express',
      prompt: 'Analyse la performance logistique (livraison, retours, ZR Express + livreurs locaux) et propose des actions.',
      systemPrompt: `Tu es expert logistique COD Algérie, spécialisé ZR Express et livreurs locaux.

RÈGLES :
- Sépare clairement : livraisons à domicile vs Stop Desk (point relais).
- Surveille les taux de retour par wilaya, par livreur (y compris les "local:..."), par produit.
- Wilayas à fort taux de retour (>30%) → recommander Stop Desk obligatoire ou pré-paiement.
- Calcule le coût logistique réel (livraison + retour) et l'impact sur la marge nette.
- Alerte sur commandes bloquées >7 jours en transit.`,
    },
    {
      cmd: '/stock',
      desc: 'Règles Inventaire',
      prompt: 'Audit du stock : ruptures, réassorts à prévoir, produits dormants.',
      systemPrompt: `Tu es expert gestion de stock e-commerce COD.

RÈGLES :
- Stock dispo = stock physique − réservé (commandes en cours, hors statuts terminaux).
- Alerte rupture si stock dispo < ventes moyennes 7 jours × 3.
- Pour bundles/cadeaux à 0 DA : vérifier que les composants sont bien décomptés.
- Recommander réassorts chiffrés : "Produit X : commander Y unités d'ici Z jours".
- Identifier les produits dormants (0 vente 30j) à liquider.`,
    },
    {
      cmd: '/ads',
      desc: 'Règles Media Buying COD',
      prompt: 'Analyse les performances ads (Meta/TikTok/Google) sous angle COD : CPL, conf, livraison, ROAS net.',
      systemPrompt: `Tu es Senior Media Buyer COD MENA (Meta, TikTok, Google).

RÈGLES :
- KPIs prioritaires COD : CPL, taux confirmation, taux livraison, ROAS net (après retours).
- Ne juge JAMAIS un ad set sur ROAS brut sans intégrer le taux de livraison réel.
- Seuils de scaling : ad set rentable 3 jours consécutifs → +20% budget. Perte 2 jours → kill.
- Sépare diagnostic par wilaya, plateforme, créa, audience.
- Toujours fournir : 3 actions immédiates + 2 tests A/B à lancer.`,
    },
    {
      cmd: '/finance',
      desc: 'Règles Reporting financier',
      prompt: 'Donne-moi le reporting financier COD net (CA livré, marge brute, marge nette) avec comparaison période précédente.',
      systemPrompt: `Tu es contrôleur de gestion e-commerce COD.

RÈGLES :
- Revenu net = Σ commandes livrées − coût produit − frais livraison réels − frais retour − coût ads.
- N'inclus JAMAIS les commandes en attente / non livrées dans le CA.
- Sépare clairement : CA brut, CA livré, marge brute, marge nette.
- Période par défaut = aujourd'hui (Africa/Algiers). Toujours préciser la période.
- Formats : tableau markdown avec totaux + variation vs période précédente.`,
    },
    {
      cmd: '/whatsapp',
      desc: 'Règles Communication WhatsApp',
      prompt: 'Propose une stratégie de communication WhatsApp (relances, confirmation, ton) pour les clients en attente.',
      systemPrompt: `Tu es expert communication WhatsApp pour COD MENA via WASender.

RÈGLES :
- Respecte TOUJOURS le toggle global "confirmation automatique" : si désactivé, ne propose aucun envoi auto.
- Ignore les messages réactions emoji (déjà filtrés côté webhook).
- Vérifie disponibilité WhatsApp du numéro avant tout envoi (cache 3 niveaux).
- Messages courts, en darija/arabe ou français selon le client, ton respectueux.
- Pour relance injoignable : 1er msg J+0, 2e J+1, 3e J+2 → puis annulation auto si toujours muet.`,
    },
  ];

  const allPackPresent = PLATFORM_RULES.every(r => skills.some(s => s.cmd === r.cmd));

  const addPlatformRulesPack = () => {
    const existing = new Set(skills.map(s => s.cmd));
    const toAdd = PLATFORM_RULES.filter(r => !existing.has(r.cmd));
    if (toAdd.length === 0) {
      toast({ title: 'Tous déjà ajoutés' });
      return;
    }
    setSkills(prev => [...prev, ...toAdd]);
    toast({ title: 'Pack ajouté', description: `${toAdd.length} règle(s) ajoutée(s) à votre bibliothèque.` });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/chatbot')}
              className="-ml-2 mb-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour au chat
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Mes Prompts</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Bibliothèque de prompts réutilisables comme commandes slash dans le Hub IA et le Copilot.
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau prompt
          </Button>
        </div>

        {/* Built-in commands */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
              COMMANDES INTÉGRÉES ({BUILTIN_SLASH_COMMANDS.length})
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Modifiez le libellé/prompt ou masquez celles inutiles. "Réinitialiser" rétablit les valeurs d'origine.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {BUILTIN_SLASH_COMMANDS.map(b => {
              const o = overrides[b.cmd];
              const isHidden = hidden.includes(b.cmd);
              const isOverridden = !!o;
              const desc = o?.desc ?? b.desc;
              const prompt = o?.prompt ?? b.prompt;
              return (
                <div key={b.cmd} className={cn("rounded-xl border bg-card p-3", isHidden && "opacity-50")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-primary">{b.cmd}</span>
                        {isOverridden && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">modifié</span>}
                        {isHidden && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">masqué</span>}
                      </div>
                      <div className="text-sm font-semibold mt-0.5 truncate">{desc}</div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{prompt}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openBuiltinEdit(b.cmd)} title="Modifier">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleHideBuiltin(b.cmd)} title={isHidden ? 'Réafficher' : 'Masquer'}>
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                      {(isOverridden || isHidden) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resetBuiltin(b.cmd)} title="Réinitialiser">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* My prompts */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider">
            MES PROMPTS ({skills.length})
          </h2>
          {sortedSkills.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucun prompt personnalisé. Créez-en un ou ajoutez un modèle recommandé.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedSkills.map((s) => {
                const idx = skills.findIndex(x => x.cmd === s.cmd);
                return (
                  <div key={s.cmd} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-mono text-primary">{s.cmd}</div>
                        <div className="text-sm font-semibold mt-0.5 truncate">{s.desc}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(idx)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic line-clamp-4 whitespace-pre-wrap">
                      System: {s.prompt}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? 'Modifier le prompt' : 'Nouveau prompt'}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              La commande sera utilisable comme <span className="font-mono text-primary">{draft.cmd ? (draft.cmd.startsWith('/') ? draft.cmd : '/' + draft.cmd) : '/commande'}</span> dans le Hub IA.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Commande</Label>
                <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="px-2 text-muted-foreground font-mono text-sm">/</span>
                  <Input
                    value={draft.cmd.replace(/^\//, '')}
                    onChange={(e) => setDraft(d => ({ ...d, cmd: e.target.value }))}
                    placeholder="rules"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Libellé</Label>
                <Input
                  value={draft.desc}
                  onChange={(e) => setDraft(d => ({ ...d, desc: e.target.value }))}
                  placeholder="Règles Absolues (Priorité Maximale)"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prompt utilisateur</Label>
              <Textarea
                value={draft.prompt}
                onChange={(e) => setDraft(d => ({ ...d, prompt: e.target.value }))}
                placeholder="Applique les Règles Absolues. À partir des données fournies (ou demandées), produis une analyse + plan d'action priorisé."
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">System prompt (optionnel)</Label>
              <Textarea
                value={draft.systemPrompt || ''}
                onChange={(e) => setDraft(d => ({ ...d, systemPrompt: e.target.value }))}
                placeholder="Tu es un assistant IA spécialisé en performance marketing pour le e-commerce COD (Algérie / MENA)…"
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={save}>{editingIndex !== null ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={builtinDialogOpen} onOpenChange={setBuiltinDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Modifier la commande intégrée</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-mono text-primary">{builtinDraft?.cmd}</span> — la commande elle-même n'est pas modifiable.
            </p>
          </DialogHeader>
          {builtinDraft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Libellé</Label>
                <Input
                  value={builtinDraft.desc}
                  onChange={(e) => setBuiltinDraft(d => d ? { ...d, desc: e.target.value } : d)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prompt envoyé</Label>
                <Textarea
                  value={builtinDraft.prompt}
                  onChange={(e) => setBuiltinDraft(d => d ? { ...d, prompt: e.target.value } : d)}
                  rows={6}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuiltinDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveBuiltin}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
