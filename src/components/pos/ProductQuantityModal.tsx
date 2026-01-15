import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Scale, Plus, Minus, ShoppingCart } from 'lucide-react';

interface Producto {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  stock_actual: number;
  unidad_medida: string;
  precio_costo: number;
  marca_id?: string | null;
  tipo_producto_id?: string | null;
}

interface ProductQuantityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: Producto | null;
  precio: number;
  onConfirm: (producto: Producto, cantidad: number) => void;
}

export function ProductQuantityModal({
  open,
  onOpenChange,
  producto,
  precio,
  onConfirm,
}: ProductQuantityModalProps) {
  const [cantidad, setCantidad] = useState('1');

  const isProductoPorPeso = (prod: Producto | null) => {
    if (!prod) return false;
    const unidad = (prod.unidad_medida || '').toUpperCase().replace('.', '').trim();
    return unidad === 'KG' || unidad === 'KILO' || unidad === 'KILOS';
  };

  const esPorPeso = isProductoPorPeso(producto);

  useEffect(() => {
    if (open) {
      setCantidad(esPorPeso ? '1,000' : '1');
    }
  }, [open, esPorPeso]);

  const handleConfirm = () => {
    if (!producto) return;
    
    const cantidadNormalizada = cantidad.replace(',', '.');
    const cantidadNum = parseFloat(cantidadNormalizada);
    
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      return;
    }

    onConfirm(producto, cantidadNum);
    onOpenChange(false);
  };

  const handleIncrement = () => {
    const cantidadNormalizada = cantidad.replace(',', '.');
    const cantidadNum = parseFloat(cantidadNormalizada) || 0;
    if (esPorPeso) {
      setCantidad((cantidadNum + 0.1).toFixed(3).replace('.', ','));
    } else {
      setCantidad((Math.floor(cantidadNum) + 1).toString());
    }
  };

  const handleDecrement = () => {
    const cantidadNormalizada = cantidad.replace(',', '.');
    const cantidadNum = parseFloat(cantidadNormalizada) || 0;
    if (esPorPeso) {
      const newVal = Math.max(0.001, cantidadNum - 0.1);
      setCantidad(newVal.toFixed(3).replace('.', ','));
    } else {
      const newVal = Math.max(1, Math.floor(cantidadNum) - 1);
      setCantidad(newVal.toString());
    }
  };

  const getSubtotal = () => {
    const cantidadNormalizada = cantidad.replace(',', '.');
    const cantidadNum = parseFloat(cantidadNormalizada) || 0;
    return precio * cantidadNum;
  };

  if (!producto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Agregar al pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-xs text-muted-foreground font-mono">
                {producto.codigo_articulo}
              </p>
              {esPorPeso && (
                <Badge variant="outline" className="text-xs">
                  <Scale className="h-3 w-3 mr-1" />
                  Por peso
                </Badge>
              )}
            </div>
            <p className="font-medium">{producto.descripcion}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Stock disponible: {producto.stock_actual} {producto.unidad_medida}
            </p>
            <p className="text-lg font-bold text-primary mt-2">
              ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              {esPorPeso && <span className="text-sm font-normal text-muted-foreground"> / kg</span>}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cantidad">
              {esPorPeso ? 'Peso (kg)' : 'Cantidad'}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleDecrement}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="cantidad"
                className="text-center text-lg font-medium"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirm();
                  }
                }}
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleIncrement}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
            <span className="font-medium">Subtotal:</span>
            <span className="text-xl font-bold">
              ${getSubtotal().toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar al pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
