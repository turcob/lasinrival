import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useHojaRuta, useHojaCarga } from '@/hooks/useLogistica';
import { Printer, Package, Loader2 } from 'lucide-react';
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto print:max-w-none">
        <SheetHeader className="print:mb-4">
          <SheetTitle className="flex items-center justify-between">
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
          </SheetTitle>
          <SheetDescription>
            Lista de productos a cargar para la hoja de ruta
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : hojaRuta ? (
          <div className="space-y-6 mt-6">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg print:bg-transparent print:border print:border-foreground">
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
            <div className="space-y-2">
              <h3 className="font-semibold">Productos a Cargar</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Código</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Descripción</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">Cantidad</th>
                      <th className="px-4 py-2 w-12 print:block hidden">✓</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No hay productos para cargar
                        </td>
                      </tr>
                    ) : (
                      productos.map((producto) => (
                        <tr key={producto.id}>
                          <td className="px-4 py-2 font-mono text-sm">{producto.codigo}</td>
                          <td className="px-4 py-2 text-sm">{producto.descripcion}</td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {producto.cantidad_total}
                          </td>
                          <td className="px-4 py-2 print:block hidden">
                            <div className="w-5 h-5 border border-foreground" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg print:bg-transparent print:border print:border-foreground">
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
      </SheetContent>
    </Sheet>
  );
}
