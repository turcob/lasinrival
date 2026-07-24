import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Printer, Trash2, Package, CircleDashed, Edit, RefreshCw, Wallet, Plus } from 'lucide-react';
import { toast } from 'sonner';

export type PedidoMostradorEstado = 'pedido' | 'en_preparacion' | 'preparado';

export interface PedidoMostrador {
  id: string;
  numero_comprobante: number | null;
  fecha: string;
  total: number;
  estado: PedidoMostradorEstado;
  cliente_id: string | null;
  empleado_id: string | null;
  clientes?: { id: string; nombre: string; dni_cuit: string | null; condicion_iva: number | null } | null;
  empleados?: { id: string; nombre: string; dni: string | null } | null;
  venta_detalles: any[];
}

interface Props {
  activoId: string | null;
  refreshKey: number;
  onSeleccionar: (pedido: PedidoMostrador) => void;
  onImprimirPicking: (pedido: PedidoMostrador) => void;
  onEliminar: (pedidoId: string) => Promise<void>;
  onCobrar: (pedido: PedidoMostrador) => void;
  onAbrirPreparacion: (pedido: PedidoMostrador) => void;
  onNuevoPedido?: () => void;
}

const ESTADO_META: Record<PedidoMostradorEstado, { label: string; badgeClass: string; icon: any; orden: number }> = {
  pedido: {
    label: 'Borrador',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: CircleDashed,
    orden: 0,
  },
  en_preparacion: {
    label: 'En preparación',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    icon: Package,
    orden: 1,
  },
  preparado: {
    label: 'Preparado',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    icon: ClipboardList,
    orden: 2,
  },
};

export function PedidosMostradorPanel({
  activoId,
  refreshKey,
  onSeleccionar,
  onImprimirPicking,
  onEliminar,
  onCobrar,
  onAbrirPreparacion,
  onNuevoPedido,
}: Props) {
  const [pedidos, setPedidos] = useState<PedidoMostrador[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          id, numero_comprobante, fecha, total, estado, cliente_id, empleado_id,
          clientes(id, nombre, dni_cuit, condicion_iva),
          empleados(id, nombre, dni),
          venta_detalles(*, productos(id, codigo_articulo, descripcion, stock_actual, unidad_medida, precio_costo))
        `)
        .in('estado', ['pedido', 'en_preparacion', 'preparado'])
        .eq('anulada', false)
        .order('fecha', { ascending: false })
        .limit(50);
      if (error) throw error;
      setPedidos((data || []) as any);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar los pedidos en curso');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
    const t = setInterval(fetchPedidos, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const total = pedidos.length;
  const porEstado = {
    pedido: pedidos.filter((p) => p.estado === 'pedido').length,
    en_preparacion: pedidos.filter((p) => p.estado === 'en_preparacion').length,
    preparado: pedidos.filter((p) => p.estado === 'preparado').length,
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-sm">Pedidos en curso</span>
          <Badge variant="secondary">{total}</Badge>
          {porEstado.preparado > 0 && (
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hidden sm:inline-flex">
              {porEstado.preparado} listo{porEstado.preparado === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onNuevoPedido && (
            <Button size="sm" variant="default" className="h-8" onClick={onNuevoPedido}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Refrescar"
            onClick={() => fetchPedidos()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {total === 0 && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-3">
            No hay pedidos en curso. Armá un carrito y tocá "Enviar a preparar" para crear uno.
          </p>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2 p-2">
                  {pedidos
                    .slice()
                    .sort((a, b) =>
                      ESTADO_META[b.estado].orden - ESTADO_META[a.estado].orden ||
                      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
                    )
                    .map((p) => {
                      const meta = ESTADO_META[p.estado];
                      const Icon = meta.icon;
                      const isActive = activoId === p.id;
                      const clienteNombre = p.clientes?.nombre || p.empleados?.nombre || 'Consumidor Final';
                      const hora = new Date(p.fecha).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const items = p.venta_detalles?.length || 0;
                      return (
                        <div
                          key={p.id}
                          className={`border rounded p-2 text-xs transition ${
                            isActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.badgeClass}`}>
                                  {meta.label}
                                </Badge>
                                <span className="text-muted-foreground">{hora}</span>
                              </div>
                              <p className="font-medium truncate">{clienteNombre}</p>
                              <p className="text-muted-foreground">
                                {items} item{items === 1 ? '' : 's'} · ${Number(p.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {p.estado === 'pedido' && (
                              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onSeleccionar(p)}>
                                <Edit className="h-3 w-3 mr-1" /> Editar
                              </Button>
                            )}
                            {p.estado === 'en_preparacion' && (
                              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onAbrirPreparacion(p)}>
                                <Package className="h-3 w-3 mr-1" /> Confirmar preparado
                              </Button>
                            )}
                            {p.estado === 'preparado' && (
                              <Button size="sm" className="h-7 text-xs" onClick={() => onCobrar(p)}>
                                <Wallet className="h-3 w-3 mr-1" /> Cobrar
                              </Button>
                            )}
                            {p.estado === 'en_preparacion' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Reimprimir picking"
                                onClick={() => onImprimirPicking(p)}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              title="Eliminar pedido"
                              onClick={async () => {
                                if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return;
                                await onEliminar(p.id);
                                fetchPedidos();
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
