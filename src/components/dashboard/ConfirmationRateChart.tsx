import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

interface ConfirmationRateChartProps {
  data: { status: string; count: number }[];
}

const categories = [
  {
    label: 'Confirmé',
    color: 'hsl(160, 84%, 39%)',
    statuses: ['confirmed', 'validated', 'ready', 'preparing', 'shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'delivered', 'delivered_paid', 'Échec_de_livraison', 'returned'],
  },
  {
    label: 'Échoué',
    color: 'hsl(25, 95%, 53%)',
    statuses: ['failed_1', 'failed_2', 'failed_3', 'failed_4', 'failed_5', 'failed_6'],
  },
  {
    label: 'Reporter',
    color: 'hsl(270, 70%, 55%)',
    statuses: ['postponed', 'to_reconfirm', 'callback', 'exchange', 'alerte'],
  },
  {
    label: 'Annulées',
    color: 'hsl(0, 84%, 60%)',
    statuses: ['cancelled', 'wrong_number', 'duplicate', 'out_of_stock', 'no_answer'],
  },
  {
    label: 'Nouveau',
    color: 'hsl(210, 80%, 55%)',
    statuses: ['new'],
  },
];

export function ConfirmationRateChart({ data }: ConfirmationRateChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = categories
    .map(cat => {
      const count = data
        .filter(item => cat.statuses.includes(item.status))
        .reduce((sum, item) => sum + item.count, 0);
      return { name: cat.label, value: count, color: cat.color };
    });

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const confirmed = chartData.find(d => d.name === 'Confirmé')?.value || 0;
  const cancelled = chartData.find(d => d.name === 'Annulées')?.value || 0;
  const confirmRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  const filteredData = chartData.filter(d => d.value > 0);

  const activeItem = activeIndex !== null ? filteredData[activeIndex] : null;
  const activePct = activeItem && total > 0 ? Math.round((activeItem.value / total) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Taux de Confirmation <span className="font-normal text-muted-foreground">( {total} Orders )</span></CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="relative w-full h-[280px] [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none focus:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredData}
                cx="58%"
                cy="54%"
                innerRadius={85}
                outerRadius={130}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
                cornerRadius={4}
                labelLine={false}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {filteredData.map((entry, index) => (
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
                <p className="text-xl font-bold" style={{ color: 'hsl(160, 84%, 39%)' }}>{confirmRate}%</p>
                <p className="text-[10px] text-muted-foreground font-bold">Confirmé</p>
                <div className="my-0.5" />
                <p className="text-xl font-bold text-destructive">{cancelRate}%</p>
                <p className="text-[10px] text-muted-foreground font-bold">Annulé</p>
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
                  <span className="text-[11px] text-muted-foreground w-16 truncate">{item.name}</span>
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
