import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Order, OrderStatus } from '@/types';
import { OrderStatusBadge, allOrderStatuses } from './OrderStatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Download, Eye, Phone, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OrdersTableProps {
  orders: Order[];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerPhone.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAllOrders = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Liste des Commandes</CardTitle>
          <div className="flex items-center gap-2">
            {selectedOrders.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions ({selectedOrders.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Assigner à un agent</DropdownMenuItem>
                  <DropdownMenuItem>Envoyer en livraison</DropdownMenuItem>
                  <DropdownMenuItem>Exporter Excel</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par ID, nom, téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border shadow-lg z-50">
              <ScrollArea className="h-[300px]">
                <SelectItem value="all">Tous les statuts</SelectItem>
                {allOrderStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </ScrollArea>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="data-table-header w-12">
                <Checkbox
                  checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={toggleAllOrders}
                />
              </TableHead>
              <TableHead className="data-table-header">ID</TableHead>
              <TableHead className="data-table-header">Client</TableHead>
              <TableHead className="data-table-header">Wilaya</TableHead>
              <TableHead className="data-table-header">Produit</TableHead>
              <TableHead className="data-table-header text-right">Total</TableHead>
              <TableHead className="data-table-header">Statut</TableHead>
              <TableHead className="data-table-header">Agent</TableHead>
              <TableHead className="data-table-header">Date</TableHead>
              <TableHead className="data-table-header w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedOrders.includes(order.id)}
                    onCheckedChange={() => toggleOrderSelection(order.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-sm">{order.id}</TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{order.wilaya}</TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{order.products[0]?.productName}</p>
                    {order.products.length > 1 && (
                      <p className="text-xs text-muted-foreground">+{order.products.length - 1} autre(s)</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatCurrency(order.totalPrice)}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {order.assignedAgent || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(order.createdAt, 'dd MMM HH:mm', { locale: fr })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={`tel:${order.customerPhone}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={`https://wa.me/${order.customerPhone.replace(/\s/g, '').replace('+', '')}`} target="_blank" rel="noopener noreferrer">
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {filteredOrders.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Aucune commande trouvée</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
