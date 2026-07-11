import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

interface DeliveryRateChartProps {
  data: { status: string; count: number }[];
}

const categories = [
  {
    label: 'Livré',
    color: 'hsl(152, 69%, 35%)',
    statuses: ['delivered', 'delivered_paid'],
  },
  {
    label: 'En livraison',
    color: 'hsl(270, 70%, 60%)',
    statuses: ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison'],
  },
  {
    label: 'Échec',
    color: 'hsl(0, 84%, 55%)',
    statuses: ['Échec_de_livraison'],
  },
  {
    label: 'Retour',
    color: 'hsl(0, 60%, 38%)',
    statuses: ['returned'],
  },
];

export function DeliveryRateChart({ data }: DeliveryRateChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const shippedStatuses = ['shipped', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'Échec_de_livraison', 'delivered', 'delivered_paid', 'returned'];
  const shippedData = data.filter(item => shippedStatuses.includes(item.status));
  const total = shippedData.reduce((sum, item) => sum + item.count, 0);

  const chartData = categories
    .map(cat => {
      const count = shippedData
        .filter(item => cat.statuses.includes(item.status))
        .reduce((sum, item) => sum + item.count, 0);
      return { name: cat.label, value: count, color: cat.color };
    })
    .filter(item => item.value > 0);

  const delivered = chartData.find(d => d.name === 'Livré')?.value || 0;
  const returned = (chartData.find(d => d.name === 'Retour')?.value || 0) + (chartData.find(d => d.name === 'Échec')?.value || 0);
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const returnRate = total > 0 ? Math.round((returned / total) * 100) : 0;

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;
  const activePct = activeItem && total > 0 ? Math.round((activeItem.value / total) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Taux de Livraison <span className="font-normal text-muted-foreground">( {total} Expédiés )</span></CardTitle>
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
                <p className="text-xl font-bold text-emerald-600">{deliveryRate}%</p>
                <p className="text-[10px] text-muted-foreground font-bold">Livré</p>
                <div className="my-0.5" />
                <p className="text-xl font-bold text-destructive">{returnRate}%</p>
                <p className="text-[10px] text-muted-foreground font-bold">Retour</p>
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
                  <span className="text-[11px] text-muted-foreground w-20 truncate">{item.name}</span>
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
