import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useChoferPendientes, useActualizarChoferPendiente, ChoferPendiente } from '@/hooks/useLogistica';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Ban } from 'lucide-react';

const ESTADO_BADGE: Record<ChoferPendiente['estado'], { label: string; variant: any }> = {
  pendiente: { label: 'Pendiente', variant: 'destructive' },
  descontado: { label: 'Descontado en liquidación', variant: 'default' },
  saldado_manual: { label: 'Saldado manualmente', variant: 'secondary' },
  anulado: { label: 'Anulado', variant: 'outline' },
};

export default function PendientesChofer() {
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | ChoferPendiente['estado']>('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [accionando, setAccionando] = useState<{ p: ChoferPendiente; tipo: 'saldar' | 'anular' } | null>(null);
  const [obs, setObs] = useState('');

  const { data: pendientes = [], isLoading } = useChoferPendientes({ estado: estadoFiltro });
  const actualizar = useActualizarChoferPendiente();

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return pendientes;
    return pendientes.filter(p =>
      (p.empleado?.nombre ?? '').toLowerCase().includes(t) ||
      String(p.hoja_ruta?.numero_hoja ?? '').includes(t) ||
      (p.concepto ?? '').toLowerCase().includes(t)
    );
  }, [pendientes, busqueda]);

  const totalPendiente = useMemo(
    () => pendientes.filter(p => p.estado === 'pendiente').reduce((s, p) => s + Number(p.monto), 0),
    [pendientes]
  );

  const handleConfirmarAccion = async () => {
    if (!accionando) return;
    await actualizar.mutateAsync({
      id: accionando.p.id,
      estado: accionando.tipo === 'saldar' ? 'saldado_manual' : 'anulado',
      observaciones: obs || undefined,
    });
    setAccionando(null);
    setObs('');
  };

  return (
    <MainLayout>
      <PageHeader
        title="Pendientes de Chofer"
        description="Faltantes de efectivo registrados al aprobar rendiciones. Se descuentan manualmente en la liquidación mensual."
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-56">
          <Label className="text-xs">Estado</Label>
          <Select value={estadoFiltro} onValueChange={(v: any) => setEstadoFiltro(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="descontado">Descontados</SelectItem>
              <SelectItem value="saldado_manual">Saldados manualmente</SelectItem>
              <SelectItem value="anulado">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-60">
          <Label className="text-xs">Buscar</Label>
          <Input
            placeholder="Chofer, hoja de ruta o concepto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Card className="ml-auto">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total pendiente</p>
            <p className="text-xl font-bold text-destructive">
              ${totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Cargando…</div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No hay pendientes con los filtros actuales
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Hoja de Ruta</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map(p => {
                  const badge = ESTADO_BADGE[p.estado];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {format(new Date(p.fecha), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">{p.empleado?.nombre ?? '—'}</TableCell>
                      <TableCell>#{p.hoja_ruta?.numero_hoja ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.concepto}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        ${Number(p.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.estado === 'pendiente' && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setAccionando({ p, tipo: 'saldar' }); setObs(''); }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Saldar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setAccionando({ p, tipo: 'anular' }); setObs(''); }}
                            >
                              <Ban className="h-4 w-4 mr-1" /> Anular
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!accionando} onOpenChange={(v) => { if (!v) setAccionando(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accionando?.tipo === 'saldar' ? 'Saldar pendiente manualmente' : 'Anular pendiente'}
            </DialogTitle>
          </DialogHeader>
          {accionando && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>Chofer:</strong> {accionando.p.empleado?.nombre ?? '—'}<br />
                <strong>Monto:</strong> ${Number(accionando.p.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}<br />
                <strong>Concepto:</strong> {accionando.p.concepto}
              </p>
              <div>
                <Label className="text-xs">Observaciones</Label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder={accionando.tipo === 'saldar'
                    ? 'Ej: depositó en efectivo, descontado de caja, etc.'
                    : 'Motivo de la anulación'}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccionando(null)}>Cancelar</Button>
            <Button onClick={handleConfirmarAccion} disabled={actualizar.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}