import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCargaItems, useMarcarCargaItem, useConfirmarCargaForzada, type CargaItem } from '@/hooks/useEncargado';
import { Check, X, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function CargaTab({ hojaRutaId }: { hojaRutaId: string }) {
  const { data: items = [], isLoading } = useCargaItems(hojaRutaId);
  const marcar = useMarcarCargaItem();
  const confirmar = useConfirmarCargaForzada();
  const [parcialEditando, setParcialEditando] = useState<string | null>(null);
  const [parcialCant, setParcialCant] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const total = items.length;
  const verificados = items.filter(i => i.estado !== 'pendiente').length;
  const pendientes = total - verificados;
  const progreso = total > 0 ? Math.round((verificados / total) * 100) : 0;

  const handleMark = (item: CargaItem, estado: 'cargado' | 'faltante' | 'pendiente', cantidad?: number) => {
    marcar.mutate({
      hojaRutaId,
      productoId: item.producto_id,
      estado,
      cantidadCargada: estado === 'cargado' ? item.cantidad_esperada : cantidad ?? (estado === 'faltante' ? 0 : undefined),
    });
    setParcialEditando(null);
  };

  const handleParcialGuardar = (item: CargaItem) => {
    const cant = Number(parcialCant);
    if (!Number.isFinite(cant) || cant <= 0) return;
    marcar.mutate({
      hojaRutaId,
      productoId: item.producto_id,
      estado: 'parcial',
      cantidadCargada: Math.min(cant, item.cantidad_esperada),
    });
    setParcialEditando(null);
    setParcialCant('');
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (items.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No hay items para verificar</div>;
  }

  return (
    <div className="space-y-3 pb-32">
      {/* Header progreso */}
      <Card className="sticky top-0 z-10 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso de carga</span>
            <Badge variant={pendientes === 0 ? 'default' : 'secondary'}>
              {verificados}/{total} verificados
            </Badge>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      {items.map((item) => {
        const isParcial = parcialEditando === item.id;
        const stateColor =
          item.estado === 'cargado' ? 'border-green-500/50 bg-green-500/5'
          : item.estado === 'parcial' ? 'border-amber-500/50 bg-amber-500/5'
          : item.estado === 'faltante' ? 'border-red-500/50 bg-red-500/5'
          : 'border-border';
        return (
          <Card key={item.id} className={stateColor}>
            <CardContent className="p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">{item.producto?.codigo_articulo}</p>
                  <p className="font-medium text-sm leading-tight">{item.producto?.descripcion}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Esperado</p>
                  <p className="text-lg font-bold">{item.cantidad_esperada}</p>
                </div>
              </div>

              {item.estado !== 'pendiente' && (
                <div className="flex items-center justify-between text-xs">
                  <Badge variant="outline" className="capitalize">
                    {item.estado}{item.cantidad_cargada !== null ? ` · cargado ${item.cantidad_cargada}` : ''}
                  </Badge>
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => handleMark(item, 'pendiente')}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Deshacer
                  </Button>
                </div>
              )}

              {!isParcial && item.estado === 'pendiente' && (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="lg" className="h-12 bg-green-600 hover:bg-green-700"
                    onClick={() => handleMark(item, 'cargado')}
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                  <Button
                    size="lg" variant="outline" className="h-12 border-amber-500 text-amber-700 hover:bg-amber-50"
                    onClick={() => { setParcialEditando(item.id); setParcialCant(''); }}
                  >
                    Parcial
                  </Button>
                  <Button
                    size="lg" variant="outline" className="h-12 border-red-500 text-red-700 hover:bg-red-50"
                    onClick={() => handleMark(item, 'faltante')}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              )}

              {isParcial && (
                <div className="flex gap-2">
                  <Input
                    type="number" inputMode="decimal" min={0} max={item.cantidad_esperada}
                    placeholder={`Máx ${item.cantidad_esperada}`}
                    value={parcialCant}
                    onChange={(e) => setParcialCant(e.target.value)}
                    className="h-12 text-base"
                    autoFocus
                  />
                  <Button className="h-12" onClick={() => handleParcialGuardar(item)}>OK</Button>
                  <Button className="h-12" variant="outline" onClick={() => setParcialEditando(null)}>Cancelar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Footer sticky con confirmar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur p-3 shadow-lg">
        <div className="max-w-md mx-auto">
          {pendientes === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              Todos los items verificados. La carga se confirma automáticamente.
            </div>
          ) : (
            <Button
              className="w-full h-12"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={confirmar.isPending}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Confirmar carga con {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar carga forzada?</AlertDialogTitle>
            <AlertDialogDescription>
              Quedan {pendientes} item{pendientes !== 1 ? 's' : ''} sin verificar. Se marcará la hoja como "carga confirmada" igualmente. Esta acción queda registrada como carga forzada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { confirmar.mutate({ hojaRutaId }); setConfirmOpen(false); }}
            >
              Confirmar igualmente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}