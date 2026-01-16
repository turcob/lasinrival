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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  success: number;
  updated: number;
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
    marcas: ImportResult;
    tiposProducto: ImportResult;
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
        categorias: { success: 0, updated: 0, errors: [] as { row: number; message: string }[] },
        subcategorias: { success: 0, updated: 0, errors: [] as { row: number; message: string }[] },
        productos: { success: 0, updated: 0, errors: [] as { row: number; message: string }[] },
        marcas: { success: 0, updated: 0, errors: [] as { row: number; message: string }[] },
        tiposProducto: { success: 0, updated: 0, errors: [] as { row: number; message: string }[] },
      };

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
      const marcasMap = new Map<string, string>();
      const tiposProductoMap = new Map<string, string>();

      // Fetch existing data
      const [existingCategorias, existingSubcategorias, existingProductos, existingMarcas, existingTipos] = await Promise.all([
        supabase.from('categorias').select('id, codigo_familia'),
        supabase.from('subcategorias').select('id, codigo_grupo, categoria_id'),
        supabase.from('productos').select('id, codigo_articulo'),
        supabase.from('marcas').select('id, nombre'),
        supabase.from('tipos_producto').select('id, nombre'),
      ]);

      existingCategorias.data?.forEach((c) => categoriasMap.set(c.codigo_familia, c.id));
      existingSubcategorias.data?.forEach((s) => subcategoriasMap.set(`${s.categoria_id}-${s.codigo_grupo}`, s.id));
      existingMarcas.data?.forEach((m) => marcasMap.set(m.nombre.toUpperCase(), m.id));
      existingTipos.data?.forEach((t) => tiposProductoMap.set(t.nombre.toUpperCase(), t.id));

      const productosMap = new Map<string, string>();
      existingProductos.data?.forEach((p) => productosMap.set(p.codigo_articulo, p.id));

      // First pass: collect unique marcas and tipos from Excel
      const uniqueMarcas = new Set<string>();
      const uniqueTipos = new Set<string>();

      for (const row of rows) {
        const marcaNombre = String(row['MARCA ID'] || row.MARCA || row.marca || '').trim().toUpperCase();
        const tipoNombre = String(row.ID || row.TIPO || row.tipo_producto || '').trim().toUpperCase();
        
        if (marcaNombre && !marcasMap.has(marcaNombre)) {
          uniqueMarcas.add(marcaNombre);
        }
        if (tipoNombre && !tiposProductoMap.has(tipoNombre)) {
          uniqueTipos.add(tipoNombre);
        }
      }

      // Create new marcas
      for (const marcaNombre of uniqueMarcas) {
        try {
          const { data, error } = await supabase
            .from('marcas')
            .insert([{ nombre: marcaNombre }])
            .select()
            .single();

          if (error) {
            if (!error.message?.includes('duplicate')) {
              importResults.marcas.errors.push({ row: 0, message: `Marca ${marcaNombre}: ${error.message}` });
            }
          } else {
            marcasMap.set(marcaNombre, data.id);
            importResults.marcas.success++;
          }
        } catch (error: any) {
          if (!error.message?.includes('duplicate')) {
            importResults.marcas.errors.push({ row: 0, message: error.message });
          }
        }
      }

      // Create new tipos de producto
      for (const tipoNombre of uniqueTipos) {
        try {
          const { data, error } = await supabase
            .from('tipos_producto')
            .insert([{ nombre: tipoNombre }])
            .select()
            .single();

          if (error) {
            if (!error.message?.includes('duplicate')) {
              importResults.tiposProducto.errors.push({ row: 0, message: `Tipo ${tipoNombre}: ${error.message}` });
            }
          } else {
            tiposProductoMap.set(tipoNombre, data.id);
            importResults.tiposProducto.success++;
          }
        } catch (error: any) {
          if (!error.message?.includes('duplicate')) {
            importResults.tiposProducto.errors.push({ row: 0, message: error.message });
          }
        }
      }

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
        // Helper function to parse price with currency format
        const parsePrice = (value: any): number => {
          if (typeof value === 'number') return value;
          if (value === null || value === undefined || value === '') return 0;
          
          let priceStr = String(value).trim();
          
          // Remove currency symbols, spaces, and other non-numeric chars except . and ,
          priceStr = priceStr.replace(/[^\d.,\-]/g, '').trim();
          
          if (!priceStr) return 0;
          
          // Detect format based on last separator
          const lastComma = priceStr.lastIndexOf(',');
          const lastDot = priceStr.lastIndexOf('.');
          
          if (lastComma > lastDot) {
            // Spanish/European format: comma is decimal separator (e.g., "1.234,56" or "1234,56")
            priceStr = priceStr.replace(/\./g, '').replace(',', '.');
          } else if (lastDot > lastComma) {
            // US/English format: dot is decimal separator (e.g., "1,234.56" or "1234.56")
            priceStr = priceStr.replace(/,/g, '');
          } else if (lastComma === -1 && lastDot === -1) {
            // No separator, just digits
            // priceStr stays as is
          }
          
          const result = parseFloat(priceStr);
          return isNaN(result) ? 0 : result;
        };
        
        // Try multiple column names for price
        const priceValue = row.PRECIO_1 ?? row.PRECIO ?? row.PRECIO_COSTO ?? row.precio_costo ?? row.COSTO ?? row.Precio ?? row.precio ?? 0;
        const precioCosto = parsePrice(priceValue);
        
        // Debug logging for specific products
        if (codigoArticulo === '03006005' || codigoArticulo === '0300100') {
          console.log(`[DEBUG] Producto ${codigoArticulo}: priceValue=${JSON.stringify(priceValue)}, precioCosto=${precioCosto}, row keys:`, Object.keys(row));
        }
        
        // New columns
        const marcaNombre = String(row['MARCA ID'] || row.MARCA || row.marca || '').trim().toUpperCase();
        const tipoNombre = String(row.ID || row.TIPO || row.tipo_producto || '').trim().toUpperCase();
        const cantidadPorEmpaque = parseInt(row['CANTIDAD POR EMPAQUE'] || row.CANT_EMPAQUE || row.cantidad_empaque || 1) || 1;

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

        // Get marca_id and tipo_producto_id
        const marcaId = marcaNombre ? marcasMap.get(marcaNombre) : null;
        const tipoProductoId = tipoNombre ? tiposProductoMap.get(tipoNombre) : null;

        // Import or update producto
        if (codigoArticulo && descripcion) {
          const subcategoriaId = categoriaId ? subcategoriasMap.get(`${categoriaId}-${codigoGrupo}`) : null;

          if (!productosMap.has(codigoArticulo)) {
            // Create new product
            try {
              const { data, error } = await supabase
                .from('productos')
                .insert([{
                  codigo_articulo: codigoArticulo,
                  descripcion: descripcion,
                  unidad_medida: unidadMedida || 'UN',
                  categoria_id: categoriaId || null,
                  subcategoria_id: subcategoriaId || null,
                  precio_costo: precioCosto,
                  marca_id: marcaId || null,
                  tipo_producto_id: tipoProductoId || null,
                  cantidad_por_empaque: cantidadPorEmpaque,
                }])
                .select()
                .single();

              if (error) throw error;
              productosMap.set(codigoArticulo, data.id);
              importResults.productos.success++;
            } catch (error: any) {
              if (!error.message?.includes('duplicate')) {
                importResults.productos.errors.push({ row: i + 2, message: error.message });
              }
            }
          } else {
            // Update existing product - now updates all fields including description
            const productoId = productosMap.get(codigoArticulo)!;
            const subcategoriaId = categoriaId ? subcategoriasMap.get(`${categoriaId}-${codigoGrupo}`) : null;
            const updateData: any = {};
            
            // Always update description if provided
            if (descripcion) updateData.descripcion = descripcion;
            // Update unit of measure if provided
            if (unidadMedida) updateData.unidad_medida = unidadMedida;
            // Update price if valid
            if (precioCosto > 0) updateData.precio_costo = precioCosto;
            // Update brand if exists
            if (marcaId) updateData.marca_id = marcaId;
            // Update product type if exists
            if (tipoProductoId) updateData.tipo_producto_id = tipoProductoId;
            // Update quantity per package
            if (cantidadPorEmpaque > 1) updateData.cantidad_por_empaque = cantidadPorEmpaque;
            // Update category/subcategory if provided
            if (categoriaId) updateData.categoria_id = categoriaId;
            if (subcategoriaId) updateData.subcategoria_id = subcategoriaId;

            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabase
                .from('productos')
                .update(updateData)
                .eq('id', productoId);
              
              if (updateError) {
                importResults.productos.errors.push({ row: i + 2, message: `Update error: ${updateError.message}` });
              } else {
                importResults.productos.updated++;
              }
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
    ? results.categorias.success + results.subcategorias.success + results.productos.success + 
      results.marcas.success + results.tiposProducto.success
    : 0;

  const totalUpdated = results
    ? results.productos.updated
    : 0;

  const totalErrors = results
    ? results.categorias.errors.length + results.subcategorias.errors.length + 
      results.productos.errors.length + results.marcas.errors.length + results.tiposProducto.errors.length
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
              Importe categorías, subcategorías, marcas, tipos y productos desde un archivo Excel.
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
                  <div className="text-xs text-left bg-muted p-3 rounded font-mono space-y-1">
                    <p>FAMILIA, NOM_FAM (categorías)</p>
                    <p>GRUPO, NOM_GRU (subcategorías)</p>
                    <p>COD_ARTIC, DESCRIP, UNIDAD_MED (productos)</p>
                    <p>PRECIO_1 o PRECIO_COSTO (precio de costo)</p>
                    <p className="text-primary font-semibold">MARCA ID (marca del producto)</p>
                    <p className="text-primary font-semibold">ID (tipo de producto)</p>
                    <p className="text-primary font-semibold">CANTIDAD POR EMPAQUE</p>
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
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{totalSuccess}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Creados</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-blue-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{totalUpdated}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Actualizados</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{totalErrors}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Errores</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-medium">Marcas</p>
                    <p className="text-xs text-muted-foreground">
                      {results.marcas.success} nuevas
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-medium">Tipos</p>
                    <p className="text-xs text-muted-foreground">
                      {results.tiposProducto.success} nuevos
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-medium">Productos</p>
                    <p className="text-xs text-muted-foreground">
                      {results.productos.success} nuevos, {results.productos.updated} actualizados
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-medium">Categorías</p>
                    <p className="text-xs text-muted-foreground">
                      {results.categorias.success} nuevas
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-medium">Subcategorías</p>
                    <p className="text-xs text-muted-foreground">
                      {results.subcategorias.success} nuevas
                    </p>
                  </div>
                </div>

                {totalErrors > 0 && (
                  <ScrollArea className="h-32 border rounded p-2">
                    {[
                      ...results.marcas.errors,
                      ...results.tiposProducto.errors,
                      ...results.categorias.errors, 
                      ...results.subcategorias.errors, 
                      ...results.productos.errors
                    ].map((error, idx) => (
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
