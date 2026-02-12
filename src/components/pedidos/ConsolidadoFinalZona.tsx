import { useState, useMemo } from 'react';
import {
  Search,
  Package,
  Snowflake,
  Scale,
  Printer,
  ChevronDown,
  ChevronRight,
  MapPin,
} from 'lucide-react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  generarConsolidado,
  type ProductoConsolidadoItem,
  type PedidoConsolidado,
  type DetalleConsolidado,
} from '@/hooks/useConsolidadoPedidos';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

function useZonas() {
  return useQuery({
    queryKey: ['zonas-todas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zonas')
        .select('id, nombre, codigo')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });
}

function usePedidosPreparadosPorZona(zonaId: string | null) {
  return useQuery({
    queryKey: ['pedidos-consolidado-final-zona', zonaId],
    queryFn: async () => {
      if (!zonaId) return [];

      // Fetch all preparado pedidos, filter by zona client-side
      const { data: allPedidos, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          id, numero_pedido, total, estado, fecha_pedido,
          cliente:clientes(id, nombre, codigo_cliente, vendedor_id, zona_id)
        `)
        .eq('estado', 'preparado' as any)
        .order('numero_pedido', { ascending: true });

      if (pedidosError) throw pedidosError;
      if (!allPedidos || allPedidos.length === 0) return [];

      // Filter by zona client-side
      const pedidos = allPedidos.filter((p: any) => {
        if (!p.cliente) return false;
        return p.cliente.zona_id === zonaId;
      });

      if (pedidos.length === 0) return [];
      const pedidoIds = pedidos.map((p: any) => p.id);

      // Get detalles with product info
      const { data: detalles, error: detallesError } = await supabase
        .from('pedido_detalles')
        .select(`
          id, pedido_id, producto_id, cantidad_pedida, precio_unitario, descuento_porcentaje, subtotal,
          producto:productos(id, descripcion, codigo_articulo, unidad_medida, es_frio, categoria_id)
        `)
        .in('pedido_id', pedidoIds);

      if (detallesError) throw detallesError;

      const detallesPorPedido = new Map<string, DetalleConsolidado[]>();
      for (const d of (detalles || [])) {
        const list = detallesPorPedido.get(d.pedido_id) || [];
        list.push(d as DetalleConsolidado);
        detallesPorPedido.set(d.pedido_id, list);
      }

      return pedidos.map(p => {
        const dets = detallesPorPedido.get(p.id) || [];
        const tienePesables = dets.some(d => {
          if (!d.producto) return false;
          const u = (d.producto.unidad_medida || '').toUpperCase().replace(/\./g, '').trim();
          return ['KG', 'KILO', 'KILOS'].includes(u);
        });
        return { ...p, detalles: dets, tiene_pesables: tienePesables } as PedidoConsolidado;
      });
    },
    enabled: !!zonaId,
  });
}

export function ConsolidadoFinalZona() {
  const [zonaId, setZonaId] = useState<string | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');

  const { data: zonas } = useZonas();
  const { data: pedidos, isLoading } = usePedidosPreparadosPorZona(zonaId);

  const consolidado = useMemo(() => {
    if (!pedidos) return { noPesables: [], frios: [], pesables: [] };
    const items = generarConsolidado(pedidos);
    return {
      noPesables: items.filter(i => i.tipo === 'no_pesable'),
      frios: items.filter(i => i.tipo === 'frio'),
      pesables: items.filter(i => i.tipo === 'pesable'),
    };
  }, [pedidos]);

  const filtrarItems = (items: ProductoConsolidadoItem[]) => {
    if (!busquedaProducto) return items;
    const term = busquedaProducto.toLowerCase();
    return items.filter(
      i => i.descripcion.toLowerCase().includes(term) || i.codigo_articulo.toLowerCase().includes(term)
    );
  };

  const zonaNombre = zonaId ? zonas?.find(z => z.id === zonaId)?.nombre : null;

  const handleImprimir = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const renderTable = (items: ProductoConsolidadoItem[], titulo: string) => {
      if (items.length === 0) return '<p style="color:#999;padding:8px;">Sin productos en esta categoría</p>';
      return `
        <h2 style="margin:16px 0 8px;font-size:16px;">${titulo}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="border:1px solid #ddd;padding:6px;text-align:left;">Código</th>
              <th style="border:1px solid #ddd;padding:6px;text-align:left;">Descripción</th>
              <th style="border:1px solid #ddd;padding:6px;text-align:right;">Cantidad</th>
              <th style="border:1px solid #ddd;padding:6px;text-align:left;">Unidad</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="border:1px solid #ddd;padding:4px;font-family:monospace;">${item.codigo_articulo}</td>
                <td style="border:1px solid #ddd;padding:4px;">${item.descripcion}</td>
                <td style="border:1px solid #ddd;padding:4px;text-align:right;font-weight:bold;">${item.cantidad_total}</td>
                <td style="border:1px solid #ddd;padding:4px;">${item.unidad_medida || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    };

    printWindow.document.write(`
      <html><head><title>Consolidado Final - ${zonaNombre}</title></head><body style="font-family:Arial,sans-serif;padding:20px;">
        <h1 style="font-size:18px;">Consolidado Final por Zona: ${zonaNombre}</h1>
        <p style="color:#666;font-size:12px;">${pedidos?.length || 0} pedidos preparados</p>
        ${renderTable(consolidado.noPesables, 'No Pesables')}
        <div style="page-break-before:always;"></div>
        ${renderTable(consolidado.frios, 'Frescos / Fríos')}
        <div style="page-break-before:always;"></div>
        ${renderTable(consolidado.pesables, 'Pesables (KG)')}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleImprimirRemitos = () => {
    if (!pedidos || pedidos.length === 0) return;
    const ventana = window.open('', '_blank', 'width=800,height=600');
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
      return;
    }

    const remitosHTML = pedidos.map((pedido, index) => {
      const numeroRemito = pedido.numero_pedido.toString().padStart(6, '0');
      const fecha = new Date(pedido.fecha_pedido);
      const fechaStr = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

      const lineasHTML = pedido.detalles.map(d => {
        if (!d.producto) return '';
        const desc = d.descuento_porcentaje ?? 0;
        return `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px;">${d.producto.codigo_articulo}</td>
            <td style="padding:6px;border-bottom:1px solid #eee;font-size:11px;">${d.producto.descripcion}</td>
            <td style="padding:6px;border-bottom:1px solid #eee;text-align:center;">${d.cantidad_pedida}</td>
            <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(d.precio_unitario)}</td>
            <td style="padding:6px;border-bottom:1px solid #eee;text-align:center;">${desc > 0 ? desc + '%' : '-'}</td>
            <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;font-weight:500;">${formatCurrency(d.subtotal)}</td>
          </tr>
        `;
      }).join('');

      const pageBreak = index < pedidos.length - 1 ? 'page-break-after:always;' : '';

      return `
        <div style="${pageBreak}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px;">
            <div>
              <h1 style="margin:0;font-size:22px;">REMITO</h1>
              <p style="margin:4px 0 0;color:#666;font-size:11px;">Documento no válido como factura</p>
            </div>
            <div style="text-align:right;">
              <h2 style="margin:0;font-size:16px;color:#d32f2f;">R #${numeroRemito}</h2>
              <p style="margin:4px 0 0;font-size:12px;"><strong>Fecha:</strong> ${fechaStr}</p>
            </div>
          </div>
          <div style="background:#f5f5f5;padding:12px;border-radius:4px;margin-bottom:16px;">
            <h3 style="margin:0 0 6px;font-size:13px;color:#666;">DATOS DEL CLIENTE</h3>
            <p style="margin:2px 0;font-size:12px;"><strong>Razón Social:</strong> ${pedido.cliente?.nombre || '-'}</p>
            ${pedido.cliente?.codigo_cliente ? `<p style="margin:2px 0;font-size:12px;"><strong>Código:</strong> ${pedido.cliente.codigo_cliente}</p>` : ''}
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
            <thead>
              <tr>
                <th style="background:#333;color:white;padding:8px 6px;text-align:left;font-weight:500;width:100px;">Código</th>
                <th style="background:#333;color:white;padding:8px 6px;text-align:left;font-weight:500;">Descripción</th>
                <th style="background:#333;color:white;padding:8px 6px;text-align:center;font-weight:500;width:60px;">Cant.</th>
                <th style="background:#333;color:white;padding:8px 6px;text-align:right;font-weight:500;width:90px;">P. Unit.</th>
                <th style="background:#333;color:white;padding:8px 6px;text-align:center;font-weight:500;width:50px;">Dto.</th>
                <th style="background:#333;color:white;padding:8px 6px;text-align:right;font-weight:500;width:90px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${lineasHTML}</tbody>
          </table>
          <div style="display:flex;justify-content:flex-end;margin-top:12px;">
            <div style="background:#333;color:white;padding:12px 20px;border-radius:4px;">
              <span style="font-size:13px;">TOTAL:</span>
              <strong style="font-size:18px;margin-left:12px;">${formatCurrency(pedido.total)}</strong>
            </div>
          </div>
          <div style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;display:flex;justify-content:space-between;">
            <div style="width:180px;text-align:center;"><div style="border-top:1px solid #333;margin-top:50px;padding-top:4px;font-size:11px;">Firma del Cliente</div></div>
            <div style="width:180px;text-align:center;"><div style="border-top:1px solid #333;margin-top:50px;padding-top:4px;font-size:11px;">Aclaración</div></div>
            <div style="width:180px;text-align:center;"><div style="border-top:1px solid #333;margin-top:50px;padding-top:4px;font-size:11px;">DNI</div></div>
          </div>
        </div>
      `;
    }).join('');

    ventana.document.write(`
      <!DOCTYPE html>
      <html><head><title>Remitos - Zona ${zonaNombre}</title>
      <style>
        @media print { body { margin:0; padding:15px; } .no-print { display:none !important; } }
        body { font-family:Arial,sans-serif;font-size:12px;color:#333;max-width:800px;margin:0 auto;padding:20px; }
        .print-button { position:fixed;bottom:20px;right:20px;padding:12px 24px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2); }
        .print-button:hover { background:#1565c0; }
      </style>
      </head><body>
        ${remitosHTML}
        <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir Remitos</button>
      </body></html>
    `);
    ventana.document.close();
  };

  const renderProductTable = (items: ProductoConsolidadoItem[]) => {
    const filtered = filtrarItems(items);
    if (filtered.length === 0) {
      return <p className="text-sm text-muted-foreground p-4">No hay productos en esta categoría</p>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Cantidad Total</TableHead>
            <TableHead>Unidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(item => (
            <TableRow key={item.producto_id}>
              <TableCell className="font-mono text-sm">{item.codigo_articulo}</TableCell>
              <TableCell>{item.descripcion}</TableCell>
              <TableCell className="text-right font-medium">{item.cantidad_total}</TableCell>
              <TableCell>{item.unidad_medida || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={zonaId || 'todas'} onValueChange={v => setZonaId(v === 'todas' ? null : v)}>
          <SelectTrigger className="w-[250px]">
            <MapPin className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Seleccionar zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Seleccionar zona...</SelectItem>
            {zonas?.map(z => (
              <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={busquedaProducto}
            onChange={e => setBusquedaProducto(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button variant="outline" onClick={handleImprimir} disabled={!pedidos || pedidos.length === 0}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Consolidado
        </Button>

        <Button onClick={handleImprimirRemitos} disabled={!pedidos || pedidos.length === 0}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Remitos
        </Button>
      </div>

      {!zonaId ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Seleccioná una zona para ver el consolidado final de pedidos preparados</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !pedidos || pedidos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron pedidos preparados en la zona seleccionada
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Pedidos preparados</p>
              <p className="text-2xl font-bold">{pedidos.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <p className="text-sm text-muted-foreground">No Pesables</p>
              <p className="text-2xl font-bold">{consolidado.noPesables.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/20">
              <p className="text-sm text-muted-foreground">Frescos / Fríos</p>
              <p className="text-2xl font-bold">{consolidado.frios.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <p className="text-sm text-muted-foreground">Pesables (KG)</p>
              <p className="text-2xl font-bold">{consolidado.pesables.length}</p>
            </div>
          </div>

          {/* Tabs por tipo de producto */}
          <Tabs defaultValue="no_pesable" className="space-y-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="no_pesable" className="gap-2">
                <Package className="h-4 w-4" />
                No Pesables
                <Badge variant="secondary" className="ml-1">{consolidado.noPesables.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="frio" className="gap-2">
                <Snowflake className="h-4 w-4" />
                Frescos
                <Badge variant="secondary" className="ml-1">{consolidado.frios.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pesable" className="gap-2">
                <Scale className="h-4 w-4" />
                Pesables
                <Badge variant="secondary" className="ml-1">{consolidado.pesables.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="no_pesable" className="border rounded-lg">
              {renderProductTable(consolidado.noPesables)}
            </TabsContent>
            <TabsContent value="frio" className="border rounded-lg">
              {renderProductTable(consolidado.frios)}
            </TabsContent>
            <TabsContent value="pesable" className="border rounded-lg">
              {renderProductTable(consolidado.pesables)}
            </TabsContent>
          </Tabs>

          {/* Detalle de pedidos */}
          <div className="space-y-2 border rounded-lg p-4">
            <h3 className="text-lg font-semibold">Pedidos incluidos ({pedidos.length})</h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {pedidos.map(pedido => (
                <div key={pedido.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                  <span className="font-mono text-sm">#{pedido.numero_pedido.toString().padStart(6, '0')}</span>
                  <span className="flex-1 truncate">{pedido.cliente?.nombre}</span>
                  <Badge variant="outline" className="text-xs">{pedido.detalles.length} items</Badge>
                  <span className="font-medium">{formatCurrency(pedido.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
