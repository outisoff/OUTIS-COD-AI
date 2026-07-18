import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Settings2, Plus, Trash2, Zap, RotateCcw, BarChart3, Tag, Package, Clock, Timer, PhoneOff } from 'lucide-react';
import { 
  useAssignmentRules, 
  useAssignmentSettings, 
  useAddAssignmentRule, 
  useDeleteAssignmentRule,
  useUpdateAssignmentMode,
  useToggleAutoAssignment,
  useUpdateWorkingHours,
  useToggleNoWhatsappAssign,
  useToggleInstantAssignNoAi,
  useUpdateStaleDelay,
  type AssignmentMode 
} from '@/hooks/useAssignmentRules';
import { Input } from '@/components/ui/input';
import { useProducts } from '@/hooks/useProducts';

interface AutoAssignDialogProps {
  confirmateurs: { id: string; full_name: string | null; email: string | null }[];
  onAutoAssign: () => void;
  isAssigning: boolean;
}

const sourceOptions = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'website', label: 'Website' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'other', label: 'Autre' },
];

const dayLabels = [
  { value: 0, label: 'Dim' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
];

const hourOptions = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${i}:00` }));

const modeConfig: Record<AssignmentMode, { label: string; description: string; icon: any }> = {
  round_robin: { label: 'Round-Robin', description: 'Distribution à tour de rôle équitable', icon: RotateCcw },
  workload: { label: 'Charge de travail', description: 'Assigner au confirmateur ayant le moins de commandes', icon: BarChart3 },
  rules: { label: 'Règles uniquement', description: 'Assigner selon les règles produit/planning/source', icon: Tag },
  combined: { label: 'Combiné', description: 'Règles d\'abord, puis round-robin pour le reste', icon: Zap },
};

export function AutoAssignDialog({ confirmateurs, onAutoAssign, isAssigning }: AutoAssignDialogProps) {
  const { data: rules = [] } = useAssignmentRules();
  const { data: settings } = useAssignmentSettings();
  const { data: products } = useProducts();
  const addRule = useAddAssignmentRule();
  const deleteRule = useDeleteAssignmentRule();
  const updateMode = useUpdateAssignmentMode();
  const toggleAuto = useToggleAutoAssignment();
  const updateWorkingHours = useUpdateWorkingHours();
  const toggleNoWhatsapp = useToggleNoWhatsappAssign();
  const updateStaleDelay = useUpdateStaleDelay();
  const toggleInstantNoAi = useToggleInstantAssignNoAi();

  const [newRuleType, setNewRuleType] = useState<string>('product');
  const [newRuleAgent, setNewRuleAgent] = useState<string>('');
  const [newRuleValue, setNewRuleValue] = useState<string>('');
  const [newDays, setNewDays] = useState<number[]>([]);
  const [newStartHour, setNewStartHour] = useState<string>('8');
  const [newEndHour, setNewEndHour] = useState<string>('16');

  const currentMode = (settings?.mode as AssignmentMode) || 'round_robin';
  const autoEnabled = settings?.auto_enabled === true || settings?.auto_enabled === 'true';
  const noWhatsappInstant = settings?.no_whatsapp_instant_assign === true || settings?.no_whatsapp_instant_assign === 'true';
  const instantAssignNoAi = settings?.instant_assign_no_ai === true || settings?.instant_assign_no_ai === 'true' || settings?.instant_assign_no_ai === undefined;
  const staleDelay = (settings?.stale_delay as number) ?? 120;
  const workingHours = settings?.working_hours as { start: number; end: number } | undefined;
  const workStart = workingHours?.start ?? 8;
  const workEnd = workingHours?.end ?? 20;

  const handleAddRule = () => {
    if (!newRuleAgent) return;
    if (newRuleType === 'schedule') {
      if (newDays.length === 0) return;
      addRule.mutate({
        rule_type: 'schedule',
        agent_name: newRuleAgent,
        match_value: 'schedule',
        days_of_week: newDays,
        start_hour: parseInt(newStartHour),
        end_hour: parseInt(newEndHour),
      });
      setNewDays([]);
      setNewStartHour('8');
      setNewEndHour('16');
    } else {
      if (!newRuleValue) return;
      addRule.mutate({
        rule_type: newRuleType,
        agent_name: newRuleAgent,
        match_value: newRuleValue,
      });
      setNewRuleValue('');
    }
    setNewRuleAgent('');
  };

  const toggleDay = (day: number) => {
    setNewRuleType('schedule');
    setNewDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  const sourceRules = rules.filter(r => r.rule_type === 'source');
  const productRules = rules.filter(r => r.rule_type === 'product');
  const scheduleRules = rules.filter(r => r.rule_type === 'schedule');

  const AgentSelect = ({ ruleType }: { ruleType: string }) => (
    <Select value={newRuleType === ruleType ? newRuleAgent : ''} onValueChange={(v) => { setNewRuleType(ruleType); setNewRuleAgent(v); }}>
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Agent..." />
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border shadow-lg z-50">
        {confirmateurs.map(a => (
          <SelectItem key={a.id} value={a.full_name || a.email || 'Agent'}>
            {a.full_name || a.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant={autoEnabled ? "default" : "outline"} 
          size="sm" 
          className={cn(
            "gap-2 transition-all",
            autoEnabled && "bg-green-600 text-white shadow-md hover:bg-green-700 border-green-600"
          )}
        >
          <Settings2 className={cn("h-4 w-4", autoEnabled && "animate-spin-slow")} />
          Assignation auto
          {autoEnabled ? (
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 border-primary-foreground/30 text-primary-foreground bg-primary-foreground/10">
              {modeConfig[currentMode]?.label || 'Actif'}
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 opacity-60">
              Inactif
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Assignation automatique
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="space-y-6">
            {/* Auto-assign toggle */}
            <Card>
              <CardContent className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-toggle" className="text-sm font-medium">Assignation automatique</Label>
                    <p className="text-xs text-muted-foreground">Assigner automatiquement les nouvelles commandes</p>
                  </div>
                  <Switch
                    id="auto-toggle"
                    checked={autoEnabled}
                    onCheckedChange={(checked) => toggleAuto.mutate(checked)}
                  />
                </div>
                <div className="flex items-center justify-between pl-1">
                  <p className="text-xs text-primary flex items-center gap-1.5 font-medium">
                    <PhoneOff className="h-3.5 w-3.5" />
                    Assigner si pas de WhatsApp
                  </p>
                  <Switch
                    id="no-whatsapp-toggle"
                    checked={noWhatsappInstant}
                    onCheckedChange={(checked) => toggleNoWhatsapp.mutate(checked)}
                    className="scale-90"
                  />
                </div>
                <div className="flex items-center justify-between pl-1">
                  <p className="text-xs text-primary flex items-center gap-1.5 font-medium">
                    <Zap className="h-3.5 w-3.5" />
                    Assigner direct si IA désactivée
                  </p>
                  <Switch
                    id="assign-no-ai-toggle"
                    checked={instantAssignNoAi}
                    onCheckedChange={(checked) => toggleInstantNoAi.mutate(checked)}
                    className="scale-90"
                  />
                </div>
              </CardContent>
            </Card>

            {autoEnabled && (
            <>

            {/* Working Hours + Delay */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Horaires de travail des agents</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  L'assignation ne se fait que pendant ces horaires. La nuit, les commandes restent en attente.
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">De</span>
                    <Select 
                      value={String(workStart)} 
                      onValueChange={(v) => updateWorkingHours.mutate({ startHour: Number(v), endHour: workEnd })}
                    >
                      <SelectTrigger className="w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <ScrollArea className="h-[200px]">
                          {hourOptions.map(h => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">à</span>
                    <Select 
                      value={String(workEnd)} 
                      onValueChange={(v) => updateWorkingHours.mutate({ startHour: workStart, endHour: Number(v) })}
                    >
                      <SelectTrigger className="w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <ScrollArea className="h-[200px]">
                          {hourOptions.map(h => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Délai avant assignation</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Pendant les horaires de travail, si l'IA ne confirme pas après ce délai → assignation à un agent
                  </p>
                  <Select
                    value={String(staleDelay)}
                    onValueChange={(v) => updateStaleDelay.mutate(Number(v))}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-lg z-50">
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 heure</SelectItem>
                      <SelectItem value="90">1h 30min</SelectItem>
                      <SelectItem value="120">2 heures</SelectItem>
                      <SelectItem value="180">3 heures</SelectItem>
                      <SelectItem value="240">4 heures</SelectItem>
                      <SelectItem value="360">6 heures</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-[11px] text-muted-foreground/70 mt-2">
                  Ex: De 8:00 à 20:00 → si l'IA ne confirme pas après le délai, assignation auto. De 20:00 à 8:00 → aucune assignation, les commandes attendent.
                </p>
              </CardContent>
            </Card>


            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Mode d'assignation</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {(Object.entries(modeConfig) as [AssignmentMode, typeof modeConfig[AssignmentMode]][]).map(([mode, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => updateMode.mutate(mode)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                        currentMode === mode
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${currentMode === mode ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="text-sm font-medium">{config.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Rules Configuration */}
            {(currentMode === 'rules' || currentMode === 'combined') && (
              <Tabs defaultValue="product" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="product" className="gap-1">
                    <Package className="h-3.5 w-3.5" />
                    Produit ({productRules.length})
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Planning ({scheduleRules.length})
                  </TabsTrigger>
                  <TabsTrigger value="source" className="gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    Source ({sourceRules.length})
                  </TabsTrigger>
                </TabsList>

                {/* Product rules tab */}
                <TabsContent value="product" className="space-y-3 mt-3">
                  <div className="flex gap-2">
                    <Select value={newRuleType === 'product' ? newRuleValue : ''} onValueChange={(v) => { setNewRuleType('product'); setNewRuleValue(v); }}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Produit..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <ScrollArea className="h-[200px]">
                          {products?.map(p => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <AgentSelect ruleType="product" />
                    <Button size="icon" onClick={handleAddRule} disabled={newRuleType !== 'product' || !newRuleAgent || !newRuleValue}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {productRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune règle par produit</p>
                  ) : (
                    <div className="space-y-2">
                      {productRules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{rule.match_value}</Badge>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span className="text-sm font-medium">{rule.agent_name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRule.mutate(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Schedule rules tab */}
                <TabsContent value="schedule" className="space-y-3 mt-3">
                  <div className="space-y-3">
                    {/* Days selection */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Jours de travail</p>
                      <div className="flex gap-1.5">
                        {dayLabels.map(day => (
                          <button
                            key={day.value}
                            onClick={() => toggleDay(day.value)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all",
                              newDays.includes(day.value)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                            )}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Hours */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">De</p>
                        <Select value={newStartHour} onValueChange={(v) => { setNewRuleType('schedule'); setNewStartHour(v); }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border border-border shadow-lg z-50">
                            <ScrollArea className="h-[200px]">
                              {hourOptions.map(h => (
                                <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                              ))}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">À</p>
                        <Select value={newEndHour} onValueChange={(v) => { setNewRuleType('schedule'); setNewEndHour(v); }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border border-border shadow-lg z-50">
                            <ScrollArea className="h-[200px]">
                              {hourOptions.map(h => (
                                <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                              ))}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Agent + add */}
                    <div className="flex gap-2">
                      <AgentSelect ruleType="schedule" />
                      <Button size="icon" onClick={handleAddRule} disabled={newRuleType !== 'schedule' || !newRuleAgent || newDays.length === 0}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {scheduleRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun planning configuré</p>
                  ) : (
                    <div className="space-y-2">
                      {scheduleRules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex gap-1">
                              {(rule.days_of_week || []).map(d => (
                                <Badge key={d} variant="outline" className="text-[10px] px-1.5">
                                  {dayLabels.find(dl => dl.value === d)?.label}
                                </Badge>
                              ))}
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {rule.start_hour ?? 0}:00 - {rule.end_hour ?? 23}:00
                            </Badge>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span className="text-sm font-medium">{rule.agent_name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteRule.mutate(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Source rules tab */}
                <TabsContent value="source" className="space-y-3 mt-3">
                  <div className="flex gap-2">
                    <Select value={newRuleType === 'source' ? newRuleValue : ''} onValueChange={(v) => { setNewRuleType('source'); setNewRuleValue(v); }}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Source..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        {sourceOptions.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AgentSelect ruleType="source" />
                    <Button size="icon" onClick={handleAddRule} disabled={newRuleType !== 'source' || !newRuleAgent || !newRuleValue}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {sourceRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune règle par source</p>
                  ) : (
                    <div className="space-y-2">
                      {sourceRules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{sourceOptions.find(s => s.value === rule.match_value)?.label || rule.match_value}</Badge>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span className="text-sm font-medium">{rule.agent_name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRule.mutate(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
            </>
            )}

            {confirmateurs.length === 0 && (
              <p className="text-xs text-destructive text-center">Aucun confirmateur disponible</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
