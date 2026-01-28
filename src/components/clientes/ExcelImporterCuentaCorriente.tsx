import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportResult {
  clienteCodigo: string;
  clienteNombre: string;
  saldo: number;
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
  Debe?: string | number;
  Haber?: string | number;
  Acumulado?: string | number;
  'Saldo inicial'?: string | number;
  Estado?: string;
}

export function ExcelImporterCuentaCorriente({ onImportComplete }: ExcelImporterCuentaCorrienteProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'results'>('upload');
  const [parsedData, setParsedData] = useState<Map<string, { codigo: string; nombre: string; saldo: number }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const parseNumber = (value: string | number | undefined): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value;
    // Handle Argentine format: 96,053.22 or -5,000.00
    const cleaned = value.toString().replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  const extractClienteCode = (clienteStr: string): { codigo: string; nombre: string } | null => {
    if (!clienteStr) return null;
    // Format: "010 - PANADERIA BUHO"
    const parts = clienteStr.split(' - ');
    if (parts.length >= 2) {
      return {
        codigo: parts[0].trim(),
        nombre: parts.slice(1).join(' - ').trim()
      };
    }
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ClienteRow>(worksheet);

      // Group by client and get the last accumulated balance
      const clienteBalances = new Map<string, { codigo: string; nombre: string; saldo: number }>();
      
      for (const row of jsonData) {
        if (!row.Cliente) continue;
        
        const clienteInfo = extractClienteCode(row.Cliente);
        if (!clienteInfo) continue;

        const acumulado = parseNumber(row.Acumulado);
        
        // Always update with the latest accumulated value (last row wins)
        clienteBalances.set(clienteInfo.codigo, {
          codigo: clienteInfo.codigo,
          nombre: clienteInfo.nombre,
          saldo: acumulado
        });
      }

      setParsedData(clienteBalances);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('Error al leer el archivo Excel');
    }

    // Reset file input
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
    const total = parsedData.size;
    let processed = 0;

    // Fetch all clients with their codes
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, codigo_cliente, nombre');

    const clienteMap = new Map<string, { id: string; nombre: string }>();
    clientes?.forEach(c => {
      if (c.codigo_cliente) {
        clienteMap.set(c.codigo_cliente, { id: c.id, nombre: c.nombre });
      }
    });

    // Check for existing saldo_inicial movements
    const { data: existingMovimientos } = await supabase
      .from('cliente_movimientos')
      .select('cliente_id')
      .eq('tipo', 'saldo_inicial');

    const clientesWithSaldoInicial = new Set(existingMovimientos?.map(m => m.cliente_id) || []);

    for (const [codigo, data] of parsedData) {
      const cliente = clienteMap.get(codigo);
      
      if (!cliente) {
        importResults.push({
          clienteCodigo: codigo,
          clienteNombre: data.nombre,
          saldo: data.saldo,
          status: 'error',
          message: 'Cliente no encontrado en la base de datos'
        });
      } else if (clientesWithSaldoInicial.has(cliente.id)) {
        importResults.push({
          clienteCodigo: codigo,
          clienteNombre: data.nombre,
          saldo: data.saldo,
          status: 'skipped',
          message: 'Ya tiene saldo inicial importado'
        });
      } else if (data.saldo === 0) {
        importResults.push({
          clienteCodigo: codigo,
          clienteNombre: data.nombre,
          saldo: data.saldo,
          status: 'skipped',
          message: 'Saldo es cero'
        });
      } else {
        // Insert saldo_inicial movement
        const { error } = await supabase
          .from('cliente_movimientos')
          .insert({
            cliente_id: cliente.id,
            tipo: 'saldo_inicial',
            monto: Math.abs(data.saldo),
            concepto: `Saldo inicial importado${data.saldo < 0 ? ' (a favor del cliente)' : ''}`,
            estado_imputacion: 'confirmado',
            usuario_registro_id: user.id,
            fecha: new Date().toISOString().split('T')[0]
          });

        if (error) {
          importResults.push({
            clienteCodigo: codigo,
            clienteNombre: data.nombre,
            saldo: data.saldo,
            status: 'error',
            message: error.message
          });
        } else {
          importResults.push({
            clienteCodigo: codigo,
            clienteNombre: data.nombre,
            saldo: data.saldo,
            status: 'success',
            message: 'Saldo inicial importado correctamente'
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
      toast.success(`${successCount} saldos iniciales importados correctamente`);
      onImportComplete?.();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep('upload');
    setParsedData(new Map());
    setResults([]);
    setProgress(0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Importar Cuenta Corriente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Saldos de Cuenta Corriente</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube el archivo Excel de cuenta corriente. Se importará el saldo acumulado final de cada cliente.
            </p>
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8">
              <label className="flex cursor-pointer flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click para seleccionar archivo
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se encontraron <strong>{parsedData.size}</strong> clientes con saldos para importar.
            </p>
            <ScrollArea className="h-[300px] rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Nombre</th>
                    <th className="p-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(parsedData.entries()).map(([codigo, data]) => (
                    <tr key={codigo} className="border-b">
                      <td className="p-2">{codigo}</td>
                      <td className="p-2">{data.nombre}</td>
                      <td className={`p-2 text-right ${data.saldo < 0 ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(data.saldo)}
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
            <ScrollArea className="h-[300px] rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-2 text-left">Estado</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-right">Saldo</th>
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
                        <span className="font-medium">{result.clienteCodigo}</span>
                        <span className="ml-2 text-muted-foreground">{result.clienteNombre}</span>
                      </td>
                      <td className="p-2 text-right">{formatCurrency(result.saldo)}</td>
                      <td className="p-2 text-muted-foreground">{result.message}</td>
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
