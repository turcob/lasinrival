import { Card, CardContent } from '@/components/ui/card';
import { useCobrosHojaRuta, useHojaRuta, useDevolucionesHojaRuta } from '@/hooks/useLogistica';
import { clasificarMedioPago } from '@/hooks/useEncargado';
import { useMemo, useState } from 'react';
import { PackageX, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const MOTIVO_LABEL: Record<string, string> = {
  rechazo_cliente: 'Rechazo cliente',
  producto_vencido: 'Vencido',
  producto_roto: 'Dañado',
  producto_faltante: 'Faltante',
  producto_sobrante: 'Sobrante',
  cambio: 'Cambio',
  error_pedido: 'Error pedido',
  otro: 'Otro',
};

export function ResumenCobrosTab({ hojaRutaId }: { hojaRutaId: string }) {
  const { data: cobros = [] } = useCobrosHojaRuta(hojaRutaId);
  const { data: hoja } = useHojaRuta(hojaRutaId);
  const { data: devoluciones = [] } = useDevolucionesHojaRuta(hojaRutaId);
  const paradas: any[] = (hoja as any)?.paradas ?? [];
  const totales: Record<string, number> = { efectivo: 0, transferencias: 0, qr: 0, tarjeta: 0, otro: 0 };
  const cantidades: Record<string, number> = { efectivo: 0, transferencias: 0, qr: 0, tarjeta: 0, otro: 0 };
  cobros.forEach((c: any) => {
    const tipo = clasificarMedioPago(c.forma_pago?.nombre ?? c.medio_pago ?? '');
    totales[tipo] += Number(c.monto);
    cantidades[tipo] += 1;
  });
  const total = Object.values(totales).reduce((s, v) => s + v, 0);
  const labels: Record<string, string> = {
    efectivo: 'Efectivo', transferencias: 'Transferencias', qr: 'QR', tarjeta: 'Tarjeta', otro: 'Otros',
  };

  const cobrosPorCliente = useMemo(() => {
    const map = new Map<string, { cliente: string; total: number; medios: Set<string> }>();
    cobros.forEach((c: any) => {
      const cliente = c.pedido?.cliente?.nombre
        ?? paradas.find((p: any) => p.id === c.parada?.id)?.pedido?.cliente?.nombre
        ?? `Pedido #${c.pedido?.numero_pedido ?? '?'}`;
      const cur = map.get(cliente) ?? { cliente, total: 0, medios: new Set<string>() };
      cur.total += Number(c.monto);
      const fp = c.forma_pago?.nombre ?? c.medio_pago ?? '';
      if (fp) cur.medios.add(fp);
      map.set(cliente, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [cobros, paradas]);

  const rechazosPorCliente = useMemo(() => {
    const map = new Map<string, {
      cliente: string;
      items: Array<{ codigo: string; descripcion: string; cantidad: number; motivo: string; importe: number }>;
      total: number;
    }>();
    (devoluciones as any[]).forEach((d) => {
      const cliente = d.parada?.pedido?.cliente?.nombre
        ?? paradas.find((p: any) => p.id === d.parada_id)?.pedido?.cliente?.nombre
        ?? 'Sin cliente';
      const precio = Number(d.pedido_detalle?.precio_unitario ?? 0);
      const desc = Number(d.pedido_detalle?.descuento_porcentaje ?? 0);
      const neto = precio * (1 - desc / 100);
      const importe = neto * Number(d.cantidad ?? 0);
      const cur = map.get(cliente) ?? { cliente, items: [], total: 0 };
      cur.items.push({
        codigo: d.pedido_detalle?.producto?.codigo_articulo ?? '-',
        descripcion: d.pedido_detalle?.producto?.descripcion ?? 'Producto',
        cantidad: Number(d.cantidad ?? 0),
        motivo: MOTIVO_LABEL[d.motivo] ?? d.motivo ?? '-',
        importe,
      });
      cur.total += importe;
      map.set(cliente, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [devoluciones, paradas]);

  const totalRechazado = rechazosPorCliente.reduce((s, c) => s + c.total, 0);

  const comprobantes = useMemo(() => {
    return (cobros as any[])
      .filter((c) => c.foto_comprobante_path)
      .map((c) => ({
        id: c.id,
        path: c.foto_comprobante_path as string,
        nombre: c.foto_comprobante_nombre as string | null,
        forma: c.forma_pago?.nombre ?? c.medio_pago ?? '',
        monto: Number(c.monto),
        cliente: c.pedido?.cliente?.nombre
          ?? paradas.find((p: any) => p.id === c.parada?.id)?.pedido?.cliente?.nombre
          ?? `Pedido #${c.pedido?.numero_pedido ?? '?'}`,
      }));
  }, [cobros, paradas]);

  const [verImg, setVerImg] = useState<string | null>(null);

  const verComprobante = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('comprobantes-cobros')
      .createSignedUrl(path, 600);
    if (!error && data?.signedUrl) setVerImg(data.signedUrl);
  };

  return (
    <div className="space-y-2">
      {Object.entries(totales).filter(([_, v]) => v > 0).map(([k, v]) => (
        <Card key={k}>
          <CardContent className="p-3 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-medium">{labels[k]}</span>
              <span className="text-[11px] text-muted-foreground">
                {cantidades[k]} {cantidades[k] === 1 ? 'cobro realizado' : 'cobros realizados'}
              </span>
            </div>
            <span className="font-bold">${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </CardContent>
        </Card>
      ))}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-3 flex justify-between items-center">
          <span className="font-semibold">Total cobrado</span>
          <span className="text-xl font-bold">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center pt-2">{cobros.length} cobros registrados</p>

      {cobrosPorCliente.length > 0 && (
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">DETALLE POR CLIENTE ({cobrosPorCliente.length})</p>
          <Card>
            <CardContent className="p-0 divide-y">
              {cobrosPorCliente.map((c, i) => (
                <div key={i} className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium truncate flex-1">{c.cliente}</p>
                    <span className="font-semibold text-sm">${c.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{Array.from(c.medios).join(' · ')}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {rechazosPorCliente.length > 0 && (
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <PackageX className="h-3.5 w-3.5 text-destructive" />
              RECHAZOS POR CLIENTE ({rechazosPorCliente.length})
            </p>
            <span className="text-xs font-semibold text-destructive">
              -${totalRechazado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Card className="border-destructive/30">
            <CardContent className="p-0 divide-y">
              {rechazosPorCliente.map((c, i) => (
                <div key={i} className="p-3 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium truncate flex-1">{c.cliente}</p>
                    <span className="font-semibold text-sm text-destructive">
                      -${c.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {c.items.map((it, j) => (
                      <li key={j} className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="min-w-0 flex-1">
                          <span className="font-mono">{it.codigo}</span> · {it.descripcion}
                          <span className="text-foreground/70"> — {it.cantidad} ud · {it.motivo}</span>
                        </span>
                        <span className="font-medium text-destructive/80 whitespace-nowrap">
                          ${it.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {comprobantes.length > 0 && (
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            COMPROBANTES DE TRANSFERENCIA ({comprobantes.length})
          </p>
          <Card>
            <CardContent className="p-0 divide-y">
              {comprobantes.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.cliente}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.forma} · ${c.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => verComprobante(c.path)}>
                    <ImageIcon className="h-3.5 w-3.5 mr-1" /> Ver
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!verImg} onOpenChange={(o) => !o && setVerImg(null)}>
        <DialogContent className="max-w-3xl p-2">
          {verImg && <img src={verImg} alt="Comprobante" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}