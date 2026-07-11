import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, X, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useChargeCategories, useAddChargeCategory, useDeleteChargeCategory,
} from '@/hooks/useChargeCategories';
import {
  useChargeSubcategories, useAddChargeSubcategory, useDeleteChargeSubcategory,
} from '@/hooks/useChargeSubcategories';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategories: { value: string; label: string }[];
}

const colorPalette = [
  { value: 'slate', dot: 'bg-slate-500' },
  { value: 'orange', dot: 'bg-orange-500' },
  { value: 'purple', dot: 'bg-purple-500' },
  { value: 'blue', dot: 'bg-blue-500' },
  { value: 'amber', dot: 'bg-amber-500' },
  { value: 'green', dot: 'bg-green-500' },
  { value: 'emerald', dot: 'bg-emerald-500' },
  { value: 'pink', dot: 'bg-pink-500' },
  { value: 'red', dot: 'bg-red-500' },
  { value: 'cyan', dot: 'bg-cyan-500' },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

export default function ManageCategoriesDialog({ open, onOpenChange, defaultCategories }: Props) {
  const { data: customCats = [] } = useChargeCategories();
  const addCat = useAddChargeCategory();
  const delCat = useDeleteChargeCategory();
  const { data: allSubs = [] } = useChargeSubcategories();
  const addSub = useAddChargeSubcategory();
  const delSub = useDeleteChargeSubcategory();

  const [newCat, setNewCat] = useState({ label: '', color: 'slate' });
  const [activeSubCategory, setActiveSubCategory] = useState<string>(defaultCategories[0]?.value || 'other');
  const [newSubName, setNewSubName] = useState('');

  const allCategories = useMemo(() => {
    const customMapped = customCats.map(c => ({ value: c.value, label: c.label, isDefault: false, id: c.id }));
    const defaults = defaultCategories.map(c => ({ ...c, isDefault: true, id: '' }));
    return [...defaults, ...customMapped];
  }, [customCats, defaultCategories]);

  const handleAddCategory = async () => {
    const label = newCat.label.trim();
    if (!label) return;
    const value = slugify(label);
    if (!value) { toast.error('Nom invalide'); return; }
    if (allCategories.some(c => c.value === value)) { toast.error('Existe déjà'); return; }
    try {
      await addCat.mutateAsync({ value, label, color: newCat.color, icon: 'LayoutGrid' });
      setNewCat({ label: '', color: 'slate' });
      toast.success('Catégorie ajoutée');
    } catch {
      toast.error('Erreur');
    }
  };

  const subsForActive = allSubs.filter(s => s.category === activeSubCategory);

  const handleAddSub = async () => {
    const name = newSubName.trim();
    if (!name) return;
    try {
      await addSub.mutateAsync({ category: activeSubCategory, name });
      setNewSubName('');
      toast.success('Sous-catégorie ajoutée');
    } catch (e: any) {
      toast.error(e?.message?.includes('duplicate') ? 'Existe déjà' : 'Erreur');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Gérer les catégories</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="categories" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories">Catégories</TabsTrigger>
            <TabsTrigger value="subcategories">Sous-catégories</TabsTrigger>
          </TabsList>

          {/* Categories tab */}
          <TabsContent value="categories" className="space-y-4 mt-4">
            <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <Label className="text-xs font-semibold">Ajouter une nouvelle catégorie</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Bureautique, Transport..."
                  value={newCat.label}
                  onChange={e => setNewCat(s => ({ ...s, label: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                  className="h-9"
                />
                <Select value={newCat.color} onValueChange={v => setNewCat(s => ({ ...s, color: v }))}>
                  <SelectTrigger className="h-9 w-[110px]">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <span className={cn('h-3 w-3 rounded-full', colorPalette.find(c => c.value === newCat.color)?.dot)} />
                        <span className="capitalize text-xs">{newCat.color}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {colorPalette.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-3 w-3 rounded-full', c.dot)} />
                          <span className="capitalize">{c.value}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddCategory} disabled={!newCat.label.trim() || addCat.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Toutes les catégories</Label>
              {allCategories.map(c => (
                <div key={c.value} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.isDefault && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="text-sm truncate">{c.label}</span>
                    {c.isDefault && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Par défaut</span>}
                  </div>
                  {!c.isDefault && (
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0"
                      onClick={async () => {
                        if (!confirm(`Supprimer "${c.label}" ?`)) return;
                        try { await delCat.mutateAsync(c.id); toast.success('Supprimée'); }
                        catch { toast.error('Erreur'); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Subcategories tab */}
          <TabsContent value="subcategories" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs font-semibold">Catégorie parent</Label>
              <Select value={activeSubCategory} onValueChange={setActiveSubCategory}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <Label className="text-xs font-semibold">Ajouter une sous-catégorie</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Facebook Ads, TikTok Ads..."
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSub(); } }}
                  className="h-9"
                />
                <Button size="sm" onClick={handleAddSub} disabled={!newSubName.trim() || addSub.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Sous-catégories de "{allCategories.find(c => c.value === activeSubCategory)?.label}"
              </Label>
              {subsForActive.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">Aucune sous-catégorie</p>
              ) : (
                subsForActive.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                    <span className="text-sm truncate">{s.name}</span>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0"
                      onClick={async () => {
                        try { await delSub.mutateAsync(s.id); toast.success('Supprimée'); }
                        catch { toast.error('Erreur'); }
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
