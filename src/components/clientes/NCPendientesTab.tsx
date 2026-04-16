import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useNotasCreditoPendientes, useAprobarNC, useDescartarNC, NotaCreditoPendiente } from '@/hooks/useNotasCredito';

interface NCPendientesTabProps {
  clienteId: string;
  onChange?: () => void;
}

export function NCPendientesTab({ clienteId, onChange }: NCPendientesTabProps) {
  const { data: ncs = [], isLoading } = useNotasCreditoPendientes({ cliente_id: clienteId });
  const aprobar = useAprobarNC();
  const descartar = useDescartarNC();

  const [aprobarDialog, setAprobarDialog] = useState<NotaCreditoPendiente | null>(null);
  const [descartarDialog, setDescartarDialog] = useState<NotaCreditoPendiente | null>(null);

  // Form aprobación
  const [generarNCMov, setGenerarNCMov] = useState(true);
  const [reingresarStock, setReingresarStock] = useState(true);
  const [observaciones, setObservaciones] = useState('');

  const openAprobar = (nc: NotaCreditoPendiente) => {
    setAprobarDialog(nc);
    setGenerarNCMov(nc.generar_nc);
    setReingresarStock(nc.reingresar_stock);
    setObservaciones('');
  };

  const handleAprobar = async () => {
    if (!aprobarDialog) return;
    await aprobar.mutateAsync({
      ncId: aprobarDialog.id,
      reingresarStock,
      generarNC: generarNCMov,
      observaciones,
    });
    setAprobarDialog(null);
    onChange?.();
  };

  const handleDescartar = async () => {
    if (!descartarDialog) return;
    await descartar.mutateAsync({ ncId: descartarDialog.id, observaciones });
    setDescartarDialog(null);
    setObservaciones('');
    onChange?.();
  };

  const getEstadoBadge = (estado: string) => {
    if (estado === 'pendiente') return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendiente</Badge>;
    if (estado === 'aprobada') return <Badge className="gap-1"><Check className="h-3 w-3" />Aprobada</Badge>;
    return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />Descartada</Badge>;
  };

  const getOrigenLabel = (o: string) =>
    o === 'rechazo_logistica' ? 'Rechazo en logística' :
    o === 'devolucion_manual' ? 'Devolución manual' :
    o === 'rechazo_pedido' ? 'Rechazo de pedido' : o;

  if (isLoading) return <div className="text-center py-6 text-muted-foreground">Cargando...</div>;
  if (ncs.length === 0) return <div className="text-center py-6 text-muted-foreground">Sin notas de crédito pendientes</div>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-center">Cant.</TableHead>
            <TableHead className="text-right">Importe</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ncs.map((nc) => (
            <TableRow key={nc.id}>
              <TableCell className="text-sm">{format(new Date(nc.created_at), 'dd/MM/yyyy')}</TableCell>
              <TableCell className="text-xs">{getOrigenLabel(nc.origen)}</TableCell>
              <TableCell className="text-sm">
                {nc.producto?.descripcion ? (
                  <>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{nc.producto.codigo_articulo}</span>
                    {nc.producto.descripcion}
                  </>
                ) : '-'}
              </TableCell>
              <TableCell className="text-center">{nc.cantidad}</TableCell>
              <TableCell className="text-right font-bold">
                ${Number(nc.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-sm">{nc.motivo}</TableCell>
              <TableCell>{getEstadoBadge(nc.estado)}</TableCell>
              <TableCell className="text-right">
                {nc.estado === 'pendiente' && (
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="default" onClick={() => openAprobar(nc)}>
                      <Check className="h-3 w-3 mr-1" /> Aprobar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setDescartarDialog(nc); setObservaciones(''); }}>
                      <X className="h-3 w-3 mr-1" /> Descartar
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Diálogo Aprobar */}
      <Dialog open={!!aprobarDialog} onOpenChange={(o) => !o && setAprobarDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Nota de Crédito</DialogTitle>
          </DialogHeader>
          {aprobarDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div><strong>Producto:</strong> {aprobarDialog.producto?.descripcion || '-'}</div>
                <div><strong>Cantidad:</strong> {aprobarDialog.cantidad}</div>
                <div><strong>Importe:</strong> ${Number(aprobarDialog.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div><strong>Motivo:</strong> {aprobarDialog.motivo}</div>
              </div>

              <div className="space-y-3 p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox id="gen-nc" checked={generarNCMov} onCheckedChange={(v) => setGenerarNCMov(v === true)} />
                  <Label htmlFor="gen-nc" className="cursor-pointer">
                    Generar movimiento NC en cuenta corriente (reduce saldo)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="rein-stock" checked={reingresarStock} onCheckedChange={(v) => setReingresarStock(v === true)} />
                  <Label htmlFor="rein-stock" className="cursor-pointer">
                    Reingresar al stock
                  </Label>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAprobarDialog(null)}>Cancelar</Button>
            <Button onClick={handleAprobar} disabled={aprobar.isPending}>
              {aprobar.isPending ? 'Aprobando...' : 'Confirmar aprobación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Descartar */}
      <Dialog open={!!descartarDialog} onOpenChange={(o) => !o && setDescartarDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar Nota de Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              La NC quedará marcada como descartada y no afectará la cuenta corriente ni el stock.
            </p>
            <div className="space-y-1">
              <Label>Motivo del descarte</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescartarDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDescartar} disabled={descartar.isPending}>
              {descartar.isPending ? 'Descartando...' : 'Descartar NC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
