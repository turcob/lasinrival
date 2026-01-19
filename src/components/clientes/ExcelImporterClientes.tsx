import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExcelImporterClientesProps {
  onImportComplete: () => void;
}

// ID de la lista de precios MAYORISTA
const LISTA_MAYORISTA_ID = '9c7ace0c-6be3-41e6-b173-4b0f8894aeaa';

// Mapeo de condición IVA según tipo de documento
const CONDICION_IVA_MAP: Record<string, number> = {
  'CONSUMIDOR FINAL': 5,
  'D.N.I.': 5,
  'DNI': 5,
  'L.C.': 5,
  'LC': 5,
  'L.E.': 5,
  'LE': 5,
  'C.U.I.T.': 1,
  'CUIT': 1,
  'C.U.I.L.': 1,
  'CUIL': 1,
};

// Números de documento inválidos que se guardarán como null
const INVALID_DOCUMENT_NUMBERS = [
  '00000000',
  '99999999',
  '11111111',
  '12345678',
  '00000000000',
  '99999999999',
  '11111111111',
  '',
];

export function ExcelImporterClientes({ onImportComplete }: ExcelImporterClientesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    created: number;
    updated: number;
    errors: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeColumnName = (name: string): string => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const normalizeDocumentNumber = (value: string | number | undefined): string | null => {
    if (value === undefined || value === null) return null;
    
    const cleaned = String(value).replace(/\s/g, '').trim();
    
    if (INVALID_DOCUMENT_NUMBERS.includes(cleaned)) {
      return null;
    }
    
    // Si ya tiene formato de CUIT con guiones, mantenerlo
    if (/^\d{2}-\d{8}-\d{1}$/.test(cleaned)) {
      return cleaned;
    }
    
    // Si es numérico y tiene 11 dígitos, formatear como CUIT
    if (/^\d{11}$/.test(cleaned)) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
    }
    
    return cleaned || null;
  };

  const getCondicionIva = (tipoDocumento: string | undefined): number | null => {
    if (!tipoDocumento) return null;
    const normalized = tipoDocumento.toUpperCase().trim();
    return CONDICION_IVA_MAP[normalized] || null;
  };

  const buildDireccion = (domicilio: string | undefined, localidad: string | undefined): string | null => {
    const parts = [domicilio?.trim(), localidad?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawData.length) {
        toast.error('El archivo está vacío o no tiene datos válidos');
        setImporting(false);
        return;
      }

      const rows = rawData as Record<string, unknown>[];
      const totalRows = rows.length;

      // Obtener clientes existentes para detectar duplicados
      const { data: existingClientes } = await supabase
        .from('clientes')
        .select('id, nombre');

      const clientesByName = new Map<string, string>();
      existingClientes?.forEach((c) => {
        if (c.nombre) {
          clientesByName.set(c.nombre.toUpperCase().trim(), c.id);
        }
      });

      let created = 0;
      let updated = 0;
      let errors = 0;

      // Procesar en lotes de 50
      const batchSize = 50;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          const normalizedRow: Record<string, unknown> = {};
          Object.entries(row).forEach(([key, value]) => {
            normalizedRow[normalizeColumnName(key)] = value;
          });

          const nombre = String(
            normalizedRow['Razon social'] || 
            normalizedRow['Razón social'] ||
            normalizedRow['RAZON SOCIAL'] ||
            normalizedRow['Nombre'] ||
            normalizedRow['NOMBRE'] ||
            ''
          ).trim();

          if (!nombre) {
            errors++;
            continue;
          }

          const tipoDocumento = String(
            normalizedRow['Tipo de documento'] || 
            normalizedRow['TIPO DE DOCUMENTO'] ||
            normalizedRow['Tipo documento'] ||
            ''
          ).trim();

          const numero = normalizedRow['Numero'] || 
            normalizedRow['Número'] || 
            normalizedRow['NUMERO'] ||
            normalizedRow['Nro. Documento'] ||
            '';

          const domicilio = String(
            normalizedRow['Domicilio'] || 
            normalizedRow['DOMICILIO'] ||
            normalizedRow['Direccion'] ||
            normalizedRow['Dirección'] ||
            ''
          ).trim();

          const localidad = String(
            normalizedRow['Localidad'] || 
            normalizedRow['LOCALIDAD'] ||
            ''
          ).trim();

          const telefono = String(
            normalizedRow['Telefono'] || 
            normalizedRow['Teléfono'] ||
            normalizedRow['TELEFONO'] ||
            ''
          ).trim() || null;

          const dniCuit = normalizeDocumentNumber(numero as string | number);
          const condicionIva = getCondicionIva(tipoDocumento);
          const direccion = buildDireccion(domicilio, localidad);

          const existingId = clientesByName.get(nombre.toUpperCase());

          try {
            if (existingId) {
              // Actualizar cliente existente
              const { error } = await supabase
                .from('clientes')
                .update({
                  dni_cuit: dniCuit,
                  condicion_iva: condicionIva,
                  direccion: direccion,
                  telefono: telefono,
                  lista_precio_id: LISTA_MAYORISTA_ID,
                  activo: true,
                })
                .eq('id', existingId);

              if (error) throw error;
              updated++;
            } else {
              // Crear nuevo cliente
              const { error } = await supabase
                .from('clientes')
                .insert({
                  nombre: nombre,
                  dni_cuit: dniCuit,
                  condicion_iva: condicionIva,
                  direccion: direccion,
                  telefono: telefono,
                  lista_precio_id: LISTA_MAYORISTA_ID,
                  activo: true,
                });

              if (error) throw error;
              created++;
              
              // Agregar al mapa para evitar duplicados en el mismo archivo
              clientesByName.set(nombre.toUpperCase(), 'new');
            }
          } catch (err) {
            console.error('Error procesando cliente:', nombre, err);
            errors++;
          }
        }

        setProgress(Math.round(((i + batch.length) / totalRows) * 100));
      }

      setResults({ created, updated, errors, total: totalRows });
      
      if (created > 0 || updated > 0) {
        toast.success(`Importación completada: ${created} creados, ${updated} actualizados`);
        onImportComplete();
      }
    } catch (error) {
      console.error('Error importing clients:', error);
      toast.error('Error al procesar el archivo Excel');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleClose = () => {
    if (!importing) {
      setDialogOpen(false);
      setResults(null);
      setProgress(0);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setDialogOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Importar Clientes
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Clientes desde Excel
            </DialogTitle>
            <DialogDescription>
              Importe clientes desde un archivo Excel (.xlsx, .xls)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!importing && !results && (
              <>
                <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Seleccione un archivo Excel para importar
                  </p>
                  <Button 
                    className="mt-4" 
                    onClick={handleButtonClick}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Seleccionar archivo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="font-medium text-sm mb-2">Columnas esperadas:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>Razón social</strong> - Nombre del cliente (requerido)</li>
                    <li>• <strong>Tipo de documento</strong> - DNI, CUIT, etc.</li>
                    <li>• <strong>Número</strong> - Número de documento</li>
                    <li>• <strong>Domicilio</strong> - Dirección</li>
                    <li>• <strong>Localidad</strong> - Ciudad/Localidad</li>
                    <li>• <strong>Teléfono</strong> - Número de contacto</li>
                  </ul>
                  <div className="mt-3 p-2 bg-primary/10 rounded text-sm">
                    <AlertCircle className="inline h-4 w-4 mr-1 text-primary" />
                    Se asignará automáticamente la lista <strong>MAYORISTA</strong>
                  </div>
                </div>
              </>
            )}

            {importing && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Importando clientes...
                </p>
                <Progress value={progress} className="w-full" />
                <p className="text-center text-xs text-muted-foreground">
                  {progress}% completado
                </p>
              </div>
            )}

            {results && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <h3 className="text-center font-medium">Importación completada</h3>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {results.created}
                    </p>
                    <p className="text-xs text-muted-foreground">Creados</p>
                  </div>
                  <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {results.updated}
                    </p>
                    <p className="text-xs text-muted-foreground">Actualizados</p>
                  </div>
                  <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-3">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {results.errors}
                    </p>
                    <p className="text-xs text-muted-foreground">Errores</p>
                  </div>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Total procesados: {results.total} registros
                </p>

                <div className="flex justify-center">
                  <Button onClick={handleClose}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
