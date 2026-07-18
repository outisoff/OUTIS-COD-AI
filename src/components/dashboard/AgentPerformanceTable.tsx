import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface AgentPerformanceTableProps {
  data: { name: string; confirmed: number; cancelled: number; rate: number }[];
}

export function AgentPerformanceTable({ data }: AgentPerformanceTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Performance des Agents</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="data-table-header">Agent</TableHead>
              <TableHead className="data-table-header text-right">Confirmés</TableHead>
              <TableHead className="data-table-header text-right">Annulés</TableHead>
              <TableHead className="data-table-header">Taux</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((agent, index) => (
              <TableRow key={index} className="hover:bg-muted/50">
                <TableCell className="font-medium text-sm">{agent.name}</TableCell>
                <TableCell className="text-right text-sm text-success">{agent.confirmed}</TableCell>
                <TableCell className="text-right text-sm text-destructive">{agent.cancelled}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={agent.rate} className="h-2 w-16" />
                    <span className="text-sm font-medium">{agent.rate}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
