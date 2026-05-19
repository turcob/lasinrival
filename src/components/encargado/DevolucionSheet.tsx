import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useRegistrarDevolucion, useActualizarEstadoParada, type DevolucionMotivo } from '@/hooks/useLogistica';
import { PackageX, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MOTIVOS: { value: DevolucionMotivo; label: string }[] = [
  { value: 'rechazo_cliente', label: 'Rechazo cliente' },
  { value: 'producto_vencido', label: 'Vencido' },
  { value: 'producto_roto', label: 'Dañado' },
  { value: 'producto_faltante', label: 'Faltante' },
  { value: 'cambio', label: 'Cambio' },
  { value: 'error_pedido', label: 'Error pedido' },
  { value: 'otro', label: 'Otro' },
];

interface ItemDevolucion {
  detalle_id: string;
  codigo: string;
  descripcion: string;
  cantidad_pedida: number;
  cantidad_devolver: number;
  motivo: DevolucionMotivo | '';
}

interface DevolucionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRutaId: string;
  paradaId: string;
  pedidoDetalles: Array<{
    id: string;
    cantidad_pedida: number;
    producto?: { descripcion: string; codigo_articulo: string };
  }>;
  clienteNombre: string;
  onSuccess: () => void;
}

export function DevolucionSheet({
  open, onOpenChange, hojaRutaId, paradaId, pedidoDetalles, clienteNombre, onSuccess,
}: DevolucionSheetProps) {
  const registrar = useRegistrarDevolucion();
  const cambiarEstado = useActualizarEstadoParada();
  const { toast } = useToast();
  const [items, setItems] = useState<ItemDevolucion[]>([]);
  const [detalleMotivo, setDetalleMotivo] = useState('');
  const [reingresar, setReingresar] = useState(true);

  useEffect(() => {
    if (open) {
      setItems(pedidoDetalles.map(d => ({
        detalle_id: d.id,
        codigo: d.producto?.codigo_articulo ?? '-',
        descripcion: d.producto?.descripcion ?? 'Producto',
        cantidad_pedida: d.cantidad_pedida,
        cantidad_devolver: 0,
        motivo: '',
      })));
      setDetalleMotivo('');
      setReingresar(true);
    }
  }, [open, pedidoDetalles]);

  const seleccionarTodos = () => {
    setItems(items.map(i => ({ ...i, cantidad_devolver: i.cantidad_pedida })));
  };

  const aRechazar = items.filter(i => i.cantidad_devolver > 0);

  const handleSubmit = async () => {
    if (aRechazar.length === 0) {
      toast({ title: 'Marcá al menos un producto a rechazar', variant: 'destructive' });
      return;
    }
    const sinMotivo = aRechazar.filter(i => !i.motivo);
    if (sinMotivo.length > 0) {
      toast({ title: 'Falta motivo en algún producto', variant: 'destructive' });
      return;
    }
    try {
      for (const it of aRechazar) {
        await registrar.mutateAsync({
          hoja_ruta_id: hojaRutaId,
          parada_id: paradaId,
          pedido_detalle_id: it.detalle_id,
          cantidad: it.cantidad_devolver,
          motivo: it.motivo as DevolucionMotivo,
          detalle_motivo: detalleMotivo || undefined,
          reingresarStock: reingresar,
        });
      }
      // Si se rechazaron TODOS los items del pedido en su totalidad → estado 'rechazado'.
      // Caso contrario, dejamos la parada pendiente para que el encargado registre
      // el cobro por la diferencia y elija "Entrega parcial" o "Entrega completa".
      const rechazoTotal =
        items.length > 0 &&
        items.every((i) => i.cantidad_devolver >= i.cantidad_pedida && i.cantidad_pedida > 0);
      if (rechazoTotal) {
        await cambiarEstado.mutateAsync({
          id: paradaId,
          estado: 'rechazado',
          observaciones: detalleMotivo || undefined,
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (e) { /* manejado por hook */ }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background border-b p-4">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg flex items-center gap-2">
              <PackageX className="h-5 w-5 text-destructive" />
              Rechazar — {clienteNombre}
            </SheetTitle>
            <SheetDescription>
              Marcá los productos que el cliente rechazó. Se genera una NC pendiente.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="p-4 space-y-3 pb-32">
          <Button variant="outline" size="sm" onClick={seleccionarTodos}>
            Rechazar todo el pedido
          </Button>

          {items.map((item, idx) => (
            <Card key={item.detalle_id} className={item.cantidad_devolver > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{item.codigo}</p>
                    <p className="text-sm font-medium leading-tight">{item.descripcion}</p>
                  </div>
                  <Badge variant="outline">Pedido: {item.cantidad_pedida}</Badge>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number" inputMode="decimal" min={0} max={item.cantidad_pedida}
                    placeholder="Cant. a rechazar"
                    className="h-11 text-base"
                    value={item.cantidad_devolver || ''}
                    onChange={(e) => {
                      const v = Math.min(Number(e.target.value) || 0, item.cantidad_pedida);
                      setItems(items.map((x, i) => i === idx ? { ...x, cantidad_devolver: v } : x));
                    }}
                  />
                </div>
                {item.cantidad_devolver > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {MOTIVOS.map(m => (
                      <Button
                        key={m.value}
                        size="sm"
                        variant={item.motivo === m.value ? 'default' : 'outline'}
                        className="h-8 text-xs"
                        onClick={() => setItems(items.map((x, i) => i === idx ? { ...x, motivo: m.value } : x))}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {aRechazar.length > 0 && (
            <>
              <Textarea
                placeholder="Detalle adicional (opcional)"
                rows={2}
                value={detalleMotivo}
                onChange={(e) => setDetalleMotivo(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={reingresar} onCheckedChange={(c) => setReingresar(c === true)} />
                Sugerir reingresar al stock
              </label>
            </>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background p-3 shadow-lg">
          <div className="max-w-md mx-auto">
            <Button
              variant="destructive" size="lg" className="w-full h-14"
              disabled={registrar.isPending || cambiarEstado.isPending || aRechazar.length === 0}
              onClick={handleSubmit}
            >
              {(registrar.isPending || cambiarEstado.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar rechazo
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}