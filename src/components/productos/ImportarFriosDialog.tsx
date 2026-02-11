import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Snowflake, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportarFriosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface Resumen {
  marcadosFrio: number;
  marcadosNoFrio: number;
  noEncontrados: number;
  totalFilas: number;
}

export function ImportarFriosDialog({ open, onOpenChange, onImportComplete }: ImportarFriosDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAllProducts = async () => {
    let all: { id: string; codigo_articulo: string }[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('productos')
        .select('id, codigo_articulo')
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < batchSize) break;
      from += batchSize;
    }

    return all;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setProgress(0);
    setResumen(null);
    setStatusMsg('Leyendo archivo Excel...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        toast.error('El archivo no contiene datos');
        setProcessing(false);
        return;
      }

      // Normalize column names (trim whitespace)
      const normalizedRows = rows.map((row) => {
        const normalized: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          normalized[key.trim()] = row[key];
        }
        return normalized;
      });

      // Validate required columns
      const firstRow = normalizedRows[0];
      if (!('COD_ARTIC' in firstRow)) {
        toast.error('No se encontró la columna COD_ARTIC en el archivo');
        setProcessing(false);
        return;
      }
      if (!('CATEGORIO PARA LISTAS' in firstRow)) {
        toast.error('No se encontró la columna "CATEGORIO PARA LISTAS" en el archivo');
        setProcessing(false);
        return;
      }

      setStatusMsg('Cargando productos del sistema...');
      setProgress(10);

      const allProducts = await fetchAllProducts();
      const productMap = new Map<string, string>();
      for (const p of allProducts) {
        if (p.codigo_articulo) {
          productMap.set(String(p.codigo_articulo).trim(), p.id);
        }
      }

      setStatusMsg('Comparando datos...');
      setProgress(30);

      const updatesFrio: string[] = [];
      const updatesNoFrio: string[] = [];
      let noEncontrados = 0;

      for (const row of normalizedRows) {
        const codArticulo = String(row['COD_ARTIC'] ?? '').trim();
        if (!codArticulo) continue;

        const productId = productMap.get(codArticulo);
        if (!productId) {
          noEncontrados++;
          continue;
        }

        const categoriaLista = String(row['CATEGORIO PARA LISTAS'] ?? '').trim().toLowerCase();
        if (categoriaLista === 'frio') {
          updatesFrio.push(productId);
        } else {
          updatesNoFrio.push(productId);
        }
      }

      // Execute updates in batches
      const totalUpdates = updatesFrio.length + updatesNoFrio.length;
      let completed = 0;
      const batchSize = 100;

      setStatusMsg('Actualizando productos fríos...');

      for (let i = 0; i < updatesFrio.length; i += batchSize) {
        const batch = updatesFrio.slice(i, i + batchSize);
        const { error } = await supabase
          .from('productos')
          .update({ es_frio: true })
          .in('id', batch);

        if (error) throw error;
        completed += batch.length;
        setProgress(30 + Math.round((completed / totalUpdates) * 60));
        setStatusMsg(`Actualizando... ${completed} de ${totalUpdates}`);
        await new Promise((r) => setTimeout(r, 50));
      }

      for (let i = 0; i < updatesNoFrio.length; i += batchSize) {
        const batch = updatesNoFrio.slice(i, i + batchSize);
        const { error } = await supabase
          .from('productos')
          .update({ es_frio: false })
          .in('id', batch);

        if (error) throw error;
        completed += batch.length;
        setProgress(30 + Math.round((completed / totalUpdates) * 60));
        setStatusMsg(`Actualizando... ${completed} de ${totalUpdates}`);
        await new Promise((r) => setTimeout(r, 50));
      }

      setProgress(100);
      setStatusMsg('¡Proceso completado!');
      setResumen({
        marcadosFrio: updatesFrio.length,
        marcadosNoFrio: updatesNoFrio.length,
        noEncontrados,
        totalFilas: normalizedRows.length,
      });

      toast.success(`Importación completada: ${updatesFrio.length} productos marcados como frío`);
      onImportComplete?.();
    } catch (error) {
      console.error('Error importing frios:', error);
      toast.error('Error al procesar el archivo');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClose = (open: boolean) => {
    if (!processing) {
      setResumen(null);
      setProgress(0);
      setStatusMsg('');
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-primary" />
            Importar Productos Fríos
          </DialogTitle>
          <DialogDescription>
            Seleccioná un archivo Excel con las columnas <strong>COD_ARTIC</strong> y{' '}
            <strong>CATEGORIO PARA LISTAS</strong>. Solo se actualizará el campo frío, no se agregarán productos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!processing && !resumen && (
            <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Seleccionar archivo Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {processing && (
            <div className="space-y-3">
              <Progress value={progress} />
              <p className="text-center text-sm text-muted-foreground">{statusMsg}</p>
            </div>
          )}

          {resumen && (
            <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
              <h4 className="font-semibold">Resumen de importación</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Total filas Excel:</span>
                <span className="font-medium">{resumen.totalFilas}</span>

                <span className="text-muted-foreground">Marcados como frío:</span>
                <span className="font-medium text-primary">{resumen.marcadosFrio}</span>

                <span className="text-muted-foreground">Marcados como no frío:</span>
                <span className="font-medium">{resumen.marcadosNoFrio}</span>

                <span className="text-muted-foreground">No encontrados:</span>
                <span className="font-medium text-orange-600">{resumen.noEncontrados}</span>
              </div>
              <Button
                className="mt-2 w-full"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
