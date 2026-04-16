import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegistrarDevolucion, type DevolucionMotivo } from '@/hooks/useLogistica';
import { PackageX, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MOTIVOS_DEVOLUCION: { value: DevolucionMotivo; label: string }[] = [
  { value: 'rechazo_cliente', label: 'Rechazo del cliente' },
  { value: 'producto_vencido', label: 'Producto vencido' },
  { value: 'producto_roto', label: 'Producto dañado/roto' },
  { value: 'producto_faltante', label: 'Producto faltante' },
  { value: 'cambio', label: 'Cambio por otro producto' },
  { value: 'error_pedido', label: 'Error en el pedido' },
  { value: 'otro', label: 'Otro motivo' },
];

interface ProductoDevolucion {
  detalle_id: string;
  producto_id: string | null;
  codigo: string;
  descripcion: string;
  cantidad_pedida: number;
  cantidad_entregada: number | null;
  cantidad_devolver: number;
  motivo: DevolucionMotivo | '';
  detalle_motivo: string;
  reingresarStock: boolean;
}

interface RegistrarDevolucionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRutaId: string;
  paradaId: string;
  pedidoDetalles: Array<{
    id: string;
    producto_id: string | null;
    cantidad_pedida: number;
    cantidad_entregada: number | null;
    producto?: { descripcion: string; codigo_articulo: string };
  }>;
  onSuccess?: () => void;
}

export function RegistrarDevolucionDialog({
  open,
  onOpenChange,
  hojaRutaId,
  paradaId,
  pedidoDetalles,
  onSuccess,
}: RegistrarDevolucionDialogProps) {
  const { toast } = useToast();
  const registrarDevolucion = useRegistrarDevolucion();
  
  const [productos, setProductos] = useState<ProductoDevolucion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar productos cuando se abre el diálogo
  useEffect(() => {
    if (open && pedidoDetalles) {
      setProductos(
        pedidoDetalles.map((d) => ({
          detalle_id: d.id,
          producto_id: d.producto_id,
          codigo: d.producto?.codigo_articulo || '-',
          descripcion: d.producto?.descripcion || 'Producto sin nombre',
          cantidad_pedida: d.cantidad_pedida,
          cantidad_entregada: d.cantidad_entregada,
          cantidad_devolver: 0,
          motivo: '',
          detalle_motivo: '',
          reingresarStock: true,
        }))
      );
    }
  }, [open, pedidoDetalles]);

  const handleCantidadChange = (index: number, value: string) => {
    const cantidad = Math.max(0, parseInt(value) || 0);
    const maxCantidad = productos[index].cantidad_pedida;
    
    setProductos((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, cantidad_devolver: Math.min(cantidad, maxCantidad) }
          : p
      )
    );
  };

  const handleMotivoChange = (index: number, motivo: DevolucionMotivo) => {
    setProductos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, motivo } : p))
    );
  };

  const handleDetalleChange = (index: number, detalle: string) => {
    setProductos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, detalle_motivo: detalle } : p))
    );
  };

  const handleReingresarStockChange = (index: number, checked: boolean) => {
    setProductos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, reingresarStock: checked } : p))
    );
  };

  const productosConDevolucion = productos.filter((p) => p.cantidad_devolver > 0);

  const handleSubmit = async () => {
    const sinMotivo = productosConDevolucion.filter((p) => !p.motivo);
    if (sinMotivo.length > 0) {
      toast({
        title: 'Datos incompletos',
        description: 'Seleccione un motivo para cada producto rechazado',
        variant: 'destructive',
      });
      return;
    }

    if (productosConDevolucion.length === 0) {
      toast({
        title: 'Sin productos',
        description: 'Ingrese al menos un producto a rechazar',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      for (const producto of productosConDevolucion) {
        await registrarDevolucion.mutateAsync({
          hoja_ruta_id: hojaRutaId,
          parada_id: paradaId,
          pedido_detalle_id: producto.detalle_id,
          cantidad: producto.cantidad_devolver,
          motivo: producto.motivo as DevolucionMotivo,
          detalle_motivo: producto.detalle_motivo || undefined,
          reingresarStock: producto.reingresarStock,
        });
      }

      toast({
        title: 'Rechazos registrados',
        description: `${productosConDevolucion.length} producto(s) rechazado(s). NC pendiente de aprobación.`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error registrando rechazos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron registrar los rechazos',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalProductosDevueltos = productosConDevolucion.reduce(
    (sum, p) => sum + p.cantidad_devolver,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-destructive" />
            Registrar Rechazo de Mercadería
          </DialogTitle>
          <DialogDescription>
            Indique qué productos fueron rechazados por el cliente. Se generará una Nota de Crédito en estado pendiente
            que administración deberá aprobar para hacerla efectiva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {productos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay productos en este pedido
            </div>
          ) : (
            productos.map((producto, index) => (
              <div
                key={producto.detalle_id}
                className={`border rounded-lg p-4 space-y-3 ${
                  producto.cantidad_devolver > 0
                    ? 'border-amber-500 bg-amber-500/10'
                    : ''
                }`}
              >
                {/* Header del producto */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {producto.codigo}
                    </span>
                    <p className="font-medium">{producto.descripcion}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Pedido</p>
                    <p className="font-bold">{producto.cantidad_pedida} un.</p>
                  </div>
                </div>

                {/* Cantidad a rechazar */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Cantidad a rechazar</Label>
                    <Input
                      type="number"
                      min="0"
                      max={producto.cantidad_pedida}
                      value={producto.cantidad_devolver}
                      onChange={(e) => handleCantidadChange(index, e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  {producto.cantidad_devolver > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Motivo *</Label>
                      <Select
                        value={producto.motivo}
                        onValueChange={(v) => handleMotivoChange(index, v as DevolucionMotivo)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOTIVOS_DEVOLUCION.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Campos adicionales cuando hay rechazo */}
                {producto.cantidad_devolver > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm">Detalle adicional (opcional)</Label>
                      <Textarea
                        placeholder="Describir el motivo del rechazo..."
                        value={producto.detalle_motivo}
                        onChange={(e) => handleDetalleChange(index, e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                        id={`reingresar-${index}`}
                        checked={producto.reingresarStock}
                        onCheckedChange={(checked) =>
                          handleReingresarStockChange(index, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`reingresar-${index}`}
                        className="text-sm cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Sugerir reingreso al stock (admin decide al aprobar)
                      </Label>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Resumen */}
        {productosConDevolucion.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="text-sm">
              <span className="font-medium">
                {productosConDevolucion.length} producto(s) a rechazar
              </span>
              <span className="text-muted-foreground ml-2">
                ({totalProductosDevueltos} unidades en total)
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={productosConDevolucion.length === 0 || isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Rechazos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
