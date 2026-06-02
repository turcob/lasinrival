import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FileCheck, Banknote, Smartphone, CreditCard, AlertTriangle, CheckCircle, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPrintMetaHTML } from '@/lib/printMeta';
import { formatZonasResumen } from '@/lib/hojaRutaZonas';
import { SubsanarCobroDialog } from './SubsanarCobroDialog';

interface Cobro {
  id: string;
  monto: number;
  referencia: string | null;
  forma_pago: { id: string; nombre: string };
  pedido: { id: string; numero_pedido: number; cliente_id: string };
  parada: { id: string };
  subsanado_administrativo?: boolean | null;
}

interface ResumenPorMedio {
  forma_pago_id: string;
  nombre: string;
  total: number;
}

interface RendicionHojaRutaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRutaId: string;
  numeroHoja: number;
  onSuccess: () => void;
}

export function RendicionHojaRutaDialog({
  open,
  onOpenChange,
  hojaRutaId,
  numeroHoja,
  onSuccess,
}: RendicionHojaRutaDialogProps) {
  const { user, hasRole } = useAuth();
  const esAdmin = hasRole('admin') || hasRole('encargado');
  const [cobroASubsanar, setCobroASubsanar] = useState<Cobro | null>(null);
  const [loading, setLoading] = useState(false);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [resumen, setResumen] = useState<ResumenPorMedio[]>([]);
  const [rendicionExistente, setRendicionExistente] = useState<any>(null);
  const [observaciones, setObservaciones] = useState('');
  const [totalEsperado, setTotalEsperado] = useState<number>(0);
  const [totalEntregado, setTotalEntregado] = useState<number>(0);
  const [totalRechazado, setTotalRechazado] = useState<number>(0);
  const [totalDevoluciones, setTotalDevoluciones] = useState<number>(0);
  const [zonasTitulo, setZonasTitulo] = useState<string>('');

  // Montos declarados por el chofer
  const [efectivoDeclarado, setEfectivoDeclarado] = useState<number>(0);
  const [transferenciasDeclarado, setTransferenciasDeclarado] = useState<number>(0);
  const [qrDeclarado, setQrDeclarado] = useState<number>(0);
  const [tarjetaDeclarado, setTarjetaDeclarado] = useState<number>(0);

  useEffect(() => {
    if (open && hojaRutaId) {
      loadData();
    }
  }, [open, hojaRutaId]);

  const loadData = async () => {
    try {
      // Cargar cobros de la hoja de ruta (tabla nueva)
      const { data: cobrosNuevos } = await supabase
        .from('hoja_ruta_cobros')
        .select(`
          id,
          monto,
          referencia,
          subsanado_administrativo,
          forma_pago:formas_pago(id, nombre),
          pedido:pedidos(id, numero_pedido, cliente_id),
          parada:hoja_ruta_paradas(id)
        `)
        .eq('hoja_ruta_id', hojaRutaId);

      // También cargar cobros de la tabla legacy
      const { data: paradas } = await supabase
        .from('hoja_ruta_paradas')
        .select('id, estado, pedido:pedidos(total, cliente:clientes(zona:zonas(nombre)))')
        .eq('hoja_ruta_id', hojaRutaId);
      
      const paradasIds = paradas?.map(p => p.id) || [];
      setZonasTitulo(formatZonasResumen(paradas as any));

      // Calcular total entregado vs rechazado por estado de parada
      let entregadoSum = 0;
      let rechazadoSum = 0;
      (paradas || []).forEach((p: any) => {
        const totalPedido = Number(p.pedido?.total || 0);
        if (p.estado === 'rechazado' || p.estado === 'no_entregado') {
          rechazadoSum += totalPedido;
        } else if (['entregado', 'entrega_parcial'].includes(p.estado)) {
          entregadoSum += totalPedido;
        }
      });

      // Cargar devoluciones (productos devueltos en entregas parciales)
      let devolucionesSum = 0;
      if (paradasIds.length > 0) {
        const { data: devs } = await supabase
          .from('hoja_ruta_devoluciones')
          .select(`
            cantidad,
            parada_id,
            pedido_detalle:pedido_detalles(precio_unitario, descuento_porcentaje)
          `)
          .in('parada_id', paradasIds);

        // Solo contar devoluciones de paradas NO rechazadas (las rechazadas ya descuentan total completo)
        const paradasNoRechazadas = new Set(
          (paradas || [])
            .filter((p: any) => p.estado !== 'rechazado' && p.estado !== 'no_entregado')
            .map((p: any) => p.id)
        );

        devolucionesSum = (devs || [])
          .filter((d: any) => paradasNoRechazadas.has(d.parada_id))
          .reduce((sum: number, d: any) => {
            const precio = Number(d.pedido_detalle?.precio_unitario || 0);
            const descuento = Number(d.pedido_detalle?.descuento_porcentaje || 0);
            const precioNeto = precio * (1 - descuento / 100);
            return sum + Number(d.cantidad) * precioNeto;
          }, 0);
      }

      setTotalEntregado(entregadoSum);
      setTotalRechazado(rechazadoSum);
      setTotalDevoluciones(devolucionesSum);
      setTotalEsperado(entregadoSum - devolucionesSum);
      
      let cobrosLegacy: Cobro[] = [];
      if (paradasIds.length > 0) {
        const { data: cobrosViejos } = await supabase
          .from('cobros')
          .select(`
            id,
            monto,
            referencia,
            medio_pago,
            hoja_ruta_parada_id
          `)
          .in('hoja_ruta_parada_id', paradasIds);

        if (cobrosViejos) {
          cobrosLegacy = cobrosViejos.map(c => ({
            id: c.id,
            monto: c.monto,
            referencia: c.referencia,
            forma_pago: { id: 'legacy', nombre: c.medio_pago },
            pedido: { id: '', numero_pedido: 0, cliente_id: '' },
            parada: { id: c.hoja_ruta_parada_id },
          }));
        }
      }

      // Combinar todos los cobros
      const formattedCobrosNuevos = (cobrosNuevos || []).map(c => ({
        ...c,
        forma_pago: c.forma_pago as unknown as { id: string; nombre: string },
        pedido: c.pedido as unknown as { id: string; numero_pedido: number; cliente_id: string },
        parada: c.parada as unknown as { id: string },
      }));
      
      const todosCobros = [...formattedCobrosNuevos, ...cobrosLegacy];
      setCobros(todosCobros);

      // Calcular resumen por medio de pago
      const resumenMap = new Map<string, ResumenPorMedio>();
      todosCobros.forEach(cobro => {
        const fpNombre = cobro.forma_pago.nombre;
        const existing = resumenMap.get(fpNombre);
        if (existing) {
          existing.total += cobro.monto;
        } else {
          resumenMap.set(fpNombre, {
            forma_pago_id: cobro.forma_pago.id,
            nombre: fpNombre,
            total: cobro.monto,
          });
        }
      });
      setResumen(Array.from(resumenMap.values()));

      // Pre-llenar los montos declarados con los totales
      Array.from(resumenMap.values()).forEach(r => {
        const lower = r.nombre.toLowerCase();
        if (lower.includes('efectivo')) setEfectivoDeclarado(r.total);
        else if (lower.includes('transfer')) setTransferenciasDeclarado(r.total);
        else if (lower.includes('qr') || lower.includes('mercado')) setQrDeclarado(r.total);
        else if (lower.includes('tarjeta')) setTarjetaDeclarado(r.total);
      });

      // Verificar si ya existe una rendición
      const { data: rendicion } = await supabase
        .from('hoja_ruta_rendiciones')
        .select('*')
        .eq('hoja_ruta_id', hojaRutaId)
        .maybeSingle();

      setRendicionExistente(rendicion);
      if (rendicion) {
        setObservaciones(rendicion.observaciones || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const getTotalSistema = (tipo: string) => {
    return resumen
      .filter(r => r.nombre.toLowerCase().includes(tipo))
      .reduce((sum, r) => sum + r.total, 0);
  };

  const totalSistema = cobros.reduce((sum, c) => sum + c.monto, 0);
  const totalDeclarado = efectivoDeclarado + transferenciasDeclarado + qrDeclarado + tarjetaDeclarado;
  const diferencia = totalDeclarado - totalSistema;

  const getIcono = (nombre: string) => {
    const lower = nombre.toLowerCase();
    if (lower.includes('efectivo')) return <Banknote className="h-4 w-4" />;
    if (lower.includes('transfer') || lower.includes('qr')) return <Smartphone className="h-4 w-4" />;
    if (lower.includes('tarjeta')) return <CreditCard className="h-4 w-4" />;
    return null;
  };

  const imprimirRendicion = () => {
    const ventana = window.open('', '_blank', 'width=800,height=600');
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
      return;
    }

    const formatCurrency = (v: number) =>
      new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

    // Resumen único por medio de pago: cantidad de cobros + total
    const resumenConCantidad = resumen.map((r) => {
      const cantidad = cobros.filter((c) => (c.forma_pago?.nombre || '') === r.nombre).length;
      return { ...r, cantidad };
    });

    // Total final = cobrado - rechazos
    const totalFinal = totalSistema - totalRechazado;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rendición - Hoja de Ruta #${numeroHoja}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 12mm; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 16px; }
          .header { text-align: center; border-bottom: 3px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { font-size: 20px; font-weight: 900; letter-spacing: 1px; margin-bottom: 4px; }
          .header p { font-size: 13px; color: #555; }
          .section { margin-bottom: 16px; }
          .section-title { font-size: 14px; font-weight: 800; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; }
          thead th { background: #222; color: #fff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          thead th.right { text-align: right; }
          .resumen-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
          .resumen-row .label { display: flex; align-items: center; gap: 6px; }
          .resumen-row .value { font-family: 'Courier New', monospace; font-weight: 700; }
          .total-box { background: #f0f0f0; border: 2px solid #222; border-radius: 4px; padding: 12px 16px; margin-top: 12px; }
          .total-box .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
          .total-box .row.main { font-size: 18px; font-weight: 900; border-top: 2px solid #222; padding-top: 8px; margin-top: 8px; }
          .diferencia { font-size: 16px; font-weight: 800; text-align: center; padding: 10px; margin-top: 12px; border-radius: 4px; }
          .obs { margin-top: 12px; padding: 8px 12px; background: #fafafa; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; }
          .firma { margin-top: 40px; display: flex; justify-content: space-around; }
          .firma-box { text-align: center; width: 200px; }
          .firma-box .linea { border-top: 1px solid #333; margin-top: 50px; padding-top: 4px; font-size: 11px; font-weight: 600; }
          .print-button { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          .print-button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>RENDICIÓN DE COBRANZA</h1>
          <p>Hoja de Ruta #${numeroHoja} — ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
        </div>

        <div class="section">
          <div class="section-title">Resumen por Medio de Pago</div>
          <table>
            <thead>
              <tr>
                <th>Medio de Pago</th>
                <th class="right" style="text-align:right;">Cobros</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${resumenConCantidad.map((r, i) => `
                <tr${i % 2 === 1 ? ' style="background:#f7f7f7;"' : ''}>
                  <td style="padding:6px 10px; border-bottom:1px solid #ddd; font-size:13px; font-weight:600;">${r.nombre}</td>
                  <td style="padding:6px 10px; border-bottom:1px solid #ddd; font-size:13px; text-align:right;">${r.cantidad}</td>
                  <td style="padding:6px 10px; border-bottom:1px solid #ddd; font-size:13px; text-align:right; font-family:'Courier New',monospace; font-weight:700;">$ ${formatCurrency(r.total)}</td>
                </tr>
              `).join('')}
              <tr style="background:#222; color:#fff;">
                <td style="padding:8px 10px; font-size:13px; font-weight:800;">TOTAL SISTEMA</td>
                <td style="padding:8px 10px; font-size:13px; text-align:right; font-weight:800;">${cobros.length}</td>
                <td style="padding:8px 10px; font-size:14px; text-align:right; font-family:'Courier New',monospace; font-weight:800;">$ ${formatCurrency(totalSistema)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${totalRechazado > 0 ? `
        <div class="section">
          <div class="section-title">Rechazos y Total Final</div>
          <table>
            <tbody>
              <tr>
                <td style="padding:6px 10px; border-bottom:1px solid #ddd; font-size:13px;">Cobrado</td>
                <td style="padding:6px 10px; border-bottom:1px solid #ddd; font-size:13px; text-align:right; font-family:'Courier New',monospace; font-weight:700;">$ ${formatCurrency(totalSistema)}</td>
              </tr>
              <tr>
                <td style="padding:6px 10px; border-bottom:1px solid #ddd; font-size:13px; color:#dc2626;">(−) Rechazado</td>
                <td style="padding:6px 10px; border-bottom:1px solid #ddd; font-size:13px; text-align:right; font-family:'Courier New',monospace; font-weight:700; color:#dc2626;">$ ${formatCurrency(totalRechazado)}</td>
              </tr>
              <tr style="background:#222; color:#fff;">
                <td style="padding:8px 10px; font-size:14px; font-weight:800;">TOTAL FINAL</td>
                <td style="padding:8px 10px; font-size:14px; text-align:right; font-family:'Courier New',monospace; font-weight:800;">$ ${formatCurrency(totalFinal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        ${observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${observaciones}</div>` : ''}

        <div class="firma">
          <div class="firma-box"><div class="linea">Chofer / Repartidor</div></div>
          <div class="firma-box"><div class="linea">Responsable</div></div>
        </div>
        ${getPrintMetaHTML()}
        <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
      </body>
      </html>
    `;

    ventana.document.write(html);
    ventana.document.close();
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const rendicionData = {
        hoja_ruta_id: hojaRutaId,
        usuario_id: user.id,
        total_efectivo: efectivoDeclarado,
        total_transferencias: transferenciasDeclarado,
        total_qr: qrDeclarado,
        total_tarjeta: tarjetaDeclarado,
        total_general: totalDeclarado,
        diferencia,
        estado: 'pendiente' as const,
        observaciones: observaciones || null,
      };

      if (rendicionExistente) {
        const { error } = await supabase
          .from('hoja_ruta_rendiciones')
          .update(rendicionData)
          .eq('id', rendicionExistente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hoja_ruta_rendiciones').insert(rendicionData);
        if (error) throw error;

        // Solo impactar cuenta corriente en la primera rendición (no al actualizar)
        // Agrupar cobros por cliente para crear un movimiento consolidado por cliente
        const cobrosPorCliente = new Map<string, { 
          clienteId: string; 
          total: number; 
          formaPagoId: string | null;
          pedidosNums: number[];
        }>();

        cobros.forEach(cobro => {
          if (cobro.pedido.cliente_id) {
            const existing = cobrosPorCliente.get(cobro.pedido.cliente_id);
            if (existing) {
              existing.total += cobro.monto;
              if (cobro.pedido.numero_pedido > 0 && !existing.pedidosNums.includes(cobro.pedido.numero_pedido)) {
                existing.pedidosNums.push(cobro.pedido.numero_pedido);
              }
            } else {
              cobrosPorCliente.set(cobro.pedido.cliente_id, {
                clienteId: cobro.pedido.cliente_id,
                total: cobro.monto,
                formaPagoId: cobro.forma_pago.id !== 'legacy' ? cobro.forma_pago.id : null,
                pedidosNums: cobro.pedido.numero_pedido > 0 ? [cobro.pedido.numero_pedido] : [],
              });
            }
          }
        });

        // Crear movimientos de pago en cuenta corriente para cada cliente
        const movimientos = Array.from(cobrosPorCliente.values())
          .filter(c => c.total > 0)
          .map(c => ({
            cliente_id: c.clienteId,
            tipo: 'pago',
            monto: c.total,
            concepto: c.pedidosNums.length > 0 
              ? `Cobro en entrega - Pedido(s) #${c.pedidosNums.join(', #')} - HR #${numeroHoja}`
              : `Cobro en entrega - Hoja Ruta #${numeroHoja}`,
            forma_pago_id: c.formaPagoId,
            usuario_registro_id: user.id,
            estado_imputacion: 'confirmado',
          }));

        if (movimientos.length > 0) {
          const { error: movError } = await supabase
            .from('cliente_movimientos')
            .insert(movimientos);
          
          if (movError) {
            console.error('Error al impactar cuenta corriente:', movError);
            // No lanzamos error para no bloquear la rendición
            toast.warning('Rendición guardada, pero hubo un error al impactar cuenta corriente');
          }
        }
      }

      // Actualizar estado de la hoja de ruta a "completada"
      await supabase
        .from('hojas_ruta')
        .update({ estado: 'completada' })
        .eq('id', hojaRutaId);

      toast.success('Rendición registrada correctamente');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving rendicion:', error);
      toast.error('Error al guardar la rendición');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Rendición de Cobranza - Hoja #{numeroHoja}{zonasTitulo ? ` — Zona: ${zonasTitulo}` : ''}
          </DialogTitle>
          <DialogDescription>
            Declara los montos recaudados para cerrar la hoja de ruta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumen de entregas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resumen de Entregas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total entregado:</span>
                  <span className="font-medium text-green-600">
                    +${totalEntregado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {totalRechazado > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pedidos rechazados:</span>
                    <span className="font-medium text-destructive">
                      -${totalRechazado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {totalDevoluciones > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Devoluciones parciales:</span>
                    <span className="font-medium text-amber-600">
                      -${totalDevoluciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total a rendir:</span>
                  <span className="text-primary">
                    ${totalEsperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen de cobros registrados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobros Registrados en Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              {resumen.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cobros registrados</p>
              ) : (
                <div className="space-y-2">
                  {resumen.map((r) => (
                    <div key={r.forma_pago_id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        {getIcono(r.nombre)}
                        <span>{r.nombre}</span>
                      </div>
                      <span className="font-medium">
                        ${r.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total Sistema:</span>
                    <span>${totalSistema.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reclasificación administrativa de cobros (solo admin/encargado) */}
          {esAdmin && cobros.filter(c => c.forma_pago.id !== 'legacy').length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Detalle de cobros · Reclasificación administrativa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {cobros.filter(c => c.forma_pago.id !== 'legacy').map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                      <div className="text-xs">
                        <span className="font-medium">#{c.pedido.numero_pedido || '—'}</span>
                        {' · '}
                        <span>{c.forma_pago.nombre}</span>
                        {c.subsanado_administrativo && (
                          <Badge variant="outline" className="ml-2 text-[10px]">subsanado</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          ${Number(c.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setCobroASubsanar(c)}>
                          Reclasificar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Montos declarados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Declaración de Montos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Banknote className="h-3 w-3" /> Efectivo
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={efectivoDeclarado || ''}
                    onChange={(e) => setEfectivoDeclarado(Number(e.target.value))}
                  />
                  {getTotalSistema('efectivo') > 0 && efectivoDeclarado !== getTotalSistema('efectivo') && (
                    <p className="text-xs text-warning">
                      Sistema: ${getTotalSistema('efectivo').toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Transferencias
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transferenciasDeclarado || ''}
                    onChange={(e) => setTransferenciasDeclarado(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> QR / Mercado Pago
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={qrDeclarado || ''}
                    onChange={(e) => setQrDeclarado(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Tarjeta
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tarjetaDeclarado || ''}
                    onChange={(e) => setTarjetaDeclarado(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          <Card className={diferencia === 0 ? 'border-success' : 'border-warning'}>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total Declarado:</span>
                <span className="text-2xl font-bold">
                  ${totalDeclarado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`flex justify-between items-center text-sm ${
                diferencia === 0 ? 'text-success' : diferencia > 0 ? 'text-blue-600' : 'text-destructive'
              }`}>
                <span className="flex items-center gap-1">
                  {diferencia === 0 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  Diferencia:
                </span>
                <span className="font-semibold">
                  {diferencia >= 0 ? '+' : ''}${diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  {diferencia === 0 && ' ✓'}
                  {diferencia > 0 && ' (Sobrante)'}
                  {diferencia < 0 && ' (Faltante)'}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre la rendición, diferencias, etc."
              rows={2}
            />
          </div>

          {rendicionExistente && (
            <Badge variant={
              rendicionExistente.estado === 'aprobada' ? 'default' :
              rendicionExistente.estado === 'rechazada' ? 'destructive' : 'secondary'
            }>
              Estado: {rendicionExistente.estado.charAt(0).toUpperCase() + rendicionExistente.estado.slice(1)}
            </Badge>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={imprimirRendicion}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {rendicionExistente ? 'Actualizar Rendición' : 'Registrar Rendición'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <SubsanarCobroDialog
      open={!!cobroASubsanar}
      onOpenChange={(v) => { if (!v) setCobroASubsanar(null); }}
      cobro={cobroASubsanar}
      onSuccess={() => { setCobroASubsanar(null); loadData(); }}
    />
    </>
  );
}
