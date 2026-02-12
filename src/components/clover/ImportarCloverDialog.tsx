import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface CloverRow {
  fecha_pago: string;
  pago_id_clover: string;
  factura_numero: string;
  codigo_autorizacion: string;
  numero_transaccion: string;
  medio_pago: string;
  marca_tarjeta: string;
  numero_tarjeta: string;
  moneda: string;
  importe: number;
  importe_impuestos: number;
  importe_propinas: number;
  nombre_cliente_clover: string;
  numero_cuotas: number | null;
  terminal_id: string;
  numero_lote: string;
  numero_recibo: string;
  resultado: string;
  dispositivo: string;
  importe_devolucion: number;
}

function parseCloverDate(dateStr: string): string {
  // Format: "23-Jan-2026 08:57 PM ART"
  try {
    const cleaned = dateStr.replace(/\s+ART$/, '').trim();
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) {
      // Try manual parse
      const match = cleaned.match(/(\d{1,2})-(\w{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
      if (match) {
        const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
        let hour = parseInt(match[4]);
        if (match[6].toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (match[6].toUpperCase() === 'AM' && hour === 12) hour = 0;
        const d = new Date(parseInt(match[3]), months[match[2]] ?? 0, parseInt(match[1]), hour, parseInt(match[5]));
        return d.toISOString();
      }
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function ImportarCloverDialog({ open, onOpenChange, onImportComplete }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [preview, setPreview] = useState<CloverRow[]>([]);
  const [allRows, setAllRows] = useState<CloverRow[]>([]);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errors: number } | null>(null);
  const [fileName, setFileName] = useState('');

  const resetState = () => {
    setPreview([]);
    setAllRows([]);
    setResult(null);
    setProgress(0);
    setStatusMessage('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);
    setProcessing(true);
    setStatusMessage('Leyendo archivo...');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      
      if (lines.length < 2) {
        toast.error('El archivo no contiene datos');
        setProcessing(false);
        return;
      }

      // Detect separator (semicolon for Clover exports)
      const separator = lines[0].includes(';') ? ';' : ',';
      const headers = parseCSVLine(lines[0], separator);

      setStatusMessage(`Procesando ${lines.length - 1} filas...`);

      const rows: CloverRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], separator);
        if (cols.length < 10) continue;

        rows.push({
          fecha_pago: cols[0] || '',
          pago_id_clover: cols[1] || '',
          factura_numero: cols[3] || '',
          codigo_autorizacion: cols[4] || '',
          numero_transaccion: cols[5] || '',
          medio_pago: cols[7] || '',
          marca_tarjeta: cols[8] || '',
          numero_tarjeta: cols[9] || '',
          moneda: cols[11] || 'ARS',
          importe: parseFloat(cols[12]?.replace(',', '.') || '0'),
          importe_impuestos: parseFloat(cols[13]?.replace(',', '.') || '0'),
          importe_propinas: parseFloat(cols[14]?.replace(',', '.') || '0'),
          nombre_cliente_clover: cols[16] || '',
          numero_cuotas: cols[17] ? parseInt(cols[17]) : null,
          terminal_id: cols[19] || '',
          numero_lote: cols[20] || '',
          numero_recibo: cols[21] || '',
          resultado: cols[29] || '',
          dispositivo: cols[30] || '',
          importe_devolucion: parseFloat(cols[33]?.replace(',', '.') || '0'),
        });

        if (i % 500 === 0) {
          setProgress(Math.round((i / (lines.length - 1)) * 50));
          await new Promise(r => setTimeout(r, 0));
        }
      }

      setAllRows(rows);
      setPreview(rows.slice(0, 20));
      setStatusMessage(`${rows.length} pagos listos para importar`);
      setProgress(50);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Error al leer el archivo CSV');
    } finally {
      setProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!user || allRows.length === 0) return;

    setProcessing(true);
    setStatusMessage('Verificando duplicados...');

    try {
      // Get existing pago IDs to avoid duplicates
      const existingIds = new Set<string>();
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await supabase
          .from('clover_pagos')
          .select('pago_id_clover')
          .range(from, from + batchSize - 1);
        if (!data || data.length === 0) break;
        data.forEach(d => existingIds.add(d.pago_id_clover));
        if (data.length < batchSize) break;
        from += batchSize;
      }

      // Also try to auto-match terminal_id to clients
      const { data: clientesConTerminal } = await supabase
        .from('clientes')
        .select('id, numero_terminal_clover')
        .not('numero_terminal_clover', 'is', null);

      const terminalToCliente = new Map<string, string>();
      clientesConTerminal?.forEach(c => {
        if (c.numero_terminal_clover) {
          terminalToCliente.set(c.numero_terminal_clover, c.id);
        }
      });

      const newRows = allRows.filter(r => !existingIds.has(r.pago_id_clover));
      const duplicates = allRows.length - newRows.length;

      setStatusMessage(`Importando ${newRows.length} pagos nuevos (${duplicates} duplicados omitidos)...`);

      let imported = 0;
      let errors = 0;
      const insertBatchSize = 50;

      for (let i = 0; i < newRows.length; i += insertBatchSize) {
        const batch = newRows.slice(i, i + insertBatchSize).map(row => ({
          fecha_pago: parseCloverDate(row.fecha_pago),
          pago_id_clover: row.pago_id_clover,
          factura_numero: row.factura_numero || null,
          codigo_autorizacion: row.codigo_autorizacion || null,
          numero_transaccion: row.numero_transaccion || null,
          medio_pago: row.medio_pago || null,
          marca_tarjeta: row.marca_tarjeta || null,
          numero_tarjeta: row.numero_tarjeta || null,
          moneda: row.moneda || 'ARS',
          importe: row.importe,
          importe_impuestos: row.importe_impuestos,
          importe_propinas: row.importe_propinas,
          nombre_cliente_clover: row.nombre_cliente_clover || null,
          numero_cuotas: row.numero_cuotas,
          terminal_id: row.terminal_id || null,
          numero_lote: row.numero_lote || null,
          numero_recibo: row.numero_recibo || null,
          resultado: row.resultado || null,
          dispositivo: row.dispositivo || null,
          importe_devolucion: row.importe_devolucion,
          cliente_id: row.terminal_id ? (terminalToCliente.get(row.terminal_id) || null) : null,
          usuario_importacion_id: user.id,
        }));

        const { error } = await supabase.from('clover_pagos').insert(batch);
        if (error) {
          console.error('Batch insert error:', error);
          errors += batch.length;
        } else {
          imported += batch.length;
        }

        setProgress(50 + Math.round((i / newRows.length) * 50));
        setStatusMessage(`Importando... ${imported} de ${newRows.length}`);
        await new Promise(r => setTimeout(r, 0));
      }

      setResult({ imported, duplicates, errors });
      setProgress(100);
      setStatusMessage('Importación completada');
      toast.success(`${imported} pagos importados correctamente`);
      onImportComplete();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Error durante la importación');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!processing) { onOpenChange(v); if (!v) resetState(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Importar Pagos Clover
          </DialogTitle>
          <DialogDescription>
            Importar archivo CSV exportado desde Clover con los pagos de la terminal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          {!result && (
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Seleccionar CSV
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {fileName}
                </span>
              )}
            </div>
          )}

          {/* Progress */}
          {(processing || progress > 0) && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !result && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Vista previa ({allRows.length} registros)</h4>
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead>Tarjeta</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead>Terminal</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{row.fecha_pago.substring(0, 20)}</TableCell>
                        <TableCell className="text-xs">{row.medio_pago}</TableCell>
                        <TableCell className="text-xs">{row.marca_tarjeta}</TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          ${row.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{row.terminal_id}</TableCell>
                        <TableCell>
                          <Badge variant={row.resultado === 'SUCCESS' ? 'default' : 'destructive'} className="text-xs">
                            {row.resultado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <Button onClick={handleImport} disabled={processing}>
                <Upload className="mr-2 h-4 w-4" />
                Importar {allRows.length} pagos
              </Button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Importación completada</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Importados</p>
                  <p className="text-lg font-bold text-primary">{result.imported}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duplicados</p>
                  <p className="text-lg font-bold text-muted-foreground">{result.duplicates}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Errores</p>
                  <p className="text-lg font-bold text-destructive">{result.errors}</p>
                </div>
              </div>
              <Button variant="outline" onClick={resetState}>
                Importar otro archivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
