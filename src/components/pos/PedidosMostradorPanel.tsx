import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Printer, Trash2, Package, CircleDashed, Plus } from 'lucide-react';
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
  onNuevoPedido?: () => void;
  onImprimirYPreparar?: (pedido: PedidoMostrador) => Promise<void> | void;
}

export interface PedidosMostradorPanelHandle {
  focusLista: () => void;
  imprimirEnfocado: () => void;
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

export const PedidosMostradorPanel = forwardRef<PedidosMostradorPanelHandle, Props>(function PedidosMostradorPanel(
  {
    activoId,
    refreshKey,
    onSeleccionar,
    onImprimirPicking,
    onEliminar,
    onNuevoPedido,
    onImprimirYPreparar,
  },
  ref,
) {
  const [pedidos, setPedidos] = useState<PedidoMostrador[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
        .in('estado', ['en_preparacion', 'preparado'])
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
    // Realtime: refrescar cuando cambia cualquier venta en estado mostrador
    const ch = supabase
      .channel('pos-pedidos-mostrador')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ventas' },
        () => fetchPedidos()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'venta_detalles' },
        () => fetchPedidos()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const total = pedidos.length;
  const porEstado = {
    en_preparacion: pedidos.filter((p) => p.estado === 'en_preparacion').length,
    preparado: pedidos.filter((p) => p.estado === 'preparado').length,
  };

  const pedidosOrdenados = useMemo(
    () =>
      pedidos
        .slice()
        .sort(
          (a, b) =>
            ESTADO_META[b.estado].orden - ESTADO_META[a.estado].orden ||
            new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        ),
    [pedidos],
  );

  const focusItem = (index: number) => {
    const p = pedidosOrdenados[index];
    if (!p) return;
    setFocusedIndex(index);
    const el = itemRefs.current.get(p.id);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  };

  useImperativeHandle(ref, () => ({
    focusLista: () => {
      const idx = Math.min(Math.max(focusedIndex, 0), Math.max(pedidosOrdenados.length - 1, 0));
      focusItem(idx);
    },
    imprimirEnfocado: () => {
      const p = pedidosOrdenados[focusedIndex];
      if (!p) return;
      if (p.estado === 'pedido' && onImprimirYPreparar) onImprimirYPreparar(p);
      else onImprimirPicking(p);
    },
  }));

  const eliminarPedido = async (id: string) => {
    if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return;
    await onEliminar(id);
    fetchPedidos();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, index: number, p: PedidoMostrador) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(Math.min(index + 1, pedidosOrdenados.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(Math.max(index - 1, 0));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar(p);
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (p.estado === 'pedido' && onImprimirYPreparar) onImprimirYPreparar(p);
      else onImprimirPicking(p);
      return;
    }
    if (e.key === 'Delete' && e.shiftKey) {
      e.preventDefault();
      eliminarPedido(p.id);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      <div className="p-3 border-b bg-muted/30 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span className="font-semibold text-sm truncate">Pedidos en curso</span>
            <Badge variant="secondary" className="shrink-0">{total}</Badge>
          </div>
          {onNuevoPedido && (
            <Button size="sm" variant="default" className="h-8 shrink-0" onClick={onNuevoPedido}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo
            </Button>
          )}
        </div>
        {porEstado.preparado > 0 && (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            {porEstado.preparado} listo{porEstado.preparado === 1 ? '' : 's'}
          </Badge>
        )}
        <p className="text-[10px] text-muted-foreground">
          <b>F6</b> lista · <b>↑/↓</b> mover · <b>Enter</b> abrir · <b>P</b> imprimir · <b>Shift+Supr</b> eliminar
        </p>
      </div>
      <div className="flex-1 min-h-0">
        {total === 0 && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-3">
            No hay pedidos en curso. Armá un carrito y tocá "Enviar a preparar" para crear uno.
          </p>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2 p-2">
                  {pedidosOrdenados.map((p, index) => {
                      const meta = ESTADO_META[p.estado];
                      const Icon = meta.icon;
                      const isActive = activoId === p.id;
                      const clienteNombre = p.clientes?.nombre || p.empleados?.nombre || 'Consumidor Final';
                      const hora = new Date(p.fecha).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const items = p.venta_detalles?.length || 0;
                      const numero = p.numero_comprobante
                        ? `#${String(p.numero_comprobante).padStart(6, '0')}`
                        : '#s/n';
                      return (
                        <div
                          key={p.id}
                          ref={(el) => {
                            if (el) itemRefs.current.set(p.id, el);
                            else itemRefs.current.delete(p.id);
                          }}
                          role="button"
                          tabIndex={index === focusedIndex ? 0 : -1}
                          onClick={() => onSeleccionar(p)}
                          onFocus={() => setFocusedIndex(index)}
                          onKeyDown={(e) => handleItemKeyDown(e, index, p)}
                          className={`border rounded p-2 text-xs transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
                              <p className="font-semibold text-[11px] text-primary">{numero}</p>
                              <p className="font-medium truncate">{clienteNombre}</p>
                              <p className="text-muted-foreground">
                                {items} item{items === 1 ? '' : 's'} · ${Number(p.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {p.estado === 'pedido' && onImprimirYPreparar && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Imprimir y enviar a preparar"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onImprimirYPreparar(p);
                                }}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {p.estado === 'en_preparacion' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Reimprimir picking"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onImprimirPicking(p);
                                }}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              tabIndex={-1}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              title="Eliminar pedido"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await eliminarPedido(p.id);
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
});
