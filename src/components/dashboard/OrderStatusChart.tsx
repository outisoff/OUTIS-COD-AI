import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

interface OrderStatusChartProps {
  data: { status: string; count: number }[];
}

const groupedCategories = [
  {
    label: 'Confirmées',
    color: 'hsl(160, 84%, 39%)',
    statuses: ['confirmed', 'validated'],
  },
  {
    label: 'Livré',
    color: 'hsl(152, 69%, 35%)',
    statuses: ['delivered', 'delivered_paid'],
  },
  {
    label: 'En Attente',
    color: 'hsl(38, 92%, 50%)',
    statuses: ['new', 'failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6', 'postponed', 'to_reconfirm', 'callback', 'erreur'],
  },
  {
    label: 'Préparation',
    color: 'hsl(217, 91%, 60%)',
    statuses: ['preparing', 'ready'],
  },
  {
    label: 'Expédié',
    color: 'hsl(270, 70%, 60%)',
    statuses: ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison'],
  },
  {
    label: 'Annulées',
    color: 'hsl(0, 84%, 60%)',
    statuses: ['cancelled', 'wrong_number', 'out_of_stock', 'no_answer'],
  },
  {
    label: 'Retour',
    color: 'hsl(0, 60%, 40%)',
    statuses: ['Échec_de_livraison', 'returned'],
  },
];

export function OrderStatusChart({ data }: OrderStatusChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = groupedCategories
    .map(cat => {
      const count = data
        .filter(item => cat.statuses.includes(item.status))
        .reduce((sum, item) => sum + item.count, 0);
      return { name: cat.label, value: count, color: cat.color };
    })
    .filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.count, 0);

  const deliveredPct = total > 0 ? Math.round((chartData.find(d => d.name === 'Livré')?.value || 0) / total * 100) : 0;
  const echecPct = total > 0 ? Math.round(((chartData.find(d => d.name === 'Annulées')?.value || 0) + (chartData.find(d => d.name === 'Retour')?.value || 0)) / total * 100) : 0;

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;
  const activePct = activeItem && total > 0 ? Math.round((activeItem.value / total) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Taux des Commandes <span className="font-normal text-muted-foreground">( {total} Orders )</span></CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="relative w-full h-[280px] [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none focus:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="58%"
                cy="54%"
                innerRadius={85}
                outerRadius={130}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
                cornerRadius={4}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} style={{ cursor: 'pointer', opacity: activeIndex !== null && activeIndex !== index ? 0.5 : 1, transition: 'opacity 0.2s' }} />
                ))}
              </Pie>
              <Tooltip content={() => null} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-200" style={{ left: '16%', top: '8%' }}>
            {activeItem ? (
              <>
                <p className="text-3xl font-extrabold tracking-tight" style={{ color: activeItem.color }}>{activePct}%</p>
                <p className="text-[11px] font-bold text-muted-foreground mt-0.5">{activeItem.name}</p>
                <p className="text-sm font-semibold mt-1 text-foreground">{activeItem.value} commande{activeItem.value > 1 ? 's' : ''}</p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-emerald-600">{deliveredPct}%</p>
                <p className="text-[10px] text-muted-foreground font-bold">Livré</p>
                <div className="my-0.5" />
                <p className="text-xl font-bold text-destructive">{echecPct}%</p>
                <p className="text-[10px] text-muted-foreground font-bold">Échec</p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1 -mt-3">
          {[...chartData]
            .sort((a, b) => b.value - a.value)
            .map((item) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] text-muted-foreground w-14 truncate">{item.name}</span>
                  <span className="text-[11px] font-semibold text-foreground w-6 text-right">{item.value}</span>
                  <span className="text-[10px] text-muted-foreground w-7 text-right">{pct}%</span>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
