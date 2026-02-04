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
  DialogTrigger,
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

interface ExcelImporterCuentaCorrienteProps {
  onImportComplete?: () => void;
}

interface ClienteRow {
  Cliente: string;
  'Tipo comprobante'?: string;
  'Nro. comprobante'?: string;
  Fecha?: string | number;
  'Fecha comprobante'?: string | number;
  'Fecha vto.'?: string | number;
  Debe?: string | number;
  Haber?: string | number;
  Importe?: string | number;
  Acumulado?: string | number;
  Estado?: string;
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

export function ExcelImporterCuentaCorriente({ onImportComplete }: ExcelImporterCuentaCorrienteProps) {
  const [open, setOpen] = useState(false);
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

  const determinarTipoMovimiento = (row: ClienteRow): { tipo: TipoMovimiento; tipoOriginal: string } | null => {
    const tipoComprobante = row['Tipo comprobante']?.toString().trim().toUpperCase();
    const estado = row.Estado?.toString().trim().toLowerCase();
    
    // Si el estado indica saldo inicial, es saldo inicial
    if (estado && estado.includes('saldo inicial')) {
      return { tipo: 'saldo_inicial', tipoOriginal: 'Saldo inicial' };
    }
    
    if (!tipoComprobante || tipoComprobante === '') {
      return null;
    }
    
    if (tipoComprobante === 'FAC') {
      return { tipo: 'compra', tipoOriginal: 'FAC' };
    }
    if (tipoComprobante === 'REC') {
      return { tipo: 'pago', tipoOriginal: 'REC' };
    }
    if (tipoComprobante === 'NCR') {
      return { tipo: 'nota_credito', tipoOriginal: 'NCR' };
    }
    
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileSelect triggered', e.target.files);
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('File selected:', file.name, file.size);

    setParsing(true);
    setProgress(0);

    try {
      // Simular progreso inicial mientras carga el archivo
      setProgress(10);
      
      const data = await file.arrayBuffer();
      setProgress(30);
      
      const workbook = XLSX.read(data);
      setProgress(50);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ClienteRow>(worksheet);
      setProgress(70);

      const movimientos: MovimientoExcel[] = [];
      const totalRows = jsonData.length;
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
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
          // Para saldo inicial, usar columna Importe
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
          monto: Math.abs(monto) * (monto < 0 ? -1 : 1),
        });

        // Actualizar progreso cada 100 filas
        if (i % 100 === 0) {
          setProgress(70 + Math.round((i / totalRows) * 25));
        }
      }

      setProgress(100);
      setParsedMovimientos(movimientos);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('Error al leer el archivo Excel');
    } finally {
      setParsing(false);
      setProgress(0);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para importar');
      return;
    }

    setImporting(true);
    setProgress(0);
    const importResults: ImportResult[] = [];
    const total = parsedMovimientos.length;
    let processed = 0;

    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, codigo_cliente, nombre');

    const clienteMap = new Map<string, { id: string; nombre: string }>();
    clientes?.forEach(c => {
      if (c.codigo_cliente) {
        clienteMap.set(c.codigo_cliente, { id: c.id, nombre: c.nombre });
      }
    });

    const { data: existingMovimientos } = await supabase
      .from('cliente_movimientos')
      .select('cliente_id, tipo, concepto');

    const clientesSaldoInicial = new Set<string>();
    const conceptosExistentes = new Map<string, Set<string>>();

    existingMovimientos?.forEach(m => {
      if (m.tipo === 'saldo_inicial') {
        clientesSaldoInicial.add(m.cliente_id);
      }
      if (m.concepto) {
        if (!conceptosExistentes.has(m.cliente_id)) {
          conceptosExistentes.set(m.cliente_id, new Set());
        }
        conceptosExistentes.get(m.cliente_id)!.add(m.concepto);
      }
    });

    for (const mov of parsedMovimientos) {
      const cliente = clienteMap.get(mov.clienteCodigo);
      
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
      } else if (mov.tipo === 'saldo_inicial' && clientesSaldoInicial.has(cliente.id)) {
        importResults.push({
          clienteCodigo: mov.clienteCodigo,
          clienteNombre: mov.clienteNombre,
          tipo: mov.tipoOriginal,
          nroComprobante: mov.nroComprobante,
          monto: mov.monto,
          status: 'skipped',
          message: 'Ya tiene saldo inicial'
        });
      } else if (mov.nroComprobante) {
        const clienteConceptos = conceptosExistentes.get(cliente.id);
        const conceptoBuscar = mov.nroComprobante;
        const yaExiste = clienteConceptos && 
          Array.from(clienteConceptos).some(c => c.includes(conceptoBuscar));
        
        if (yaExiste) {
          importResults.push({
            clienteCodigo: mov.clienteCodigo,
            clienteNombre: mov.clienteNombre,
            tipo: mov.tipoOriginal,
            nroComprobante: mov.nroComprobante,
            monto: mov.monto,
            status: 'skipped',
            message: 'Comprobante ya existe'
          });
        } else {
          const concepto = mov.tipo === 'saldo_inicial' 
            ? `Saldo inicial importado${mov.monto < 0 ? ' (a favor)' : ''}`
            : `${mov.tipoOriginal} ${mov.nroComprobante}`;

          const { error } = await supabase
            .from('cliente_movimientos')
            .insert({
              cliente_id: cliente.id,
              tipo: mov.tipo,
              monto: Math.abs(mov.monto),
              concepto,
              estado_imputacion: 'confirmado',
              usuario_registro_id: user.id,
              fecha: mov.fecha || new Date().toISOString().split('T')[0]
            });

          if (error) {
            importResults.push({
              clienteCodigo: mov.clienteCodigo,
              clienteNombre: mov.clienteNombre,
              tipo: mov.tipoOriginal,
              nroComprobante: mov.nroComprobante,
              monto: mov.monto,
              status: 'error',
              message: error.message
            });
          } else {
            if (!conceptosExistentes.has(cliente.id)) {
              conceptosExistentes.set(cliente.id, new Set());
            }
            conceptosExistentes.get(cliente.id)!.add(concepto);
            
            if (mov.tipo === 'saldo_inicial') {
              clientesSaldoInicial.add(cliente.id);
            }

            importResults.push({
              clienteCodigo: mov.clienteCodigo,
              clienteNombre: mov.clienteNombre,
              tipo: mov.tipoOriginal,
              nroComprobante: mov.nroComprobante,
              monto: mov.monto,
              status: 'success',
              message: 'Importado correctamente'
            });
          }
        }
      } else {
        const concepto = `Saldo inicial importado${mov.monto < 0 ? ' (a favor)' : ''}`;

        const { error } = await supabase
          .from('cliente_movimientos')
          .insert({
            cliente_id: cliente.id,
            tipo: mov.tipo,
            monto: Math.abs(mov.monto),
            concepto,
            estado_imputacion: 'confirmado',
            usuario_registro_id: user.id,
            fecha: mov.fecha || new Date().toISOString().split('T')[0]
          });

        if (error) {
          importResults.push({
            clienteCodigo: mov.clienteCodigo,
            clienteNombre: mov.clienteNombre,
            tipo: mov.tipoOriginal,
            nroComprobante: mov.nroComprobante,
            monto: mov.monto,
            status: 'error',
            message: error.message
          });
        } else {
          if (mov.tipo === 'saldo_inicial') {
            clientesSaldoInicial.add(cliente.id);
          }
          importResults.push({
            clienteCodigo: mov.clienteCodigo,
            clienteNombre: mov.clienteNombre,
            tipo: mov.tipoOriginal,
            nroComprobante: mov.nroComprobante,
            monto: mov.monto,
            status: 'success',
            message: 'Importado correctamente'
          });
        }
      }

      processed++;
      setProgress(Math.round((processed / total) * 100));
    }

    setResults(importResults);
    setStep('results');
    setImporting(false);
    
    const successCount = importResults.filter(r => r.status === 'success').length;
    if (successCount > 0) {
      toast.success(`${successCount} movimientos importados correctamente`);
      onImportComplete?.();
    }
  };

  const handleClose = () => {
    if (parsing) return; // No cerrar mientras se procesa
    setOpen(false);
    setStep('upload');
    setParsedMovimientos([]);
    setResults([]);
    setParsing(false);
    setProgress(0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const resumenPorTipo = parsedMovimientos.reduce((acc, m) => {
    acc[m.tipo] = (acc[m.tipo] || 0) + 1;
    return acc;
  }, {} as Record<TipoMovimiento, number>);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Importar Cuenta Corriente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Movimientos de Cuenta Corriente</DialogTitle>
          <DialogDescription>
            Sube el archivo Excel con los movimientos de cuenta corriente para importar.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            {parsing ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-primary/25 bg-primary/5 p-8">
                  <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                    <FileSpreadsheet className="h-10 w-10 text-primary animate-pulse" />
                    <div className="w-full space-y-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-center text-sm text-muted-foreground">
                        Procesando archivo... {progress}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div 
                  className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => {
                    console.log('Container clicked, triggering file input');
                    fileInputRef.current?.click();
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click para seleccionar archivo
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(resumenPorTipo).map(([tipo, count]) => (
                <Badge key={tipo} variant="outline" className={TIPO_COLORS[tipo as TipoMovimiento]}>
                  {TIPO_LABELS[tipo as TipoMovimiento]}: {count}
                </Badge>
              ))}
              <Badge variant="secondary">
                Total: {parsedMovimientos.length}
              </Badge>
            </div>
            
            <ScrollArea className="h-[400px] rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Comprobante</th>
                    <th className="p-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedMovimientos.map((mov, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 font-mono text-xs">{mov.clienteCodigo}</td>
                      <td className="p-2 truncate max-w-[150px]" title={mov.clienteNombre}>
                        {mov.clienteNombre}
                      </td>
                      <td className="p-2 text-xs">{mov.fecha || '-'}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={`text-xs ${TIPO_COLORS[mov.tipo]}`}>
                          {mov.tipoOriginal}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono text-xs">{mov.nroComprobante || '-'}</td>
                      <td className={`p-2 text-right ${mov.tipo === 'compra' || mov.tipo === 'saldo_inicial' ? 'text-destructive' : 'text-primary'}`}>
                        {formatCurrency(mov.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importando...' : 'Confirmar Importación'}
              </Button>
            </div>
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-center text-sm text-muted-foreground">
                  {progress}% completado
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>{results.filter(r => r.status === 'success').length} exitosos</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span>{results.filter(r => r.status === 'skipped').length} omitidos</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>{results.filter(r => r.status === 'error').length} errores</span>
              </div>
            </div>
            <ScrollArea className="h-[400px] rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-2 text-left">Estado</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Comprobante</th>
                    <th className="p-2 text-right">Monto</th>
                    <th className="p-2 text-left">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">
                        {result.status === 'success' && <CheckCircle className="h-4 w-4 text-primary" />}
                        {result.status === 'skipped' && <AlertCircle className="h-4 w-4 text-warning" />}
                        {result.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                      </td>
                      <td className="p-2">
                        <span className="font-mono text-xs">{result.clienteCodigo}</span>
                        <span className="ml-1 text-muted-foreground">{result.clienteNombre}</span>
                      </td>
                      <td className="p-2">{result.tipo}</td>
                      <td className="p-2 font-mono text-xs">{result.nroComprobante || '-'}</td>
                      <td className="p-2 text-right">{formatCurrency(result.monto)}</td>
                      <td className="p-2 text-muted-foreground text-xs">{result.message}</td>
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
