import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Scale, X, Eye } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';

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

interface ProductSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: Producto[];
  getProductoPrice: (producto: Producto) => number;
  onSelectProduct: (producto: Producto) => void;
}

export function ProductSearchModal({
  open,
  onOpenChange,
  productos,
  getProductoPrice,
  onSelectProduct,
}: ProductSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingProduct, setViewingProduct] = useState<Producto | null>(null);

  const filteredProductos = useMemo(() => {
    if (!searchTerm) return productos;
    const term = searchTerm.toLowerCase();
    return productos.filter(
      (p) =>
        p.codigo_articulo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
    );
  }, [productos, searchTerm]);

  const isProductoPorPeso = (producto: Producto) => {
    const unidad = (producto.unidad_medida || '').toUpperCase().replace('.', '').trim();
    return unidad === 'KG' || unidad === 'KILO' || unidad === 'KILOS';
  };

  const handleSelectProduct = (producto: Producto) => {
    onSelectProduct(producto);
    // No cerramos el modal - el usuario puede seguir agregando productos
  };

  const handleClose = () => {
    setSearchTerm('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Buscar Productos
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar por código o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {filteredProductos.length} productos encontrados
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProductos.map((producto) => {
              const precio = getProductoPrice(producto);
              const esPorPeso = isProductoPorPeso(producto);

              return (
                <div
                  key={producto.id}
                  className="border rounded-lg p-3 hover:bg-accent hover:border-primary cursor-pointer transition-colors flex flex-col relative group"
                  onClick={() => handleSelectProduct(producto)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingProduct(producto);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <div className="flex items-start justify-between gap-1 mb-2 pr-6">
                    <p className="text-xs text-muted-foreground font-mono">
                      {producto.codigo_articulo}
                    </p>
                    {esPorPeso && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Scale className="h-3 w-3 mr-1" />
                        KG
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm line-clamp-2 flex-1 min-h-[2.5rem]">
                    {producto.descripcion}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      Stock: {producto.stock_actual}
                    </span>
                    <span className="font-bold text-primary">
                      ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProductos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No se encontraron productos</p>
              <p className="text-sm">Intente con otro término de búsqueda</p>
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4 flex justify-end">
          <Button onClick={handleClose}>
            Cerrar y volver a la venta
          </Button>
        </div>
      </DialogContent>

      {/* Modal de detalle del producto */}
      <AlertDialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalle del Producto
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="pt-4">
                {viewingProduct && (
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-foreground">Código</TableCell>
                        <TableCell className="font-mono">{viewingProduct.codigo_articulo}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-foreground">Descripción</TableCell>
                        <TableCell>{viewingProduct.descripcion}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-foreground">Precio de Venta</TableCell>
                        <TableCell className="font-bold text-primary">
                          ${getProductoPrice(viewingProduct).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-foreground">Stock Disponible</TableCell>
                        <TableCell>
                          <Badge variant={viewingProduct.stock_actual > 0 ? 'default' : 'destructive'}>
                            {viewingProduct.stock_actual} {viewingProduct.unidad_medida || 'unidades'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-foreground">Unidad de Medida</TableCell>
                        <TableCell>{viewingProduct.unidad_medida || 'Unidad'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-between">
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <Button
              onClick={() => {
                if (viewingProduct) {
                  handleSelectProduct(viewingProduct);
                  setViewingProduct(null);
                }
              }}
            >
              Agregar al carrito
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
