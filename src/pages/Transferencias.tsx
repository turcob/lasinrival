import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, CheckCircle2, XCircle, Clock, Plus, Check, X } from 'lucide-react';
import { useTransferencias, useValidarTransferencia, TransferenciaEstado, Transferencia } from '@/hooks/useTransferencias';
import { NuevaTransferenciaDialog } from '@/components/transferencias/NuevaTransferenciaDialog';
import { RechazarTransferenciaDialog } from '@/components/transferencias/RechazarTransferenciaDialog';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const ORIGEN_LABEL: Record<string, string> = { manual: 'Manual', venta: 'Venta', cobro_cc: 'Cta. Cte.' };

export default function Transferencias() {
  const { data: transferencias = [], isLoading } = useTransferencias();
  const validar = useValidarTransferencia();

  const [estadoFiltro, setEstadoFiltro] = useState<TransferenciaEstado | 'todos'>('todos');
  const [buscarCliente, setBuscarCliente] = useState('');
  const [buscarOp, setBuscarOp] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [rechazarId, setRechazarId] = useState<string | null>(null);

  // Base: aplica TODOS los filtros menos estado (para contar tarjetas)
  const base = useMemo(() => {
    return transferencias.filter(t => {
      if (buscarCliente && !(t.cliente?.nombre || '').toLowerCase().includes(buscarCliente.toLowerCase())) return false;
      if (buscarOp && !(t.numero_operacion || '').toLowerCase().includes(buscarOp.toLowerCase())) return false;
      if (fechaDesde && t.fecha_transferencia < fechaDesde) return false;
      if (fechaHasta && t.fecha_transferencia > fechaHasta) return false;
      return true;
    });
  }, [transferencias, buscarCliente, buscarOp, fechaDesde, fechaHasta]);

  const conteo = useMemo(() => ({
    pendiente: base.filter(t => t.estado === 'pendiente').length,
    validada: base.filter(t => t.estado === 'validada').length,
    rechazada: base.filter(t => t.estado === 'rechazada').length,
  }), [base]);

  const filtradas = useMemo(
    () => estadoFiltro === 'todos' ? base : base.filter(t => t.estado === estadoFiltro),
    [base, estadoFiltro]
  );

  const renderEstado = (t: Transferencia) => {
    if (t.estado === 'pendiente') return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
    if (t.estado === 'validada') return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Validada</Badge>;
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazada</Badge>;
  };

  const cards: { estado: TransferenciaEstado; label: string; color: string; icon: any }[] = [
    { estado: 'pendiente', label: 'Pendientes', color: 'text-yellow-600', icon: Clock },
    { estado: 'validada', label: 'Validadas', color: 'text-green-600', icon: CheckCircle2 },
    { estado: 'rechazada', label: 'Rechazadas', color: 'text-red-600', icon: XCircle },
  ];

  return (
    <MainLayout>
      <PageHeader title="Transferencias" description="Gestión de transferencias bancarias recibidas" icon={ArrowLeftRight}>
        <Button onClick={() => setNuevaOpen(true)}><Plus className="h-4 w-4 mr-2" />Nueva Transferencia</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {cards.map(c => {
          const Icon = c.icon;
          const active = estadoFiltro === c.estado;
          return (
            <Card
              key={c.estado}
              className={`cursor-pointer transition ${active ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setEstadoFiltro(active ? 'todos' : c.estado)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{conteo[c.estado]}</p>
                </div>
                <Icon className={`h-8 w-8 ${c.color}`} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input placeholder="Buscar cliente..." value={buscarCliente} onChange={e => setBuscarCliente(e.target.value)} />
          <Input placeholder="Nº operación..." value={buscarOp} onChange={e => setBuscarOp(e.target.value)} />
          <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          <Select value={estadoFiltro} onValueChange={(v: any) => setEstadoFiltro(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="validada">Validada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>CUIL</TableHead>
                <TableHead>Nº Operación</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin transferencias</TableCell></TableRow>
              ) : (
                filtradas.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.fecha_transferencia).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell>{t.cliente?.nombre || '-'}</TableCell>
                    <TableCell>{t.titular_nombre}</TableCell>
                    <TableCell>{t.titular_cuil || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{t.numero_operacion || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{ORIGEN_LABEL[t.origen] || t.origen}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(t.importe))}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild><span>{renderEstado(t)}</span></TooltipTrigger>
                          {(t.validado_at || t.rechazado_at) && (
                            <TooltipContent>
                              {t.estado === 'validada' && <div>Validada {new Date(t.validado_at!).toLocaleString('es-AR')}</div>}
                              {t.estado === 'rechazada' && (
                                <>
                                  <div>Rechazada {new Date(t.rechazado_at!).toLocaleString('es-AR')}</div>
                                  {t.observacion_rechazo && <div className="mt-1 text-xs">{t.observacion_rechazo}</div>}
                                </>
                              )}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.estado === 'pendiente' && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="default" onClick={() => validar.mutate(t.id)} disabled={validar.isPending}>
                            <Check className="h-4 w-4 mr-1" />Validar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRechazarId(t.id)}>
                            <X className="h-4 w-4 mr-1" />Rechazar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NuevaTransferenciaDialog open={nuevaOpen} onOpenChange={setNuevaOpen} />
      <RechazarTransferenciaDialog open={!!rechazarId} onOpenChange={(v) => !v && setRechazarId(null)} transferenciaId={rechazarId} />
    </MainLayout>
  );
}