import { useState } from 'react';
import { Receipt, SlidersHorizontal, Settings2, BarChart3, Tags, CalendarDays } from 'lucide-react';
import ChargesManager from '@/components/charges/ChargesManager';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export default function Charges() {
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [activeView, setActiveView] = useState<'stats' | 'tarifs'>('stats');

  const today = new Date();
  const [statsDateRange, setStatsDateRange] = useState<DateRange>({
    from: new Date(2020, 0, 1),
    to: today,
  });

  const formatDateLabel = () => {
    if (!statsDateRange.from) return 'Sélectionner';
    const fromStr = format(statsDateRange.from, 'd-MMM', { locale: fr }).replace('.', '');
    const toStr = statsDateRange.to
      ? format(statsDateRange.to, 'd-MMM', { locale: fr }).replace('.', '')
      : fromStr;
    const year = statsDateRange.to
      ? format(statsDateRange.to, 'yyyy')
      : format(statsDateRange.from, 'yyyy');
    if (fromStr === toStr) return `${fromStr} ( ${year} )`;
    return `${fromStr} / ${toStr} ( ${year} )`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Charges</h1>
            <p className="text-sm text-muted-foreground">Gestion des charges et dépenses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeView === 'stats' && (
            <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatDateLabel()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 flex" align="end">
                <div className="border-r p-3 space-y-1 w-[170px]">
                  <p className="text-sm font-medium text-muted-foreground mb-2 px-2">Raccourcis</p>
                  {[
                    { label: "Aujourd'hui", from: today, to: today },
                    { label: 'Hier', from: subDays(today, 1), to: subDays(today, 1) },
                    { label: "Hier et aujourd'hui", from: subDays(today, 1), to: today },
                    { label: '7 derniers jours', from: subDays(today, 6), to: today },
                    { label: '30 derniers jours', from: subDays(today, 29), to: today },
                    { label: 'Ce mois', from: startOfMonth(today), to: today },
                    { label: 'Maximum', from: new Date(2020, 0, 1), to: today },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'w-full justify-start text-sm font-normal h-8 px-2',
                        statsDateRange.from?.toDateString() === preset.from.toDateString() &&
                          statsDateRange.to?.toDateString() === preset.to.toDateString() &&
                          'bg-accent text-accent-foreground'
                      )}
                      onClick={() => setStatsDateRange({ from: preset.from, to: preset.to })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={statsDateRange}
                  onSelect={(range) => {
                    if (range?.from) {
                      setStatsDateRange({ from: range.from, to: range.to || range.from });
                    }
                  }}
                  locale={fr}
                  disabled={(date) => date > new Date()}
                  numberOfMonths={2}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant={showFilters || activeFiltersCount > 0 ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setShowFilters(s => !s)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtrage
              {activeFiltersCount > 0 && (
                <span className="ml-1 flex items-center justify-center h-5 w-5 rounded-full bg-primary-foreground text-primary text-xs font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            </>
          )}
          {activeView === 'tarifs' && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setManageOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
                Gérer catégories
              </Button>
              <Button
                variant={showFilters || activeFiltersCount > 0 ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => setShowFilters(s => !s)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtrage
                {activeFiltersCount > 0 && (
                  <span className="ml-1 flex items-center justify-center h-5 w-5 rounded-full bg-primary-foreground text-primary text-xs font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'stats' | 'tarifs')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="tarifs" className="gap-2">
            <Tags className="h-4 w-4" />
            Détails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <ChargesManager
            view="stats"
            dateFrom={statsDateRange.from}
            dateTo={statsDateRange.to}
            showFilters={showFilters}
            onShowFiltersChange={setShowFilters}
            onActiveFiltersCountChange={setActiveFiltersCount}
          />
        </TabsContent>

        <TabsContent value="tarifs" className="mt-4">
          <ChargesManager
            view="tables"
            showFilters={showFilters}
            onShowFiltersChange={setShowFilters}
            onActiveFiltersCountChange={setActiveFiltersCount}
            manageOpen={manageOpen}
            onManageOpenChange={setManageOpen}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
