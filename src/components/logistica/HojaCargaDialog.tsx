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
import { getPrintMetaHTML } from '@/lib/printMeta';

interface HojaCargaDialogProps {
  hojaRutaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HojaCargaDialog({ hojaRutaId, open, onOpenChange }: HojaCargaDialogProps) {
  const { data: hojaRuta, isLoading: loadingHoja } = useHojaRuta(hojaRutaId || undefined);
  const { data: productos = [], isLoading: loadingProductos } = useHojaCarga(hojaRutaId || undefined);

  const handlePrint = () => {
    if (!hojaRuta || !productos.length) return;

    const ventana = window.open('', '_blank', 'width=800,height=600');
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.');
      return;
    }

    const fechaFormateada = format(new Date(hojaRuta.fecha), 'dd/MM/yyyy', { locale: es });

    const filasHTML = productos.map((p) => `
      <tr>
        <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; font-family:'Courier New',monospace; font-size:11px; font-weight:700;">${p.codigo}</td>
        <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; font-size:11px; font-weight:700;">${p.descripcion}</td>
        <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; text-align:right; font-size:12px; font-weight:800;">${p.cantidad_total}</td>
        <td style="padding:5px 8px; border-bottom:1px solid #d0d0d0; text-align:center; width:35px;"><div style="width:18px;height:18px;border:1.5px solid #333;margin:auto;"></div></td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hoja de Carga - Ruta #${hojaRuta.numero_hoja}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 10mm; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
            color: #1a1a1a;
            max-width: 780px;
            margin: 0 auto;
            padding: 8px;
          }
          .container {
            border: 2px solid #222;
            border-radius: 3px;
            overflow: hidden;
          }
          .header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #222;
            background: #f5f5f5;
            padding: 8px 12px;
          }
          .header-title {
            flex: 1;
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 1px;
          }
          .header-numero {
            font-size: 16px;
            font-weight: 800;
            font-family: 'Courier New', monospace;
          }
          .info-bar {
            display: flex;
            gap: 16px;
            padding: 6px 12px;
            border-bottom: 1px solid #ccc;
            font-size: 11px;
            flex-wrap: wrap;
          }
          .info-item label {
            font-size: 10px;
            color: #555;
            text-transform: uppercase;
            font-weight: 800;
          }
          .info-item span {
            font-weight: 800;
            color: #000;
            margin-left: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead th {
            background: #222;
            color: #fff;
            padding: 5px 8px;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          thead th.right { text-align: right; }
          thead th.center { text-align: center; }
          tr:nth-child(even) td { background: #f7f7f7; }
          .summary {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            border-top: 2px solid #222;
            background: #eee;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 900;
          }
          .summary span:last-child {
            margin-left: 12px;
            font-size: 16px;
            font-family: 'Courier New', monospace;
          }
          .firmas {
            display: flex;
            justify-content: space-between;
            padding: 40px 30px 20px;
          }
          .firma-block {
            width: 35%;
            text-align: center;
          }
          .firma-dots {
            border-bottom: 1px dotted #666;
            height: 30px;
            margin-bottom: 4px;
          }
          .firma-label {
            font-size: 10px;
            color: #555;
            font-weight: 700;
            text-transform: uppercase;
          }
          .print-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          .print-button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-title">HOJA DE CARGA</div>
            <div class="header-numero">Ruta #${hojaRuta.numero_hoja}</div>
          </div>
          <div class="info-bar">
            <div class="info-item"><label>Fecha:</label><span>${fechaFormateada}</span></div>
            <div class="info-item"><label>Vehículo:</label><span>${hojaRuta.vehiculo?.patente || '-'}</span></div>
            <div class="info-item"><label>Chofer:</label><span>${hojaRuta.chofer?.nombre || '-'}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:100px;">Código</th>
                <th>Descripción</th>
                <th class="right" style="width:70px;">Cantidad</th>
                <th class="center" style="width:40px;">✓</th>
              </tr>
            </thead>
            <tbody>
              ${filasHTML}
            </tbody>
          </table>
          <div class="summary">
            <span>TOTAL PRODUCTOS DISTINTOS:</span>
            <span>${productos.length}</span>
          </div>
        </div>
        <div class="firmas">
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">Responsable de Carga</div></div>
          <div class="firma-block"><div class="firma-dots"></div><div class="firma-label">Chofer</div></div>
        </div>
        ${getPrintMetaHTML()}
        <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir</button>
      </body>
      </html>
    `;

    ventana.document.write(html);
    ventana.document.close();
  };

  if (!hojaRutaId) return null;

  const isLoading = loadingHoja || loadingProductos;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Hoja de Carga
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint}
              disabled={isLoading || !productos.length}
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
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productos.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
              <span className="font-semibold">Total de productos distintos:</span>
              <span className="text-xl font-bold">{productos.length}</span>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
