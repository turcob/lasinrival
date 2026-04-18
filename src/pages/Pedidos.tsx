import { useState, useMemo } from 'react';
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
  RotateCcw,
  ChevronDown,
  ChevronRight,
  PackageSearch
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePedidos, type PedidoEstado } from '@/hooks/usePedidos';
import { NuevoPedidoDialog } from '@/components/pedidos/NuevoPedidoDialog';
import { DetallePedidoDialog } from '@/components/pedidos/DetallePedidoDialog';
import { PrepararPedidoDialog } from '@/components/pedidos/PrepararPedidoDialog';
import { EditarPedidoDialog } from '@/components/pedidos/EditarPedidoDialog';
import { ConsolidadoPedidos } from '@/components/pedidos/ConsolidadoPedidos';
import { ConsolidadoFinalZona } from '@/components/pedidos/ConsolidadoFinalZona';
import { TipoPedidoProvider, useTipoPedido } from '@/contexts/TipoPedidoContext';
import { SelectorTipoPedidoDialog } from '@/components/pedidos/SelectorTipoPedidoDialog';
import { TipoPedidoSelector, TipoPedidoBadge } from '@/components/pedidos/TipoPedidoSelector';

const estadoConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  preparado: { label: 'Preparado', color: 'bg-blue-100 text-blue-800', icon: Package },
  despachado: { label: 'Despachado', color: 'bg-green-100 text-green-800', icon: Truck },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  devuelto: { label: 'Devuelto', color: 'bg-red-100 text-red-100', icon: RotateCcw },
  anulado: { label: 'Anulado', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

const estadosActivos: PedidoEstado[] = ['pendiente', 'preparado', 'despachado', 'rechazado'];

export default function Pedidos() {
  return (
    <TipoPedidoProvider>
      <SelectorTipoPedidoDialog />
      <PedidosContent />
    </TipoPedidoProvider>
  );
}

function PedidosContent() {
  const [busqueda, setBusqueda] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<PedidoEstado | 'todos'>('pendiente');
  const [nuevoDialogOpen, setNuevoDialogOpen] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null);
  const [prepararPedidoId, setPrepararPedidoId] = useState<string | null>(null);
  const [editarPedidoId, setEditarPedidoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const { tipo: tipoPedidoFiltro } = useTipoPedido();

  const { data: pedidos, isLoading } = usePedidos({
    estado: filtroEstado !== 'todos' ? filtroEstado : undefined,
    tipoPedido: tipoPedidoFiltro !== 'ambos' ? tipoPedidoFiltro : undefined,
  });

  const toggleExpandido = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pedidosFiltrados = useMemo(() => {
    let resultado = pedidos || [];

    // Filtro por origen
    if (filtroOrigen === 'web') {
      resultado = resultado.filter(p =>
        p.observaciones?.startsWith('Pedido Paladini')
      );
    } else if (filtroOrigen === 'reparto') {
      resultado = resultado.filter(p =>
        !p.observaciones?.startsWith('Pedido Paladini')
      );
    }

    // Filtro por búsqueda general (número, cliente)
    if (busqueda) {
      const term = busqueda.toLowerCase();
      resultado = resultado.filter(p =>
        p.numero_pedido.toString().includes(term) ||
        p.cliente?.nombre.toLowerCase().includes(term) ||
        p.cliente?.codigo_cliente?.toLowerCase().includes(term)
      );
    }

    // Filtro por producto
    if (busquedaProducto) {
      const termProd = busquedaProducto.toLowerCase();
      resultado = resultado.filter(p =>
        p.detalles?.some(d =>
          d.producto?.descripcion?.toLowerCase().includes(termProd) ||
          d.producto?.codigo_articulo?.toLowerCase().includes(termProd)
        )
      );
    }

    return resultado;
  }, [pedidos, busqueda, busquedaProducto, filtroOrigen]);

  // Totales del producto filtrado
  const totalesProductoFiltrado = useMemo(() => {
    if (!busquedaProducto) return null;
    const termProd = busquedaProducto.toLowerCase();
    let totalCantidad = 0;
    let totalMonto = 0;

    pedidosFiltrados.forEach(p => {
      p.detalles?.forEach(d => {
        if (
          d.producto?.descripcion?.toLowerCase().includes(termProd) ||
          d.producto?.codigo_articulo?.toLowerCase().includes(termProd)
        ) {
          totalCantidad += d.cantidad_pedida;
          totalMonto += d.subtotal;
        }
      });
    });

    return { totalCantidad, totalMonto, cantidadPedidos: pedidosFiltrados.length };
  }, [pedidosFiltrados, busquedaProducto]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

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
              <div className="relative flex-1">
                <PackageSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por producto (nombre o código)..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
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
              <Button
                variant={filtroOrigen === 'web' ? "default" : "outline"}
                onClick={() => setFiltroOrigen(filtroOrigen === 'web' ? 'todos' : 'web')}
                className={`whitespace-nowrap ${filtroOrigen === 'web' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 border-red-300 hover:bg-red-50'}`}
              >
                🌐 Web
              </Button>
              <Button
                variant={filtroOrigen === 'reparto' ? "default" : "outline"}
                onClick={() => setFiltroOrigen(filtroOrigen === 'reparto' ? 'todos' : 'reparto')}
                className={`whitespace-nowrap ${filtroOrigen === 'reparto' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-300 hover:bg-blue-50'}`}
              >
                <Truck className="h-4 w-4 mr-1" />
                Reparto
              </Button>
              <Button onClick={() => setNuevoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            {/* Totales de producto filtrado */}
            {totalesProductoFiltrado && (
              <div className="flex items-center gap-4 p-3 rounded-lg border bg-accent/50">
                <PackageSearch className="h-5 w-5 text-primary" />
                <div className="flex flex-wrap gap-6 text-sm">
                  <span>
                    <strong>{totalesProductoFiltrado.cantidadPedidos}</strong> pedidos contienen "{busquedaProducto}"
                  </span>
                  <span>
                    Cantidad total: <strong>{totalesProductoFiltrado.totalCantidad}</strong> unidades
                  </span>
                  <span>
                    Monto total: <strong>{formatCurrency(totalesProductoFiltrado.totalMonto)}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {estadosActivos.map((key) => {
                const config = estadoConfig[key];
                const baseList = (busqueda || busquedaProducto || filtroOrigen !== 'todos') ? pedidosFiltrados : (pedidos || []);
                const count = baseList.filter(p => p.estado === key).length;
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
                    <TableHead className="w-10"></TableHead>
                    <TableHead>N° Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrega Est.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <div className="flex justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pedidosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No se encontraron pedidos
                      </TableCell>
                    </TableRow>
                  ) : (
                    pedidosFiltrados.map((pedido) => {
                      const config = estadoConfig[pedido.estado];
                      const Icon = config.icon;
                      const isExpandedBySearch = !!busquedaProducto;
                      const isExpanded = isExpandedBySearch || expandidos.has(pedido.id);
                      const cantProductos = pedido.detalles?.length || 0;

                      const termProd = busquedaProducto?.toLowerCase();
                      const detallesVisibles = isExpandedBySearch && termProd
                        ? pedido.detalles?.filter(d =>
                            d.producto?.descripcion?.toLowerCase().includes(termProd) ||
                            d.producto?.codigo_articulo?.toLowerCase().includes(termProd)
                          )
                        : pedido.detalles;

                      return (
                        <>
                          <TableRow key={pedido.id} className="cursor-pointer" onClick={() => toggleExpandido(pedido.id)}>
                            <TableCell className="px-2">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); toggleExpandido(pedido.id); }}>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="font-mono font-medium">
                              #{pedido.numero_pedido.toString().padStart(6, '0')}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{pedido.cliente?.nombre}</p>
                                {pedido.cliente?.codigo_cliente && (
                                  <p className="text-xs text-muted-foreground">{pedido.cliente.codigo_cliente}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">{pedido.cliente?.zona?.nombre || '-'}</span>
                            </TableCell>
                            <TableCell>
                              {format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </TableCell>
                            <TableCell>
                              {pedido.fecha_entrega_estimada
                                ? format(new Date(pedido.fecha_entrega_estimada), 'dd/MM/yyyy', { locale: es })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${config.color} border-0`}>
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{cantProductos} ítem{cantProductos !== 1 ? 's' : ''}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(pedido.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setPedidoSeleccionado(pedido.id); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && detallesVisibles && detallesVisibles.length > 0 && (
                            <TableRow key={`${pedido.id}-details`}>
                              <TableCell colSpan={10} className="p-0">
                                <div className="bg-muted/30 px-6 py-3 border-t">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-muted-foreground text-xs">
                                        <th className="text-left pb-1 font-medium">Código</th>
                                        <th className="text-left pb-1 font-medium">Producto</th>
                                        <th className="text-right pb-1 font-medium">Cant. Pedida</th>
                                        <th className="text-right pb-1 font-medium">Precio Unit.</th>
                                        <th className="text-right pb-1 font-medium">Dto%</th>
                                        <th className="text-right pb-1 font-medium">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detallesVisibles.map((d) => (
                                        <tr key={d.id} className={isExpandedBySearch ? 'bg-primary/10 font-semibold' : ''}>
                                          <td className="py-1 pr-4 font-mono text-xs">{d.producto?.codigo_articulo || '-'}</td>
                                          <td className="py-1">{d.producto?.descripcion || 'Producto eliminado'}</td>
                                          <td className="py-1 text-right">{d.cantidad_pedida}</td>
                                          <td className="py-1 text-right">{formatCurrency(d.precio_unitario)}</td>
                                          <td className="py-1 text-right">{d.descuento_porcentaje > 0 ? `${d.descuento_porcentaje}%` : '-'}</td>
                                          <td className="py-1 text-right">{formatCurrency(d.subtotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
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
        onEditarPedidoExistente={(pedidoId) => setEditarPedidoId(pedidoId)}
      />

      <DetallePedidoDialog
        pedidoId={pedidoSeleccionado}
        open={!!pedidoSeleccionado}
        onOpenChange={(open) => !open && setPedidoSeleccionado(null)}
        onPrepararPedido={(pedidoId) => {
          setPedidoSeleccionado(null);
          setPrepararPedidoId(pedidoId);
        }}
        onEditarPedido={(pedidoId) => {
          setPedidoSeleccionado(null);
          setEditarPedidoId(pedidoId);
        }}
      />

      <PrepararPedidoDialog
        pedidoId={prepararPedidoId}
        open={!!prepararPedidoId}
        onOpenChange={(open) => !open && setPrepararPedidoId(null)}
        pedidoIds={pedidosFiltrados.map(p => p.id)}
        onNavigate={(id) => setPrepararPedidoId(id)}
      />

      <EditarPedidoDialog
        pedidoId={editarPedidoId}
        open={!!editarPedidoId}
        onOpenChange={(open) => !open && setEditarPedidoId(null)}
      />
    </MainLayout>
  );
}
