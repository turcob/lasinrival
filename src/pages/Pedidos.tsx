import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Filter,
  Eye,
  Truck,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePedidos, type PedidoEstado } from '@/hooks/usePedidos';
import { NuevoPedidoDialog } from '@/components/pedidos/NuevoPedidoDialog';
import { DetallePedidoDialog } from '@/components/pedidos/DetallePedidoDialog';
import { PrepararPedidoDialog } from '@/components/pedidos/PrepararPedidoDialog';
import { EditarPedidoDialog } from '@/components/pedidos/EditarPedidoDialog';
import { ConsolidadoPedidos } from '@/components/pedidos/ConsolidadoPedidos';
import { ConsolidadoFinalZona } from '@/components/pedidos/ConsolidadoFinalZona';

// Estados principales del sistema
const estadoConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  preparado: { label: 'Preparado', color: 'bg-blue-100 text-blue-800', icon: Package },
  despachado: { label: 'Despachado', color: 'bg-green-100 text-green-800', icon: Truck },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
  // Estados legacy (solo para visualización de pedidos históricos)
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  devuelto: { label: 'Devuelto', color: 'bg-red-100 text-red-100', icon: RotateCcw },
  anulado: { label: 'Anulado', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

// Solo estos estados se muestran en el filtro y estadísticas
const estadosActivos: PedidoEstado[] = ['pendiente', 'preparado', 'despachado', 'rechazado'];

export default function Pedidos() {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<PedidoEstado | 'todos'>('todos');
  const [nuevoDialogOpen, setNuevoDialogOpen] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null);
  const [prepararPedidoId, setPrepararPedidoId] = useState<string | null>(null);
  const [editarPedidoId, setEditarPedidoId] = useState<string | null>(null);
  const { data: pedidos, isLoading } = usePedidos(
    filtroEstado !== 'todos' ? { estado: filtroEstado } : undefined
  );

  const pedidosFiltrados = pedidos?.filter(p => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      p.numero_pedido.toString().includes(term) ||
      p.cliente?.nombre.toLowerCase().includes(term) ||
      p.cliente?.codigo_cliente?.toLowerCase().includes(term)
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  return (
    <MainLayout>
      <PageHeader
        title="Gestión de Pedidos"
        description="Administra los pedidos y preventas del sistema"
      />

      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          <TabsTrigger value="consolidado-zona">Consolidado Final</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, cliente..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as PedidoEstado | 'todos')}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {estadosActivos.map((key) => (
                    <SelectItem key={key} value={key}>
                      {estadoConfig[key]?.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setNuevoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {estadosActivos.map((key) => {
                const config = estadoConfig[key];
                const count = pedidos?.filter(p => p.estado === key).length || 0;
                const Icon = config.icon;
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      filtroEstado === key ? 'ring-2 ring-primary' : ''
                    } ${config.color}`}
                    onClick={() => setFiltroEstado(filtroEstado === key ? 'todos' : key as PedidoEstado)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{count}</p>
                  </div>
                );
              })}
            </div>

            {/* Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrega Est.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pedidosFiltrados?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron pedidos
                      </TableCell>
                    </TableRow>
                  ) : (
                    pedidosFiltrados?.map((pedido) => {
                      const config = estadoConfig[pedido.estado];
                      const Icon = config.icon;
                      return (
                        <TableRow key={pedido.id}>
                          <TableCell className="font-mono font-medium">
                            #{pedido.numero_pedido.toString().padStart(6, '0')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pedido.cliente?.nombre}</p>
                              {pedido.cliente?.codigo_cliente && (
                                <p className="text-xs text-muted-foreground">
                                  {pedido.cliente.codigo_cliente}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell>
                            {pedido.fecha_entrega_estimada 
                              ? format(new Date(pedido.fecha_entrega_estimada), 'dd/MM/yyyy', { locale: es })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge className={`${config.color} border-0`}>
                              <Icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(pedido.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPedidoSeleccionado(pedido.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="consolidado">
          <ConsolidadoPedidos />
        </TabsContent>

        <TabsContent value="consolidado-zona">
          <ConsolidadoFinalZona />
        </TabsContent>
      </Tabs>

      <NuevoPedidoDialog 
        open={nuevoDialogOpen} 
        onOpenChange={setNuevoDialogOpen} 
      />

      <DetallePedidoDialog
        pedidoId={pedidoSeleccionado}
        open={!!pedidoSeleccionado}
        onOpenChange={(open) => !open && setPedidoSeleccionado(null)}
        onPrepararPedido={(pedidoId) => {
          setPedidoSeleccionado(null);
          setPrepararPedidoId(pedidoId);
        }}
      />

      <PrepararPedidoDialog
        pedidoId={prepararPedidoId}
        open={!!prepararPedidoId}
        onOpenChange={(open) => !open && setPrepararPedidoId(null)}
      />
    </MainLayout>
  );
}
