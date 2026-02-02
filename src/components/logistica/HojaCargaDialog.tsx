import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHojaRuta, useHojaCarga } from '@/hooks/useLogistica';
import { Printer, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HojaCargaDialogProps {
  hojaRutaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HojaCargaDialog({ hojaRutaId, open, onOpenChange }: HojaCargaDialogProps) {
  const { data: hojaRuta, isLoading: loadingHoja } = useHojaRuta(hojaRutaId || undefined);
  const { data: productos = [], isLoading: loadingProductos } = useHojaCarga(hojaRutaId || undefined);

  const handlePrint = () => {
    window.print();
  };

  if (!hojaRutaId) return null;

  const isLoading = loadingHoja || loadingProductos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none">
        <DialogHeader className="print:mb-4">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Hoja de Carga
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Lista de productos a cargar para la hoja de ruta
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : hojaRuta ? (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg print:bg-transparent print:border print:border-foreground">
              <div>
                <p className="text-sm text-muted-foreground">Hoja de Ruta</p>
                <p className="font-semibold">#{hojaRuta.numero_hoja}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-semibold">
                  {format(new Date(hojaRuta.fecha), 'dd/MM/yyyy', { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vehículo</p>
                <p className="font-semibold">
                  {hojaRuta.vehiculo?.patente || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chofer</p>
                <p className="font-semibold">
                  {hojaRuta.chofer?.nombre || '-'}
                </p>
              </div>
            </div>

            {/* Products table */}
            <div>
              <h3 className="font-semibold mb-2">Productos a Cargar</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right w-24">Cantidad</TableHead>
                    <TableHead className="w-24 print:block hidden">✓</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No hay productos para cargar
                      </TableCell>
                    </TableRow>
                  ) : (
                    productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell className="font-mono">{producto.codigo}</TableCell>
                        <TableCell>{producto.descripcion}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {producto.cantidad_total}
                        </TableCell>
                        <TableCell className="print:block hidden">
                          <div className="w-6 h-6 border border-foreground" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg print:bg-transparent print:border print:border-foreground">
              <span className="font-semibold">Total de productos distintos:</span>
              <span className="text-xl font-bold">{productos.length}</span>
            </div>

            {/* Signatures for print */}
            <div className="hidden print:grid print:grid-cols-2 print:gap-8 print:mt-12">
              <div className="text-center">
                <div className="border-t border-foreground pt-2 mt-16">
                  Firma del Responsable de Carga
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-foreground pt-2 mt-16">
                  Firma del Chofer
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
