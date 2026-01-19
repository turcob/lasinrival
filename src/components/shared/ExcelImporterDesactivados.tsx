import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { FileX, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, MinusCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ImportResult {
  created: number;
  updated: number;
  deactivated: number;
  errors: { row: number; message: string }[];
}

export function ExcelImporterDesactivados({ onImportComplete }: { onImportComplete?: () => void }) {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePrice = (value: any): number => {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined || value === '') return 0;
    
    let priceStr = String(value).trim().toLowerCase();
    
    // Handle special values like "elimin", "eliminado", etc.
    if (priceStr === 'elimin' || priceStr === 'eliminado' || priceStr === '-' || priceStr === 'n/a') {
      return 0;
    }
    
    // Remove currency symbols, spaces, and other non-numeric chars except . and ,
    priceStr = priceStr.replace(/[^\d.,\-]/g, '').trim();
    
    if (!priceStr) return 0;
    
    // Detect format based on last separator
    const lastComma = priceStr.lastIndexOf(',');
    const lastDot = priceStr.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Spanish/European format: comma is decimal separator
      priceStr = priceStr.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      // US/English format: dot is decimal separator
      priceStr = priceStr.replace(/,/g, '');
    }
    
    const result = parseFloat(priceStr);
    return isNaN(result) ? 0 : result;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const importResults: ImportResult = {
        created: 0,
        updated: 0,
        deactivated: 0,
        errors: [],
      };

      // Find sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];

      if (rows.length === 0) {
        toast.error('El archivo está vacío');
        setImporting(false);
        return;
      }

      const totalRows = rows.length;

      // Fetch existing data
      const [existingProductos, existingSubcategorias, existingCategorias] = await Promise.all([
        supabase.from('productos').select('id, codigo_articulo, activo'),
        supabase.from('subcategorias').select('id, nombre'),
        supabase.from('categorias').select('id, nombre'),
      ]);

      const productosMap = new Map<string, { id: string; activo: boolean }>();
      existingProductos.data?.forEach((p) => 
        productosMap.set(p.codigo_articulo, { id: p.id, activo: p.activo })
      );

      // Map subcategories by normalized name for lookup
      const subcategoriasByNameMap = new Map<string, string>();
      existingSubcategorias.data?.forEach((s) => {
        if (s.nombre) {
          subcategoriasByNameMap.set(s.nombre.toUpperCase().trim(), s.id);
        }
      });

      // Map categories by normalized name for lookup
      const categoriasByNameMap = new Map<string, string>();
      existingCategorias.data?.forEach((c) => {
        if (c.nombre) {
          categoriasByNameMap.set(c.nombre.toUpperCase().trim(), c.id);
        }
      });

      // Process rows
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setProgress(Math.round(((i + 1) / totalRows) * 100));

        // Normalize row keys by trimming spaces
        const normalizedRow: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          normalizedRow[key.trim()] = row[key];
        }

        // Map columns from the specific format
        const codigoArticulo = String(
          normalizedRow['Cód. Artículo'] || 
          normalizedRow['Cod. Articulo'] || 
          normalizedRow['CODIGO'] || 
          normalizedRow['codigo_articulo'] || 
          ''
        ).trim();

        const descripcion = String(
          normalizedRow['Descripción'] || 
          normalizedRow['Descripcion'] || 
          normalizedRow['DESCRIPCION'] || 
          ''
        ).trim();

        const categoriaNombre = String(
          normalizedRow['Familia'] || 
          normalizedRow['FAMILIA'] || 
          normalizedRow['CATEGORIA'] || 
          ''
        ).trim().toUpperCase();

        const subcategoriaNombre = String(
          normalizedRow['Desc. agrupación'] || 
          normalizedRow['Desc. agrupacion'] || 
          normalizedRow['SUBCATEGORIA'] || 
          ''
        ).trim().toUpperCase();

        const codigoBarra = String(
          normalizedRow['Código de Barras'] || 
          normalizedRow['Codigo de Barras'] || 
          normalizedRow['CODIGO_BARRA'] || 
          ''
        ).trim() || null;

        const precioCosto = parsePrice(
          normalizedRow['Costo'] || 
          normalizedRow['COSTO'] || 
          normalizedRow['precio_costo'] || 
          0
        );

        if (!codigoArticulo) {
          importResults.errors.push({ row: i + 2, message: 'Código de artículo vacío' });
          continue;
        }

        if (!descripcion) {
          importResults.errors.push({ row: i + 2, message: `Producto ${codigoArticulo}: descripción vacía` });
          continue;
        }

        // Look up categoria and subcategoria by name
        const categoriaId = categoriaNombre ? categoriasByNameMap.get(categoriaNombre) : null;
        const subcategoriaId = subcategoriaNombre ? subcategoriasByNameMap.get(subcategoriaNombre) : null;

        const existingProduct = productosMap.get(codigoArticulo);

        if (!existingProduct) {
          // Create new product as deactivated
          try {
            const { error } = await supabase.from('productos').insert([{
              codigo_articulo: codigoArticulo,
              descripcion: descripcion,
              codigo_barra: codigoBarra,
              precio_costo: precioCosto,
              categoria_id: categoriaId || null,
              subcategoria_id: subcategoriaId || null,
              activo: false,
              desactivado_por: user?.id || null,
              fecha_desactivacion: new Date().toISOString(),
            }]);

            if (error) throw error;
            importResults.created++;
          } catch (error: any) {
            if (!error.message?.includes('duplicate')) {
              importResults.errors.push({ row: i + 2, message: `${codigoArticulo}: ${error.message}` });
            }
          }
        } else {
          // Update existing product
          try {
            const updateData: any = {
              descripcion: descripcion,
              precio_costo: precioCosto,
            };

            if (codigoBarra) {
              updateData.codigo_barra = codigoBarra;
            }

            if (categoriaId) {
              updateData.categoria_id = categoriaId;
            }

            if (subcategoriaId) {
              updateData.subcategoria_id = subcategoriaId;
            }

            // If product was active, deactivate it
            if (existingProduct.activo) {
              updateData.activo = false;
              updateData.desactivado_por = user?.id || null;
              updateData.fecha_desactivacion = new Date().toISOString();
              importResults.deactivated++;
            }

            const { error } = await supabase
              .from('productos')
              .update(updateData)
              .eq('id', existingProduct.id);

            if (error) throw error;
            importResults.updated++;
          } catch (error: any) {
            importResults.errors.push({ row: i + 2, message: `${codigoArticulo}: ${error.message}` });
          }
        }
      }

      setResults(importResults);
      toast.success('Importación completada');
      onImportComplete?.();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Error al procesar el archivo');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setResults(null);
    setProgress(0);
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileUpload}
      />
      
      <Button variant="outline" onClick={() => setDialogOpen(true)}>
        <FileX className="mr-2 h-4 w-4" />
        Importar Desactivados
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Productos Desactivados
            </DialogTitle>
            <DialogDescription>
              Importa productos bloqueados/inhabilitados desde un archivo Excel.
              Los productos se crearán o actualizarán con estado <strong>desactivado</strong>.
            </DialogDescription>
          </DialogHeader>

          {!importing && !results && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <h4 className="text-sm font-medium mb-2">Columnas esperadas:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Cód. Artículo</strong> - Código del producto (requerido)</li>
                  <li>• <strong>Descripción</strong> - Nombre del producto (requerido)</li>
                  <li>• <strong>Familia</strong> - Categoría (por nombre)</li>
                  <li>• <strong>Desc. agrupación</strong> - Subcategoría (por nombre)</li>
                  <li>• <strong>Código de Barras</strong> - Código EAN/UPC (opcional)</li>
                  <li>• <strong>Costo</strong> - Precio de costo (0 si es "elimin")</li>
                </ul>
              </div>

              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Comportamiento de importación:
                </h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• Productos nuevos → Se crean <strong>desactivados</strong></li>
                  <li>• Productos activos → Se <strong>desactivan</strong> y actualizan</li>
                  <li>• Productos ya desactivados → Solo se actualizan datos</li>
                </ul>
              </div>

              <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Seleccionar Archivo Excel
              </Button>
            </div>
          )}

          {importing && (
            <div className="space-y-4 py-4">
              <div className="text-center text-sm text-muted-foreground">
                Procesando archivo...
              </div>
              <Progress value={progress} className="w-full" />
              <div className="text-center text-sm font-medium">{progress}%</div>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 p-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-lg font-bold text-green-700 dark:text-green-400">
                      {results.created}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-500">Creados</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-3">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                      {results.updated}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-500">Actualizados</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
                  <MinusCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                      {results.deactivated}
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-500">Desactivados</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/30 p-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="text-lg font-bold text-red-700 dark:text-red-400">
                      {results.errors.length}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-500">Errores</div>
                  </div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="rounded-md border border-destructive/50 p-3">
                  <h4 className="text-sm font-medium text-destructive mb-2">
                    Errores encontrados:
                  </h4>
                  <ScrollArea className="h-32">
                    <ul className="text-sm space-y-1">
                      {results.errors.map((error, idx) => (
                        <li key={idx} className="text-muted-foreground">
                          Fila {error.row}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              <Button onClick={handleClose} className="w-full">
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
