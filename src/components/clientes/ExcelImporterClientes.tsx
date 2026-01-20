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
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
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
  'PAGA IVA (RI - RNI - CF) - NO APLICA SOBRE/SUBTASA': 5,
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
    zonasCreadas: number;
    vendedoresCreados: number;
    provinciasCreadas: number;
    condicionesCreadas: number;
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

  const getCondicionIva = (condicionIvaText: string | undefined): number | null => {
    if (!condicionIvaText) return null;
    const normalized = condicionIvaText.toUpperCase().trim();
    return CONDICION_IVA_MAP[normalized] || 5;
  };

  const parseDate = (dateValue: unknown): string | null => {
    if (!dateValue) return null;
    
    // Si es un número (fecha de Excel)
    if (typeof dateValue === 'number') {
      const date = new Date((dateValue - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // Si es string con formato m/d/yy o similar
    const strValue = String(dateValue).trim();
    if (strValue) {
      const parts = strValue.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    return null;
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

      // Obtener datos existentes
      const [
        { data: existingClientes },
        { data: existingZonas },
        { data: existingVendedores },
        { data: existingProvincias },
        { data: existingCondiciones }
      ] = await Promise.all([
        supabase.from('clientes').select('id, codigo_cliente, nombre'),
        supabase.from('zonas').select('id, codigo, nombre'),
        supabase.from('vendedores').select('id, codigo, nombre'),
        supabase.from('provincias').select('id, codigo, nombre'),
        supabase.from('condiciones_venta').select('id, codigo, descripcion'),
      ]);

      // Mapas para búsqueda rápida
      const clientesByCode = new Map<string, string>();
      const clientesByName = new Map<string, string>();
      existingClientes?.forEach((c) => {
        if (c.codigo_cliente) clientesByCode.set(c.codigo_cliente, c.id);
        if (c.nombre) clientesByName.set(c.nombre.toUpperCase().trim(), c.id);
      });

      const zonasMap = new Map<string, string>();
      existingZonas?.forEach((z) => zonasMap.set(z.codigo, z.id));

      const vendedoresMap = new Map<string, string>();
      existingVendedores?.forEach((v) => vendedoresMap.set(v.codigo, v.id));

      const provinciasMap = new Map<string, string>();
      existingProvincias?.forEach((p) => provinciasMap.set(p.codigo, p.id));

      const condicionesMap = new Map<string, string>();
      existingCondiciones?.forEach((c) => condicionesMap.set(c.codigo, c.id));

      let created = 0;
      let updated = 0;
      let errors = 0;
      let zonasCreadas = 0;
      let vendedoresCreados = 0;
      let provinciasCreadas = 0;
      let condicionesCreadas = 0;

      // Procesar en lotes de 50
      const batchSize = 50;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          const normalizedRow: Record<string, unknown> = {};
          Object.entries(row).forEach(([key, value]) => {
            normalizedRow[normalizeColumnName(key)] = value;
          });

          const codigoCliente = String(normalizedRow['Cod. cliente'] || normalizedRow['Cód. cliente'] || '').trim();
          
          const nombre = String(
            normalizedRow['Razon social'] || 
            normalizedRow['Razón social'] ||
            normalizedRow['RAZON SOCIAL'] ||
            ''
          ).trim();

          if (!nombre) {
            errors++;
            continue;
          }

          const tipoDocumento = String(normalizedRow['Tipo de documento'] || '').trim();
          const numeroDocumento = normalizedRow['Numero documeto'] || normalizedRow['Número documento'] || normalizedRow['Numero'] || '';
          const domicilio = String(normalizedRow['Domicilio'] || '').trim();
          const localidad = String(normalizedRow['Localidad'] || '').trim();
          const codigoPostal = String(normalizedRow['Cod. Postal'] || normalizedRow['Cód. Postal'] || '').trim();
          const telefono = String(normalizedRow['Telefono'] || normalizedRow['Teléfono'] || '').trim() || null;
          const telefonoContacto = String(normalizedRow['Telefono del Contacto'] || normalizedRow['Teléfono del Contacto'] || '').trim() || null;
          const codigoProvincia = String(normalizedRow['Cod. provincia'] || normalizedRow['Cód. provincia'] || '').trim();
          const provinciaNombre = String(normalizedRow['Provincia'] || '').trim();
          const codigoZona = String(normalizedRow['Cod. de Zona'] || normalizedRow['Cód. de Zona'] || '').trim();
          const zonaNombre = String(normalizedRow['Zona'] || '').trim();
          const condicionIvaText = String(normalizedRow['Condicion de IVA'] || normalizedRow['Condición de IVA'] || '').trim();
          const codigoCondicionVenta = String(normalizedRow['Cod. condicion de venta'] || normalizedRow['Cód. condición de venta'] || '').trim();
          const descripcionCondicionVenta = String(normalizedRow['Descripcion Condicion de Venta'] || normalizedRow['Descripción Condición de Venta'] || '').trim();
          const codigoVendedor = String(normalizedRow['Cod. vendedor'] || normalizedRow['Cód. vendedor'] || '').trim();
          const vendedorNombre = String(normalizedRow['Vendedor'] || '').trim();
          const fechaAlta = parseDate(normalizedRow['Fecha de alta']);

          const dniCuit = normalizeDocumentNumber(numeroDocumento as string | number);
          const condicionIva = getCondicionIva(condicionIvaText);
          const direccion = domicilio || null;

          try {
            // Crear zona si no existe
            let zonaId: string | null = null;
            if (codigoZona && zonaNombre) {
              if (!zonasMap.has(codigoZona)) {
                const { data: nuevaZona, error: zonaError } = await supabase
                  .from('zonas')
                  .insert({ codigo: codigoZona, nombre: zonaNombre })
                  .select('id')
                  .single();
                if (!zonaError && nuevaZona) {
                  zonasMap.set(codigoZona, nuevaZona.id);
                  zonasCreadas++;
                }
              }
              zonaId = zonasMap.get(codigoZona) || null;
            }

            // Crear vendedor si no existe
            let vendedorId: string | null = null;
            if (codigoVendedor && vendedorNombre) {
              if (!vendedoresMap.has(codigoVendedor)) {
                const { data: nuevoVendedor, error: vendedorError } = await supabase
                  .from('vendedores')
                  .insert({ codigo: codigoVendedor, nombre: vendedorNombre })
                  .select('id')
                  .single();
                if (!vendedorError && nuevoVendedor) {
                  vendedoresMap.set(codigoVendedor, nuevoVendedor.id);
                  vendedoresCreados++;
                }
              }
              vendedorId = vendedoresMap.get(codigoVendedor) || null;
            }

            // Crear provincia si no existe
            let provinciaId: string | null = null;
            if (codigoProvincia && provinciaNombre) {
              if (!provinciasMap.has(codigoProvincia)) {
                const { data: nuevaProvincia, error: provError } = await supabase
                  .from('provincias')
                  .insert({ codigo: codigoProvincia, nombre: provinciaNombre })
                  .select('id')
                  .single();
                if (!provError && nuevaProvincia) {
                  provinciasMap.set(codigoProvincia, nuevaProvincia.id);
                  provinciasCreadas++;
                }
              }
              provinciaId = provinciasMap.get(codigoProvincia) || null;
            }

            // Crear condición de venta si no existe
            let condicionVentaId: string | null = null;
            if (codigoCondicionVenta && descripcionCondicionVenta) {
              if (!condicionesMap.has(codigoCondicionVenta)) {
                const { data: nuevaCondicion, error: condError } = await supabase
                  .from('condiciones_venta')
                  .insert({ codigo: codigoCondicionVenta, descripcion: descripcionCondicionVenta })
                  .select('id')
                  .single();
                if (!condError && nuevaCondicion) {
                  condicionesMap.set(codigoCondicionVenta, nuevaCondicion.id);
                  condicionesCreadas++;
                }
              }
              condicionVentaId = condicionesMap.get(codigoCondicionVenta) || null;
            }

            // Buscar cliente existente por código o nombre
            const existingId = (codigoCliente && clientesByCode.get(codigoCliente)) || 
                               clientesByName.get(nombre.toUpperCase());

            const clienteData = {
              codigo_cliente: codigoCliente || null,
              nombre: nombre,
              dni_cuit: dniCuit,
              condicion_iva: condicionIva,
              direccion: direccion,
              telefono: telefono,
              telefono_contacto: telefonoContacto,
              codigo_postal: codigoPostal || null,
              zona_id: zonaId,
              vendedor_id: vendedorId,
              provincia_id: provinciaId,
              condicion_venta_id: condicionVentaId,
              fecha_alta: fechaAlta,
              lista_precio_id: LISTA_MAYORISTA_ID,
              activo: true,
            };

            if (existingId) {
              const { error } = await supabase
                .from('clientes')
                .update(clienteData)
                .eq('id', existingId);

              if (error) throw error;
              updated++;
            } else {
              const { error } = await supabase
                .from('clientes')
                .insert(clienteData);

              if (error) throw error;
              created++;
              
              if (codigoCliente) clientesByCode.set(codigoCliente, 'new');
              clientesByName.set(nombre.toUpperCase(), 'new');
            }
          } catch (err) {
            console.error('Error procesando cliente:', nombre, err);
            errors++;
          }
        }

        setProgress(Math.round(((i + batch.length) / totalRows) * 100));
      }

      setResults({ 
        created, 
        updated, 
        errors, 
        total: totalRows,
        zonasCreadas,
        vendedoresCreados,
        provinciasCreadas,
        condicionesCreadas
      });
      
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
        <DialogContent className="max-w-lg">
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
                  <h4 className="font-medium text-sm mb-2">Columnas soportadas:</h4>
                  <ul className="text-xs text-muted-foreground space-y-0.5 columns-2">
                    <li>• Cód. cliente</li>
                    <li>• Razón social *</li>
                    <li>• Tipo de documento</li>
                    <li>• Número documento</li>
                    <li>• Domicilio</li>
                    <li>• Localidad</li>
                    <li>• Cód. Postal</li>
                    <li>• Teléfono</li>
                    <li>• Teléfono del Contacto</li>
                    <li>• Cód. provincia / Provincia</li>
                    <li>• Cód. de Zona / Zona</li>
                    <li>• Condición de IVA</li>
                    <li>• Cód. condición de venta</li>
                    <li>• Cód. vendedor / Vendedor</li>
                    <li>• Fecha de alta</li>
                  </ul>
                  <div className="mt-3 p-2 bg-primary/10 rounded text-xs">
                    <AlertCircle className="inline h-3 w-3 mr-1 text-primary" />
                    Se crearán automáticamente zonas, vendedores y provincias
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
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {results.created}
                    </p>
                    <p className="text-xs text-muted-foreground">Clientes creados</p>
                  </div>
                  <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {results.updated}
                    </p>
                    <p className="text-xs text-muted-foreground">Actualizados</p>
                  </div>
                  <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      {results.errors}
                    </p>
                    <p className="text-xs text-muted-foreground">Errores</p>
                  </div>
                </div>

                {(results.zonasCreadas > 0 || results.vendedoresCreados > 0 || results.provinciasCreadas > 0) && (
                  <div className="text-sm text-center text-muted-foreground bg-muted/50 rounded p-2">
                    <p>También se crearon:</p>
                    <p className="font-medium">
                      {results.zonasCreadas > 0 && `${results.zonasCreadas} zonas`}
                      {results.vendedoresCreados > 0 && ` • ${results.vendedoresCreados} vendedores`}
                      {results.provinciasCreadas > 0 && ` • ${results.provinciasCreadas} provincias`}
                      {results.condicionesCreadas > 0 && ` • ${results.condicionesCreadas} cond. venta`}
                    </p>
                  </div>
                )}

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
