import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type TipoMovimiento = 'saldo_inicial' | 'compra' | 'pago' | 'nota_credito';

interface MovimientoExcel {
  clienteCodigo: string;
  clienteNombre: string;
  fecha: string | null;
  tipo: TipoMovimiento;
  tipoOriginal: string;
  nroComprobante: string;
  monto: number;
  observacion: string;
}

interface ImportResult {
  clienteCodigo: string;
  clienteNombre: string;
  tipo: string;
  nroComprobante: string;
  monto: number;
  status: 'success' | 'error' | 'skipped';
  message: string;
}

interface ImportarHistorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ClienteRow {
  Cliente: string;
  'Tipo comprobante'?: string;
  'Nro. comprobante'?: string;
  'Fecha comprobante'?: string | number;
  Estado?: string;
  Debe?: string | number;
  Haber?: string | number;
  Importe?: string | number;
  Leyenda?: string;
  'Leyenda 1'?: string;
  'Leyenda 2'?: string;
  'Leyenda 3'?: string;
  'Leyenda 4'?: string;
  'Leyenda 5'?: string;
}

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  saldo_inicial: 'Saldo Inicial',
  compra: 'Factura',
  pago: 'Recibo',
  nota_credito: 'Nota Crédito',
};

const TIPO_COLORS: Record<TipoMovimiento, string> = {
  saldo_inicial: 'bg-secondary text-secondary-foreground',
  compra: 'bg-destructive/10 text-destructive',
  pago: 'bg-primary/10 text-primary',
  nota_credito: 'bg-accent text-accent-foreground',
};

export function ImportarHistorialDialog({ open, onOpenChange, onImportComplete }: ImportarHistorialDialogProps) {
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsingMessage, setParsingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'results'>('upload');
  const [parsedMovimientos, setParsedMovimientos] = useState<MovimientoExcel[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const parseNumber = (value: string | number | undefined): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value;
    const cleaned = value.toString().replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  const parseExcelDate = (value: string | number | undefined): string | null => {
    if (!value) return null;
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    }
    if (typeof value === 'string') {
      const parts = value.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return null;
  };

  const extractClienteCode = (clienteStr: string): { codigo: string; nombre: string } | null => {
    if (!clienteStr) return null;
    const parts = clienteStr.split(' - ');
    if (parts.length >= 2) {
      return {
        codigo: parts[0].trim(),
        nombre: parts.slice(1).join(' - ').trim()
      };
    }
    return null;
  };

  const normalizeCodigo = (codigo: string): string => {
    return codigo.replace(/^0+/, '') || '0';
  };

  const determinarTipoMovimiento = (row: ClienteRow): { tipo: TipoMovimiento; tipoOriginal: string } | null => {
    const tipoComprobante = row['Tipo comprobante']?.toString().trim().toUpperCase();
    const estado = row.Estado?.toString().trim().toLowerCase();

    if (estado && estado.includes('saldo inicial')) {
      return { tipo: 'saldo_inicial', tipoOriginal: 'Saldo inicial' };
    }

    if (!tipoComprobante || tipoComprobante === '') return null;

    if (tipoComprobante === 'FAC') return { tipo: 'compra', tipoOriginal: 'FAC' };
    if (tipoComprobante === 'REC') return { tipo: 'pago', tipoOriginal: 'REC' };
    if (tipoComprobante === 'NCR') return { tipo: 'nota_credito', tipoOriginal: 'NCR' };

    return null;
  };

  const buildObservacion = (row: ClienteRow): string => {
    const parts = [
      row.Leyenda,
      row['Leyenda 1'],
      row['Leyenda 2'],
      row['Leyenda 3'],
      row['Leyenda 4'],
      row['Leyenda 5'],
    ].filter(Boolean).map(s => s!.toString().trim()).filter(s => s.length > 0);
    return parts.join(' | ');
  };

  const processExcelData = useCallback((jsonData: ClienteRow[]): MovimientoExcel[] => {
    const movimientos: MovimientoExcel[] = [];

    for (const row of jsonData) {
      if (!row.Cliente) continue;

      const clienteInfo = extractClienteCode(row.Cliente);
      if (!clienteInfo) continue;

      const tipoInfo = determinarTipoMovimiento(row);
      if (!tipoInfo) continue;

      const debe = parseNumber(row.Debe);
      const haber = parseNumber(row.Haber);
      const importe = parseNumber(row.Importe);

      let monto: number;
      if (tipoInfo.tipo === 'saldo_inicial') {
        monto = importe;
      } else if (tipoInfo.tipo === 'compra') {
        monto = debe;
      } else {
        monto = haber;
      }

      if (monto === 0) continue;

      movimientos.push({
        clienteCodigo: clienteInfo.codigo,
        clienteNombre: clienteInfo.nombre,
        fecha: parseExcelDate(row['Fecha comprobante']),
        tipo: tipoInfo.tipo,
        tipoOriginal: tipoInfo.tipoOriginal,
        nroComprobante: row['Nro. comprobante']?.toString() || '',
        monto: Math.abs(monto),
        observacion: buildObservacion(row),
      });
    }

    return movimientos;
  }, []);

  const updateUI = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setProgress(5);
    setParsingMessage(`Cargando archivo: ${file.name}`);

    try {
      await updateUI();
      setProgress(10);
      setParsingMessage('Leyendo archivo...');
      await updateUI();

      const data = await file.arrayBuffer();

      setProgress(25);
      setParsingMessage('Parseando Excel...');
      await updateUI();

      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ClienteRow>(worksheet);

      setProgress(50);
      setParsingMessage(`Analizando ${jsonData.length.toLocaleString()} filas...`);
      await updateUI();

      const chunkSize = 5000;
      let allMovimientos: MovimientoExcel[] = [];

      for (let i = 0; i < jsonData.length; i += chunkSize) {
        const chunk = jsonData.slice(i, i + chunkSize);
        allMovimientos = allMovimientos.concat(processExcelData(chunk));
        const pv = 50 + Math.round(((i + chunk.length) / jsonData.length) * 45);
        setProgress(pv);
        setParsingMessage(`Procesando filas ${i.toLocaleString()} - ${Math.min(i + chunkSize, jsonData.length).toLocaleString()}...`);
        await updateUI();
      }

      setProgress(100);
      setParsingMessage(`¡Listo! ${allMovimientos.length.toLocaleString()} movimientos encontrados`);
      await new Promise(r => setTimeout(r, 500));

      setParsedMovimientos(allMovimientos);
      setParsing(false);
      setProgress(0);
      setParsingMessage('');
      setStep('preview');
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('Error al leer el archivo Excel');
      setParsing(false);
      setProgress(0);
      setParsingMessage('');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para importar');
      return;
    }

    setImporting(true);
    setProgress(0);
    const importResults: ImportResult[] = [];

    // Fetch ALL clients with pagination
    let allClientes: Array<{ id: string; codigo_cliente: string | null; nombre: string }> = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data: batch } = await supabase
        .from('clientes')
        .select('id, codigo_cliente, nombre')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (!batch || batch.length === 0) break;
      allClientes = allClientes.concat(batch);
      if (batch.length < pageSize) break;
      page++;
    }

    const clienteMap = new Map<string, { id: string; nombre: string }>();
    allClientes.forEach(c => {
      if (c.codigo_cliente) {
        clienteMap.set(c.codigo_cliente, { id: c.id, nombre: c.nombre });
        clienteMap.set(normalizeCodigo(c.codigo_cliente), { id: c.id, nombre: c.nombre });
      }
    });

    // Check existing historical movements to avoid duplicates
    const conceptosExistentes = new Map<string, Set<string>>();
    let movPage = 0;
    while (true) {
      const { data: batch } = await supabase
        .from('cliente_movimientos')
        .select('cliente_id, concepto')
        .eq('origen', 'historico')
        .range(movPage * pageSize, (movPage + 1) * pageSize - 1);
      if (!batch || batch.length === 0) break;
      batch.forEach(m => {
        if (m.concepto) {
          if (!conceptosExistentes.has(m.cliente_id)) {
            conceptosExistentes.set(m.cliente_id, new Set());
          }
          conceptosExistentes.get(m.cliente_id)!.add(m.concepto);
        }
      });
      if (batch.length < pageSize) break;
      movPage++;
    }

    setProgress(10);
    await updateUI();

    // Prepare records
    const movimientosAInsertar: Array<{
      cliente_id: string;
      tipo: string;
      monto: number;
      concepto: string;
      estado_imputacion: string;
      usuario_registro_id: string;
      fecha: string;
      origen: string;
    }> = [];

    for (const mov of parsedMovimientos) {
      let cliente = clienteMap.get(mov.clienteCodigo) || clienteMap.get(normalizeCodigo(mov.clienteCodigo));

      if (!cliente) {
        importResults.push({
          clienteCodigo: mov.clienteCodigo,
          clienteNombre: mov.clienteNombre,
          tipo: mov.tipoOriginal,
          nroComprobante: mov.nroComprobante,
          monto: mov.monto,
          status: 'error',
          message: 'Cliente no encontrado'
        });
        continue;
      }

      const concepto = mov.tipo === 'saldo_inicial'
        ? `Saldo inicial histórico`
        : `${mov.tipoOriginal} ${mov.nroComprobante}`.trim();

      // Check duplicate
      const clienteConceptos = conceptosExistentes.get(cliente.id);
      if (clienteConceptos && clienteConceptos.has(concepto)) {
        importResults.push({
          clienteCodigo: mov.clienteCodigo,
          clienteNombre: mov.clienteNombre,
          tipo: mov.tipoOriginal,
          nroComprobante: mov.nroComprobante,
          monto: mov.monto,
          status: 'skipped',
          message: 'Ya importado'
        });
        continue;
      }

      // Track to avoid duplicates within same file
      if (!conceptosExistentes.has(cliente.id)) {
        conceptosExistentes.set(cliente.id, new Set());
      }
      conceptosExistentes.get(cliente.id)!.add(concepto);

      movimientosAInsertar.push({
        cliente_id: cliente.id,
        tipo: mov.tipo,
        monto: mov.monto,
        concepto: mov.observacion ? `${concepto} | ${mov.observacion}` : concepto,
        estado_imputacion: 'confirmado',
        usuario_registro_id: user.id,
        fecha: mov.fecha || new Date().toISOString().split('T')[0],
        origen: 'historico',
      });

      importResults.push({
        clienteCodigo: mov.clienteCodigo,
        clienteNombre: mov.clienteNombre,
        tipo: mov.tipoOriginal,
        nroComprobante: mov.nroComprobante,
        monto: mov.monto,
        status: 'success',
        message: 'Listo para importar'
      });
    }

    // Insert in batches of 100
    const batchSize = 100;
    let insertados = 0;

    for (let i = 0; i < movimientosAInsertar.length; i += batchSize) {
      const batch = movimientosAInsertar.slice(i, i + batchSize);
      const { error } = await supabase.from('cliente_movimientos').insert(batch as any);

      if (error) {
        console.error('Error en batch insert:', error);
        // Mark these as errors
        let count = 0;
        for (const r of importResults) {
          if (r.status === 'success' && r.message === 'Listo para importar' && count < batch.length) {
            r.status = 'error';
            r.message = error.message;
            count++;
          }
        }
      } else {
        insertados += batch.length;
        let count = 0;
        for (const r of importResults) {
          if (r.status === 'success' && r.message === 'Listo para importar' && count < batch.length) {
            r.message = 'Importado';
            count++;
          }
        }
      }

      setProgress(10 + Math.round(((i + batch.length) / movimientosAInsertar.length) * 90));
      await updateUI();
    }

    setResults(importResults);
    setStep('results');
    setImporting(false);
    setProgress(0);

    const successCount = importResults.filter(r => r.status === 'success').length;
    const errorCount = importResults.filter(r => r.status === 'error').length;
    const skippedCount = importResults.filter(r => r.status === 'skipped').length;

    toast.success(`Importación completada: ${successCount} importados, ${skippedCount} omitidos, ${errorCount} errores`);
    onImportComplete?.();
  };

  const handleClose = () => {
    setStep('upload');
    setParsedMovimientos([]);
    setResults([]);
    setProgress(0);
    setParsing(false);
    setImporting(false);
    onOpenChange(false);
  };

  // Summary stats for preview
  const resumenTipos = parsedMovimientos.reduce((acc, m) => {
    acc[m.tipo] = (acc[m.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const clientesUnicos = new Set(parsedMovimientos.map(m => m.clienteCodigo)).size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Historial de Vendedor
          </DialogTitle>
          <DialogDescription>
            Importa movimientos históricos desde un archivo Excel de vendedor. Se guardan como historial separado.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            {parsing ? (
              <div className="space-y-3 py-8">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">{parsingMessage}</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center space-y-4">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Seleccioná el archivo Excel del vendedor (ej: WILY_MOYANO.xlsx)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Columnas esperadas: Cliente, Fecha comprobante, Tipo comprobante, Nro. comprobante, Estado, Debe, Haber, Importe, Leyendas
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar Archivo
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-bold">{parsedMovimientos.length.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Movimientos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-bold">{clientesUnicos}</p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
              {Object.entries(resumenTipos).map(([tipo, count]) => (
                <div key={tipo} className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold">{count.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{TIPO_LABELS[tipo as TipoMovimiento] || tipo}</p>
                </div>
              ))}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Comprobante</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedMovimientos.slice(0, 100).map((mov, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-3 py-1.5 text-xs">{mov.clienteCodigo} - {mov.clienteNombre}</td>
                      <td className="px-3 py-1.5 text-xs">{mov.fecha || '-'}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className={`text-xs ${TIPO_COLORS[mov.tipo]}`}>
                          {TIPO_LABELS[mov.tipo]}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-xs">{mov.nroComprobante || '-'}</td>
                      <td className="px-3 py-1.5 text-xs text-right font-medium">
                        ${mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedMovimientos.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando primeros 100 de {parsedMovimientos.length.toLocaleString()} movimientos
                </p>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setStep('upload'); setParsedMovimientos([]); }}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando... {progress > 0 && `${progress}%`}
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Importar {parsedMovimientos.length.toLocaleString()} movimientos
                  </>
                )}
              </Button>
            </div>
            {importing && <Progress value={progress} />}
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-center">
                <p className="text-2xl font-bold text-green-600">{results.filter(r => r.status === 'success').length}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-center">
                <p className="text-2xl font-bold text-yellow-600">{results.filter(r => r.status === 'skipped').length}</p>
                <p className="text-xs text-muted-foreground">Omitidos</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-center">
                <p className="text-2xl font-bold text-destructive">{results.filter(r => r.status === 'error').length}</p>
                <p className="text-xs text-muted-foreground">Errores</p>
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-left">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 200).map((r, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-3 py-1.5">
                        {r.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {r.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                        {r.status === 'skipped' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                      </td>
                      <td className="px-3 py-1.5 text-xs">{r.clienteCodigo} - {r.clienteNombre}</td>
                      <td className="px-3 py-1.5 text-xs">{r.tipo}</td>
                      <td className="px-3 py-1.5 text-xs text-right">${r.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
