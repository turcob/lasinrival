import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Package,
  Snowflake,
  Scale,
  CheckCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useVendedoresActivos,
  useZonasDeVendedor,
  usePedidosConsolidado,
  generarConsolidado,
  useQuitarProductoConsolidado,
  useConfirmarPedidosMasivo,
  type ProductoConsolidadoItem,
} from '@/hooks/useConsolidadoPedidos';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export function ConsolidadoPedidos() {
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [zonaId, setZonaId] = useState<string | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [productoAQuitar, setProductoAQuitar] = useState<ProductoConsolidadoItem | null>(null);
  const [confirmarMasivoOpen, setConfirmarMasivoOpen] = useState(false);
  const [seccionAbierta, setSeccionAbierta] = useState({ noPesables: true, frios: true, pesables: true });

  const { data: vendedores } = useVendedoresActivos();
  const { data: zonas } = useZonasDeVendedor(vendedorId);
  const { data: pedidos, isLoading } = usePedidosConsolidado(vendedorId, zonaId, 'pendiente');
  const quitarProducto = useQuitarProductoConsolidado();
  const confirmarMasivo = useConfirmarPedidosMasivo();

  // Separate pedidos by pesables
  const { sinPesables, conPesables } = useMemo(() => {
    if (!pedidos) return { sinPesables: [], conPesables: [] };
    return {
      sinPesables: pedidos.filter(p => !p.tiene_pesables),
      conPesables: pedidos.filter(p => p.tiene_pesables),
    };
  }, [pedidos]);

  // Generate consolidado from ALL pedidos
  const consolidado = useMemo(() => {
    if (!pedidos) return { noPesables: [], frios: [], pesables: [] };
    const items = generarConsolidado(pedidos);
    return {
      noPesables: items.filter(i => i.tipo === 'no_pesable'),
      frios: items.filter(i => i.tipo === 'frio'),
      pesables: items.filter(i => i.tipo === 'pesable'),
    };
  }, [pedidos]);

  // Filter consolidado by search
  const filtrarItems = (items: ProductoConsolidadoItem[]) => {
    if (!busquedaProducto) return items;
    const term = busquedaProducto.toLowerCase();
    return items.filter(
      i => i.descripcion.toLowerCase().includes(term) || i.codigo_articulo.toLowerCase().includes(term)
    );
  };

  const handleToggleSeleccion = (pedidoId: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(pedidoId)) next.delete(pedidoId);
      else next.add(pedidoId);
      return next;
    });
  };

  const handleToggleTodos = () => {
    if (seleccionados.size === sinPesables.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(sinPesables.map(p => p.id)));
    }
  };

  const handleConfirmarMasivo = () => {
    const ids = Array.from(seleccionados);
    confirmarMasivo.mutate(ids, {
      onSuccess: () => {
        setSeleccionados(new Set());
        setConfirmarMasivoOpen(false);
      },
    });
  };

  const handleQuitarProducto = () => {
    if (!productoAQuitar || !pedidos) return;
    const pedidoIds = pedidos.map(p => p.id);
    quitarProducto.mutate(
      { productoId: productoAQuitar.producto_id, pedidoIds },
      { onSuccess: () => setProductoAQuitar(null) }
    );
  };

  const renderConsolidadoTable = (
    items: ProductoConsolidadoItem[],
    titulo: string,
    icon: React.ReactNode,
    colorClass: string,
    sectionKey: 'noPesables' | 'frios' | 'pesables'
  ) => {
    const filtered = filtrarItems(items);
    const isOpen = seccionAbierta[sectionKey];
    return (
      <Collapsible open={isOpen} onOpenChange={(open) => setSeccionAbierta(prev => ({ ...prev, [sectionKey]: open }))}>
        <CollapsibleTrigger asChild>
          <div className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${colorClass}`}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {icon}
            <span className="font-medium">{titulo}</span>
            <Badge variant="secondary" className="ml-auto">{items.length} productos</Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No hay productos en esta categoría</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad Total</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.producto_id}>
                    <TableCell className="font-mono text-sm">{item.codigo_articulo}</TableCell>
                    <TableCell>{item.descripcion}</TableCell>
                    <TableCell className="text-right font-medium">{item.cantidad_total}</TableCell>
                    <TableCell>{item.unidad_medida || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setProductoAQuitar(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={vendedorId || 'todos'} onValueChange={v => { setVendedorId(v === 'todos' ? null : v); setZonaId(null); }}>
          <SelectTrigger className="w-[220px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los vendedores</SelectItem>
            {vendedores?.map(v => (
              <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={zonaId || 'todas'} onValueChange={v => setZonaId(v === 'todas' ? null : v)} disabled={!vendedorId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las zonas</SelectItem>
            {zonas?.map(z => (
              <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto en consolidado..."
            value={busquedaProducto}
            onChange={e => setBusquedaProducto(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !pedidos || pedidos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron pedidos pendientes con los filtros seleccionados
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Total pedidos</p>
              <p className="text-2xl font-bold">{pedidos.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <p className="text-sm text-muted-foreground">Sin pesables</p>
              <p className="text-2xl font-bold">{sinPesables.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <p className="text-sm text-muted-foreground">Con pesables</p>
              <p className="text-2xl font-bold">{conPesables.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Total productos</p>
              <p className="text-2xl font-bold">
                {consolidado.noPesables.length + consolidado.frios.length + consolidado.pesables.length}
              </p>
            </div>
          </div>

          {/* Consolidado por tipo */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Consolidado de productos</h3>
            {renderConsolidadoTable(
              consolidado.noPesables,
              'No Pesables',
              <Package className="h-4 w-4" />,
              'bg-blue-50 dark:bg-blue-950/20',
              'noPesables'
            )}
            {renderConsolidadoTable(
              consolidado.frios,
              'Frescos / Fríos',
              <Snowflake className="h-4 w-4" />,
              'bg-cyan-50 dark:bg-cyan-950/20',
              'frios'
            )}
            {renderConsolidadoTable(
              consolidado.pesables,
              'Pesables (KG)',
              <Scale className="h-4 w-4" />,
              'bg-amber-50 dark:bg-amber-950/20',
              'pesables'
            )}
          </div>

          {/* Confirmación masiva de pedidos sin pesables */}
          {sinPesables.length > 0 && (
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Pedidos sin pesables ({sinPesables.length})
                </h3>
                <Button
                  onClick={() => setConfirmarMasivoOpen(true)}
                  disabled={seleccionados.size === 0 || confirmarMasivo.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar seleccionados ({seleccionados.size})
                </Button>
              </div>

              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={seleccionados.size === sinPesables.length && sinPesables.length > 0}
                  onCheckedChange={handleToggleTodos}
                />
                <span className="text-sm font-medium">Seleccionar todos</span>
              </div>

              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {sinPesables.map(pedido => (
                  <div
                    key={pedido.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleSeleccion(pedido.id)}
                  >
                    <Checkbox
                      checked={seleccionados.has(pedido.id)}
                      onCheckedChange={() => handleToggleSeleccion(pedido.id)}
                    />
                    <span className="font-mono text-sm">#{pedido.numero_pedido.toString().padStart(6, '0')}</span>
                    <span className="flex-1 truncate">{pedido.cliente?.nombre}</span>
                    <span className="font-medium">{formatCurrency(pedido.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pedidos con pesables */}
          {conPesables.length > 0 && (
            <div className="space-y-3 border rounded-lg p-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Scale className="h-5 w-5 text-amber-600" />
                Pedidos con pesables ({conPesables.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Estos pedidos requieren preparación individual porque contienen productos que se pesan.
              </p>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {conPesables.map(pedido => {
                  const cantPesables = pedido.detalles.filter(
                    d => d.producto && ['KG', 'KG.'].includes((d.producto.unidad_medida || '').toUpperCase())
                  ).length;
                  return (
                    <div key={pedido.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                      <span className="font-mono text-sm">#{pedido.numero_pedido.toString().padStart(6, '0')}</span>
                      <span className="flex-1 truncate">{pedido.cliente?.nombre}</span>
                      <Badge variant="outline" className="text-xs">
                        {cantPesables} pesable{cantPesables > 1 ? 's' : ''}
                      </Badge>
                      <span className="font-medium">{formatCurrency(pedido.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog quitar producto */}
      <AlertDialog open={!!productoAQuitar} onOpenChange={open => !open && setProductoAQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar producto de todos los pedidos</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{productoAQuitar?.descripcion}</strong> de todos los pedidos filtrados y se recalcularán los totales. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleQuitarProducto} disabled={quitarProducto.isPending}>
              {quitarProducto.isPending ? 'Quitando...' : 'Quitar producto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog confirmar masivo */}
      <AlertDialog open={confirmarMasivoOpen} onOpenChange={setConfirmarMasivoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pedidos masivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Se cambiarán {seleccionados.size} pedidos de estado "pendiente" a "preparado". ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarMasivo} disabled={confirmarMasivo.isPending}>
              {confirmarMasivo.isPending ? 'Confirmando...' : `Confirmar ${seleccionados.size} pedidos`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
