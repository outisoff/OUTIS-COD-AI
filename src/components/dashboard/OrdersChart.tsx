import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrdersChartProps {
  data: { date: string; orders: number; delivered: number; cancelled: number; failed: number; returned?: number }[];
  title?: string;
}

export function OrdersChart({ data, title = 'Commandes' }: OrdersChartProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cancelledGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend
                verticalAlign="top"
                height={30}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="orders"
                name="Total"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                fill="url(#ordersGradient)"
              />
              <Area
                type="monotone"
                dataKey="delivered"
                name="Livré"
                stroke="hsl(152, 69%, 40%)"
                strokeWidth={2}
                fill="url(#deliveredGradient)"
              />
              <Area
                type="monotone"
                dataKey="cancelled"
                name="Annulée"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fill="url(#cancelledGradient)"
              />
              <Area
                type="monotone"
                dataKey="failed"
                name="Échec"
                stroke="hsl(25, 95%, 53%)"
                strokeWidth={2}
                fill="url(#failedGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
