import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  success: number;
  errors: { row: number; message: string }[];
}

export function ExcelImporter() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    categorias: ImportResult;
    subcategorias: ImportResult;
    productos: ImportResult;
    precios: ImportResult;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const importResults = {
        categorias: { success: 0, errors: [] as { row: number; message: string }[] },
        subcategorias: { success: 0, errors: [] as { row: number; message: string }[] },
        productos: { success: 0, errors: [] as { row: number; message: string }[] },
        precios: { success: 0, errors: [] as { row: number; message: string }[] },
      };

      // Get or create default price lists
      let listaPrecio1Id: string;
      let listaPrecio2Id: string;

      const { data: listas } = await supabase.from('listas_precios').select('id, nombre');

      const lista1 = listas?.find((l) => l.nombre === 'Precio 1');
      const lista2 = listas?.find((l) => l.nombre === 'Precio 2');

      if (lista1) {
        listaPrecio1Id = lista1.id;
      } else {
        const { data } = await supabase.from('listas_precios').insert([{ nombre: 'Precio 1' }]).select().single();
        listaPrecio1Id = data!.id;
      }

      if (lista2) {
        listaPrecio2Id = lista2.id;
      } else {
        const { data } = await supabase.from('listas_precios').insert([{ nombre: 'Precio 2' }]).select().single();
        listaPrecio2Id = data!.id;
      }

      // Find sheet (try different names)
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];

      if (rows.length === 0) {
        toast.error('El archivo está vacío');
        setImporting(false);
        return;
      }

      const totalRows = rows.length;
      const categoriasMap = new Map<string, string>();
      const subcategoriasMap = new Map<string, string>();

      // Fetch existing data
      const { data: existingCategorias } = await supabase.from('categorias').select('id, codigo_familia');
      const { data: existingSubcategorias } = await supabase.from('subcategorias').select('id, codigo_grupo, categoria_id');
      const { data: existingProductos } = await supabase.from('productos').select('id, codigo_articulo');

      existingCategorias?.forEach((c) => categoriasMap.set(c.codigo_familia, c.id));
      existingSubcategorias?.forEach((s) => subcategoriasMap.set(`${s.categoria_id}-${s.codigo_grupo}`, s.id));

      const productosMap = new Map<string, string>();
      existingProductos?.forEach((p) => productosMap.set(p.codigo_articulo, p.id));

      // Process rows
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setProgress(Math.round(((i + 1) / totalRows) * 100));

        // Get column values (support different column names)
        const codigoFamilia = String(row.FAMILIA || row.COD_FAM || row.codigo_familia || '').trim();
        const nombreFamilia = String(row.NOM_FAM || row.nombre_familia || row.FAMILIA_NOMBRE || '').trim();
        const codigoGrupo = String(row.GRUPO || row.COD_GRU || row.codigo_grupo || '').trim();
        const nombreGrupo = String(row.NOM_GRU || row.nombre_grupo || row.GRUPO_NOMBRE || '').trim();
        const codigoArticulo = String(row.COD_ARTIC || row.codigo_articulo || row.CODIGO || '').trim();
        const descripcion = String(row.DESCRIP || row.descripcion || row.DESCRIPCION || '').trim();
        const unidadMedida = String(row.UNIDAD_MED || row.unidad_medida || row.UNIDAD || 'UN').trim();
        const precio1 = parseFloat(row.PRECIO_1 || row.precio_1 || row.PRECIO1 || 0);
        const precio2 = parseFloat(row.PRECIO_2 || row.precio_2 || row.PRECIO2 || 0);

        // Import categoria
        if (codigoFamilia && nombreFamilia && !categoriasMap.has(codigoFamilia)) {
          try {
            const { data, error } = await supabase
              .from('categorias')
              .insert([{ codigo_familia: codigoFamilia, nombre: nombreFamilia }])
              .select()
              .single();

            if (error) throw error;
            categoriasMap.set(codigoFamilia, data.id);
            importResults.categorias.success++;
          } catch (error: any) {
            if (!error.message?.includes('duplicate')) {
              importResults.categorias.errors.push({ row: i + 2, message: error.message });
            }
          }
        }

        // Import subcategoria
        const categoriaId = categoriasMap.get(codigoFamilia);
        if (codigoGrupo && nombreGrupo && categoriaId) {
          const subKey = `${categoriaId}-${codigoGrupo}`;
          if (!subcategoriasMap.has(subKey)) {
            try {
              const { data, error } = await supabase
                .from('subcategorias')
                .insert([{ 
                  codigo_grupo: codigoGrupo, 
                  nombre: nombreGrupo, 
                  categoria_id: categoriaId 
                }])
                .select()
                .single();

              if (error) throw error;
              subcategoriasMap.set(subKey, data.id);
              importResults.subcategorias.success++;
            } catch (error: any) {
              if (!error.message?.includes('duplicate')) {
                importResults.subcategorias.errors.push({ row: i + 2, message: error.message });
              }
            }
          }
        }

        // Import producto
        if (codigoArticulo && descripcion) {
          const subcategoriaId = categoriaId ? subcategoriasMap.get(`${categoriaId}-${codigoGrupo}`) : null;

          if (!productosMap.has(codigoArticulo)) {
            try {
              const { data, error } = await supabase
                .from('productos')
                .insert([{
                  codigo_articulo: codigoArticulo,
                  descripcion: descripcion,
                  unidad_medida: unidadMedida || 'UN',
                  categoria_id: categoriaId || null,
                  subcategoria_id: subcategoriaId || null,
                }])
                .select()
                .single();

              if (error) throw error;
              productosMap.set(codigoArticulo, data.id);
              importResults.productos.success++;

              // Import precios for new product
              if (precio1 > 0) {
                await supabase.from('precios_productos').insert([{
                  producto_id: data.id,
                  lista_precio_id: listaPrecio1Id,
                  precio: precio1,
                }]);
                importResults.precios.success++;
              }
              if (precio2 > 0) {
                await supabase.from('precios_productos').insert([{
                  producto_id: data.id,
                  lista_precio_id: listaPrecio2Id,
                  precio: precio2,
                }]);
                importResults.precios.success++;
              }
            } catch (error: any) {
              if (!error.message?.includes('duplicate')) {
                importResults.productos.errors.push({ row: i + 2, message: error.message });
              }
            }
          } else {
            // Update existing product prices
            const productoId = productosMap.get(codigoArticulo)!;
            if (precio1 > 0) {
              await supabase.from('precios_productos').upsert([{
                producto_id: productoId,
                lista_precio_id: listaPrecio1Id,
                precio: precio1,
              }], { onConflict: 'producto_id,lista_precio_id' });
            }
            if (precio2 > 0) {
              await supabase.from('precios_productos').upsert([{
                producto_id: productoId,
                lista_precio_id: listaPrecio2Id,
                precio: precio2,
              }], { onConflict: 'producto_id,lista_precio_id' });
            }
          }
        }
      }

      setResults(importResults);
      toast.success('Importación completada');
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

  const totalSuccess = results
    ? results.categorias.success + results.subcategorias.success + results.productos.success + results.precios.success
    : 0;

  const totalErrors = results
    ? results.categorias.errors.length + results.subcategorias.errors.length + results.productos.errors.length + results.precios.errors.length
    : 0;

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
        <Upload className="mr-2 h-4 w-4" />
        Importar Excel
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar desde Excel
            </DialogTitle>
            <DialogDescription>
              Importe categorías, subcategorías, productos y precios desde un archivo Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!importing && !results && (
              <>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    El archivo debe contener las siguientes columnas:
                  </p>
                  <div className="text-xs text-left bg-muted p-3 rounded font-mono">
                    <p>FAMILIA, NOM_FAM (categorías)</p>
                    <p>GRUPO, NOM_GRU (subcategorías)</p>
                    <p>COD_ARTIC, DESCRIP, UNIDAD_MED (productos)</p>
                    <p>PRECIO_1, PRECIO_2 (precios)</p>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar Archivo
                </Button>
              </>
            )}

            {importing && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Importando datos...</p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm font-medium mt-2">{progress}%</p>
                </div>
              </div>
            )}

            {results && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-success">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{totalSuccess}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Importados</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{totalErrors}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Errores</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-muted rounded">
                    <p className="text-sm font-medium">Categorías</p>
                    <p className="text-xs text-muted-foreground">
                      {results.categorias.success} importadas
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <p className="text-sm font-medium">Subcategorías</p>
                    <p className="text-xs text-muted-foreground">
                      {results.subcategorias.success} importadas
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <p className="text-sm font-medium">Productos</p>
                    <p className="text-xs text-muted-foreground">
                      {results.productos.success} importados
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <p className="text-sm font-medium">Precios</p>
                    <p className="text-xs text-muted-foreground">
                      {results.precios.success} importados
                    </p>
                  </div>
                </div>

                {totalErrors > 0 && (
                  <ScrollArea className="h-32 border rounded p-2">
                    {[...results.categorias.errors, ...results.subcategorias.errors, ...results.productos.errors, ...results.precios.errors].map((error, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs py-1">
                        <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        <span>
                          Fila {error.row}: {error.message}
                        </span>
                      </div>
                    ))}
                  </ScrollArea>
                )}

                <Button 
                  className="w-full" 
                  onClick={() => {
                    setResults(null);
                    setDialogOpen(false);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
