import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, MapPin, Clock, DollarSign, PackageX, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DetalleEntregas() {
  const [fechaDesde, setFechaDesde] = useState<string>(format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd'));
  const [fechaHasta, setFechaHasta] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [choferFiltro, setChoferFiltro] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Hojas de ruta con paradas, cobros y rechazos
  const { data: hojas = [], isLoading } = useQuery({
    queryKey: ['detalle-entregas', fechaDesde, fechaHasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select(`
          id, numero_hoja, fecha, estado, hora_salida_real, hora_regreso, observaciones,
          chofer:empleados!hojas_ruta_chofer_id_fkey(id, nombre),
          vehiculo:vehiculos(patente),
          paradas:hoja_ruta_paradas(
            id, orden, estado, hora_llegada, hora_salida, observaciones,
            pedido:pedidos(
              id, numero_pedido, total,
              cliente:clientes(id, nombre, codigo_cliente, direccion)
            )
          )
        `)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .order('fecha', { ascending: false })
        .order('numero_hoja', { ascending: false });

      if (error) throw error;

      // Para cada parada, traer cobros y devoluciones
      const hojasConDetalle = await Promise.all(
        (data || []).map(async (h: any) => {
          const paradaIds = (h.paradas || []).map((p: any) => p.id);
          if (paradaIds.length === 0) return h;

          const [cobrosRes, devsRes] = await Promise.all([
            supabase
              .from('hoja_ruta_cobros')
              .select('parada_id, monto, forma_pago_id, observaciones, formas_pago(nombre)')
              .in('parada_id', paradaIds),
            supabase
              .from('hoja_ruta_devoluciones')
              .select('parada_id, cantidad, motivo, detalle_motivo, pedido_detalle:pedido_detalles(precio_unitario, descuento_porcentaje, producto:productos(descripcion, codigo_articulo))')
              .in('parada_id', paradaIds),
          ]);

          h.paradas = h.paradas.map((p: any) => ({
            ...p,
            cobros: (cobrosRes.data || []).filter((c: any) => c.parada_id === p.id),
            devoluciones: (devsRes.data || []).filter((d: any) => d.parada_id === p.id),
          }));
          return h;
        })
      );

      return hojasConDetalle;
    },
  });

  // Choferes únicos
  const choferes = useMemo(() => {
    const map = new Map();
    hojas.forEach((h: any) => {
      if (h.chofer) map.set(h.chofer.id, h.chofer);
    });
    return Array.from(map.values());
  }, [hojas]);

  const hojasFiltradas = useMemo(() => {
    return hojas.filter((h: any) => {
      if (choferFiltro !== 'todos' && h.chofer?.id !== choferFiltro) return false;
      if (busqueda) {
        const b = busqueda.toLowerCase();
        const matchHoja = String(h.numero_hoja).includes(b);
        const matchCliente = h.paradas?.some((p: any) =>
          p.pedido?.cliente?.nombre?.toLowerCase().includes(b)
        );
        if (!matchHoja && !matchCliente) return false;
      }
      return true;
    });
  }, [hojas, choferFiltro, busqueda]);

  const getEstadoBadge = (estado: string) => {
    const map: Record<string, { variant: any; icon: any; label: string }> = {
      entregado: { variant: 'default', icon: CheckCircle2, label: 'Entregado' },
      entrega_parcial: { variant: 'secondary', icon: PackageX, label: 'Parcial' },
      rechazado: { variant: 'destructive', icon: XCircle, label: 'Rechazado' },
      no_entregado: { variant: 'destructive', icon: XCircle, label: 'No entregado' },
      pendiente: { variant: 'outline', icon: Clock, label: 'Pendiente' },
      en_camino: { variant: 'outline', icon: Clock, label: 'En camino' },
    };
    const info = map[estado] || { variant: 'outline', icon: Clock, label: estado };
    const Icon = info.icon;
    return <Badge variant={info.variant} className="gap-1"><Icon className="h-3 w-3" />{info.label}</Badge>;
  };

  return (
    <MainLayout>
      <PageHeader
        title="Detalle de Entregas"
        description="Historial completo de visitas y entregas por repartidor"
        icon={ClipboardList}
      />

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Desde</label>
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hasta</label>
              <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Repartidor</label>
              <Select value={choferFiltro} onValueChange={setChoferFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {choferes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Buscar</label>
              <Input placeholder="HR# o cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : hojasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No hay hojas de ruta en el período</div>
      ) : (
        <div className="space-y-3">
          {hojasFiltradas.map((hoja: any) => {
            const totalCobrado = hoja.paradas?.reduce((sum: number, p: any) =>
              sum + (p.cobros || []).reduce((s: number, c: any) => s + Number(c.monto), 0), 0) || 0;
            const totalRechazado = hoja.paradas?.reduce((sum: number, p: any) =>
              sum + (p.devoluciones || []).reduce((s: number, d: any) => {
                const precio = d.pedido_detalle?.precio_unitario || 0;
                const desc = d.pedido_detalle?.descuento_porcentaje || 0;
                return s + Number(d.cantidad) * precio * (1 - desc / 100);
              }, 0), 0) || 0;

            return (
              <Card key={hoja.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-base">HR #{hoja.numero_hoja}</Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        {format(new Date(hoja.fecha), "EEEE d 'de' MMMM", { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-normal">
                      <span>👤 {hoja.chofer?.nombre || 'Sin chofer'}</span>
                      {hoja.vehiculo?.patente && <span>🚚 {hoja.vehiculo.patente}</span>}
                      <Badge>{hoja.estado}</Badge>
                    </div>
                  </CardTitle>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                    <span>📍 {hoja.paradas?.length || 0} paradas</span>
                    <span className="text-green-600 font-medium">💰 Cobrado: ${totalCobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    {totalRechazado > 0 && (
                      <span className="text-amber-600 font-medium">📦 Rechazado: ${totalRechazado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {(hoja.paradas || []).sort((a: any, b: any) => a.orden - b.orden).map((parada: any) => {
                      const cobros = parada.cobros || [];
                      const devs = parada.devoluciones || [];
                      const totalParadaCobro = cobros.reduce((s: number, c: any) => s + Number(c.monto), 0);
                      const totalParadaRech = devs.reduce((s: number, d: any) => {
                        const p = d.pedido_detalle?.precio_unitario || 0;
                        const desc = d.pedido_detalle?.descuento_porcentaje || 0;
                        return s + Number(d.cantidad) * p * (1 - desc / 100);
                      }, 0);

                      return (
                        <AccordionItem key={parada.id} value={parada.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3 text-left">
                                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">#{parada.orden}</span>
                                <div>
                                  <div className="font-semibold">{parada.pedido?.cliente?.nombre}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {parada.pedido?.cliente?.direccion || 'Sin dirección'}
                                    · Pedido #{parada.pedido?.numero_pedido}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getEstadoBadge(parada.estado)}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 pl-4">
                              {/* Tiempos */}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Llegada: </span>
                                  <span className="font-medium">
                                    {parada.hora_llegada ? format(new Date(parada.hora_llegada), 'HH:mm') : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Salida: </span>
                                  <span className="font-medium">
                                    {parada.hora_salida ? format(new Date(parada.hora_salida), 'HH:mm') : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Total pedido: </span>
                                  <span className="font-medium">${Number(parada.pedido?.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Saldo: </span>
                                  <span className="font-medium">${(Number(parada.pedido?.total || 0) - totalParadaCobro - totalParadaRech).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>

                              {parada.observaciones && (
                                <div className="text-sm bg-muted/50 p-2 rounded">
                                  <strong>Obs.:</strong> {parada.observaciones}
                                </div>
                              )}

                              {/* Cobros */}
                              {cobros.length > 0 && (
                                <div>
                                  <div className="text-sm font-semibold flex items-center gap-1 mb-2">
                                    <DollarSign className="h-4 w-4 text-green-600" /> Cobros
                                  </div>
                                  <div className="space-y-1">
                                    {cobros.map((c: any, i: number) => (
                                      <div key={i} className="flex justify-between text-sm bg-green-500/5 border border-green-500/20 rounded px-3 py-1.5">
                                        <span>{c.formas_pago?.nombre || 'Pago'} {c.observaciones && <span className="text-muted-foreground">— {c.observaciones}</span>}</span>
                                        <span className="font-bold">${Number(c.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Rechazos */}
                              {devs.length > 0 && (
                                <div>
                                  <div className="text-sm font-semibold flex items-center gap-1 mb-2">
                                    <PackageX className="h-4 w-4 text-amber-600" /> Rechazos de mercadería
                                  </div>
                                  <div className="space-y-1">
                                    {devs.map((d: any, i: number) => {
                                      const p = d.pedido_detalle?.precio_unitario || 0;
                                      const desc = d.pedido_detalle?.descuento_porcentaje || 0;
                                      const importe = Number(d.cantidad) * p * (1 - desc / 100);
                                      return (
                                        <div key={i} className="flex justify-between text-sm bg-amber-500/5 border border-amber-500/20 rounded px-3 py-1.5">
                                          <span>
                                            <strong>{d.cantidad}x</strong> {d.pedido_detalle?.producto?.descripcion || 'Producto'}
                                            <span className="text-muted-foreground ml-2">({d.motivo})</span>
                                            {d.detalle_motivo && <span className="text-muted-foreground italic"> — {d.detalle_motivo}</span>}
                                          </span>
                                          <span className="font-bold text-amber-700">${importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {cobros.length === 0 && devs.length === 0 && (
                                <div className="text-sm text-muted-foreground italic">Sin cobros ni rechazos registrados</div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
