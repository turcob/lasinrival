import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCobrosHojaRuta, useRendicionHojaRuta } from '@/hooks/useLogistica';
import { clasificarMedioPago, useGuardarRendicion } from '@/hooks/useEncargado';
import { Loader2 } from 'lucide-react';

export function RendicionTab({ hojaRutaId, numeroHoja }: { hojaRutaId: string; numeroHoja: number }) {
  const { data: cobros = [] } = useCobrosHojaRuta(hojaRutaId);
  const { data: rendicion } = useRendicionHojaRuta(hojaRutaId);
  const guardar = useGuardarRendicion();

  const esperado = useMemo(() => {
    const t: Record<string, number> = { efectivo: 0, transferencias: 0, qr: 0, tarjeta: 0 };
    cobros.forEach((c: any) => {
      const tipo = clasificarMedioPago(c.forma_pago?.nombre ?? c.medio_pago ?? '');
      if (tipo !== 'otro') t[tipo] += Number(c.monto);
    });
    return t;
  }, [cobros]);

  const [efectivo, setEfectivo] = useState(0);
  const [transferencias, setTransferencias] = useState(0);
  const [qr, setQr] = useState(0);
  const [tarjeta, setTarjeta] = useState(0);
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (rendicion) {
      setEfectivo(Number(rendicion.total_efectivo));
      setTransferencias(Number(rendicion.total_transferencias));
      setQr(Number(rendicion.total_qr));
      setTarjeta(Number(rendicion.total_tarjeta));
      setObs(rendicion.observaciones ?? '');
    } else {
      setEfectivo(esperado.efectivo); setTransferencias(esperado.transferencias);
      setQr(esperado.qr); setTarjeta(esperado.tarjeta);
    }
  }, [rendicion, esperado.efectivo, esperado.transferencias, esperado.qr, esperado.tarjeta]);

  const totalDeclarado = efectivo + transferencias + qr + tarjeta;
  const totalEsperado = esperado.efectivo + esperado.transferencias + esperado.qr + esperado.tarjeta;
  const diferencia = totalDeclarado - totalEsperado;
  const readonly = rendicion && rendicion.estado !== 'pendiente';

  const Row = ({ label, value, setter, expected }: { label: string; value: number; setter: (n: number) => void; expected: number }) => (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
      <div>
        <Label className="text-xs">{label}</Label>
        <p className="text-xs text-muted-foreground">Esperado: ${expected.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
      </div>
      <Input
        type="number" inputMode="decimal" step="0.01"
        className="h-11 w-32 text-right font-medium"
        value={value || ''}
        disabled={!!readonly}
        onChange={(e) => setter(Number(e.target.value) || 0)}
      />
    </div>
  );

  const handleSubmit = () => {
    guardar.mutate({
      hojaRutaId, numeroHoja,
      rendicionExistenteId: rendicion?.id ?? null,
      totales: {
        efectivo, transferencias, qr, tarjeta,
        general: totalDeclarado, diferencia,
      },
      observaciones: obs,
      impactarCuentaCorriente: !rendicion,
    });
  };

  return (
    <div className="space-y-4 pb-6">
      {rendicion && (
        <Badge
          variant={rendicion.estado === 'aprobada' ? 'default' : rendicion.estado === 'rechazada' ? 'destructive' : 'secondary'}
          className="capitalize"
        >
          Estado: {rendicion.estado}
        </Badge>
      )}
      <Card><CardContent className="p-3 space-y-3">
        <Row label="Efectivo" value={efectivo} setter={setEfectivo} expected={esperado.efectivo} />
        <Row label="Transferencias" value={transferencias} setter={setTransferencias} expected={esperado.transferencias} />
        <Row label="QR / MercadoPago" value={qr} setter={setQr} expected={esperado.qr} />
        <Row label="Tarjeta" value={tarjeta} setter={setTarjeta} expected={esperado.tarjeta} />
      </CardContent></Card>

      <Card className={diferencia === 0 ? 'border-green-500 bg-green-500/5' : 'border-amber-500 bg-amber-500/5'}>
        <CardContent className="p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Esperado total:</span><span>${totalEsperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between"><span>Declarado total:</span><span className="font-semibold">${totalDeclarado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between pt-1 border-t font-bold">
            <span>Diferencia:</span>
            <span className={diferencia === 0 ? 'text-green-700' : diferencia < 0 ? 'text-red-700' : 'text-amber-700'}>
              {diferencia >= 0 ? '+' : ''}${diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>

      <Textarea
        placeholder="Observaciones (opcional)"
        rows={3}
        value={obs}
        disabled={!!readonly}
        onChange={(e) => setObs(e.target.value)}
      />

      {!readonly && (
        <Button size="lg" className="w-full h-14" onClick={handleSubmit} disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {rendicion ? 'Actualizar rendición' : 'Enviar rendición'}
        </Button>
      )}
    </div>
  );
}