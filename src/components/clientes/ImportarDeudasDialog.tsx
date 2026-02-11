import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ImportarDeudasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ExcelRow {
  fechaEmision: string;
  tipoComprobante: string;
  nroComprobante: string;
  codCliente: string;
  razonSocial: string;
  nombreVendedor: string;
  codDeposito: string;
  importePendiente: number;
}

interface ClienteAgrupado {
  codCliente: string;
  razonSocial: string;
  clienteId: string | null;
  clienteNombre: string | null;
  facturas: ExcelRow[];
  totalDeuda: number;
}

type Step = 'upload' | 'preview' | 'importing' | 'results';

function parseArgentineNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  // Remove dots (thousands separator) and replace comma with dot (decimal)
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDateDMY(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  // Handle dd/mm/yyyy or dd-mm-yyyy
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Handle Excel serial numbers
  if (/^\d+$/.test(str)) {
    const serial = parseInt(str, 10);
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return null;
}

function normalizeCode(code: string): string {
  return String(code).replace(/^0+/, '') || '0';
}

export function ImportarDeudasDialog({ open, onOpenChange, onImportComplete }: ImportarDeudasDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [agrupados, setAgrupados] = useState<ClienteAgrupado[]>([]);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [results, setResults] = useState({ imported: 0, skipped: 0, errors: 0, duplicates: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setRows([]);
    setAgrupados([]);
    setProgress(0);
    setStatusMsg('');
    setResults({ imported: 0, skipped: 0, errors: 0, duplicates: 0 });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMsg('Leyendo archivo...');
    setStep('importing');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      setStatusMsg(`Procesando ${jsonData.length} filas...`);

      const parsed: ExcelRow[] = [];
      for (const raw of jsonData as Record<string, unknown>[]) {
        const fechaKey = Object.keys(raw).find(k => k.toLowerCase().includes('fecha'));
        const tipoKey = Object.keys(raw).find(k => k.toLowerCase().includes('tipo'));
        const nroKey = Object.keys(raw).find(k => k.toLowerCase().includes('nro'));
        const codClienteKey = Object.keys(raw).find(k => k.toLowerCase().includes('cliente'));
        const razonKey = Object.keys(raw).find(k => k.toLowerCase().includes('raz'));
        const vendedorKey = Object.keys(raw).find(k => k.toLowerCase().includes('vendedor'));
        const depositoKey = Object.keys(raw).find(k => k.toLowerCase().includes('dep'));
        const importeKey = Object.keys(raw).find(k => k.toLowerCase().includes('importe') || k.toLowerCase().includes('pendiente'));

        const importe = parseArgentineNumber(importeKey ? raw[importeKey] : 0);
        if (importe <= 0) continue;

        parsed.push({
          fechaEmision: String(fechaKey ? raw[fechaKey] : ''),
          tipoComprobante: String(tipoKey ? raw[tipoKey] : ''),
          nroComprobante: String(nroKey ? raw[nroKey] : ''),
          codCliente: String(codClienteKey ? raw[codClienteKey] : ''),
          razonSocial: String(razonKey ? raw[razonKey] : ''),
          nombreVendedor: String(vendedorKey ? raw[vendedorKey] : ''),
          codDeposito: String(depositoKey ? raw[depositoKey] : ''),
          importePendiente: importe,
        });
      }

      setRows(parsed);
      setStatusMsg('Buscando clientes en la base de datos...');

      // Group by client code
      const grouped = new Map<string, ClienteAgrupado>();
      for (const row of parsed) {
        const code = normalizeCode(row.codCliente);
        if (!grouped.has(code)) {
          grouped.set(code, {
            codCliente: code,
            razonSocial: row.razonSocial,
            clienteId: null,
            clienteNombre: null,
            facturas: [],
            totalDeuda: 0,
          });
        }
        const g = grouped.get(code)!;
        g.facturas.push(row);
        g.totalDeuda += row.importePendiente;
      }

      // Fetch all clients and match by code
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nombre, codigo_cliente');

      if (clientes) {
        const clienteMap = new Map<string, { id: string; nombre: string }>();
        for (const c of clientes) {
          if (c.codigo_cliente) {
            clienteMap.set(normalizeCode(c.codigo_cliente), { id: c.id, nombre: c.nombre });
          }
        }
        for (const [code, group] of grouped) {
          const found = clienteMap.get(code);
          if (found) {
            group.clienteId = found.id;
            group.clienteNombre = found.nombre;
          }
        }
      }

      const sorted = Array.from(grouped.values()).sort((a, b) => {
        if (a.clienteId && !b.clienteId) return -1;
        if (!a.clienteId && b.clienteId) return 1;
        return a.codCliente.localeCompare(b.codCliente, undefined, { numeric: true });
      });

      setAgrupados(sorted);
      setStep('preview');
      setStatusMsg('');
    } catch (error) {
      console.error('Error reading Excel:', error);
      toast.error('Error al leer el archivo Excel');
      setStep('upload');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debe estar autenticado para importar');
      setStep('preview');
      return;
    }

    // Auto-create missing clients
    const sinId = agrupados.filter(g => !g.clienteId);
    if (sinId.length > 0) {
      setStatusMsg(`Creando ${sinId.length} clientes nuevos...`);

      // Fetch/create zones by codDeposito
      const depositoCodes = new Set<string>();
      for (const g of sinId) {
        for (const f of g.facturas) {
          if (f.codDeposito) depositoCodes.add(f.codDeposito);
        }
      }

      const { data: existingZonas } = await supabase
        .from('zonas')
        .select('id, codigo');

      const zonaMap = new Map<string, string>();
      if (existingZonas) {
        for (const z of existingZonas) {
          zonaMap.set(z.codigo, z.id);
        }
      }

      for (const code of depositoCodes) {
        if (!zonaMap.has(code)) {
          const { data: newZona } = await supabase
            .from('zonas')
            .insert({ codigo: code, nombre: `Depósito ${code}` })
            .select('id, codigo')
            .single();
          if (newZona) {
            zonaMap.set(newZona.codigo, newZona.id);
          }
        }
      }

      for (const grupo of sinId) {
        const primerDeposito = grupo.facturas[0]?.codDeposito || '';
        const zonaId = zonaMap.get(primerDeposito) || null;

        const { data: newCliente } = await supabase
          .from('clientes')
          .insert({
            nombre: grupo.razonSocial || `Cliente ${grupo.codCliente}`,
            codigo_cliente: grupo.codCliente,
            zona_id: zonaId,
          })
          .select('id')
          .single();

        if (newCliente) {
          grupo.clienteId = newCliente.id;
          grupo.clienteNombre = grupo.razonSocial;
        }
      }
    }

    const clientesConId = agrupados.filter(g => g.clienteId);
    const totalFacturas = clientesConId.reduce((sum, g) => sum + g.facturas.length, 0);
    let imported = 0;
    let errors = 0;
    let duplicates = 0;
    let processed = 0;

    // Fetch existing comprobantes to detect duplicates
    setStatusMsg('Verificando duplicados...');
    const { data: existingMovs } = await supabase
      .from('cliente_movimientos')
      .select('numero_comprobante, codigo_deposito, cliente_id')
      .eq('tipo', 'compra')
      .not('numero_comprobante', 'is', null);

    const existingSet = new Set<string>();
    if (existingMovs) {
      for (const m of existingMovs) {
        existingSet.add(`${m.cliente_id}|${m.numero_comprobante}|${m.codigo_deposito || ''}`);
      }
    }

    for (const grupo of clientesConId) {
      const batch: Array<Record<string, unknown>> = [];

      for (const factura of grupo.facturas) {
        const key = `${grupo.clienteId}|${factura.nroComprobante}|${factura.codDeposito}`;
        if (existingSet.has(key)) {
          duplicates++;
          processed++;
          continue;
        }

        batch.push({
          cliente_id: grupo.clienteId,
          tipo: 'compra',
          monto: factura.importePendiente,
          concepto: factura.tipoComprobante || null,
          numero_comprobante: factura.nroComprobante || null,
          codigo_deposito: factura.codDeposito || null,
          nombre_vendedor: factura.nombreVendedor || null,
          fecha: parseDateDMY(factura.fechaEmision) || new Date().toISOString().split('T')[0],
          estado_imputacion: 'confirmado',
          usuario_registro_id: user.id,
        });
      }

      // Insert in batches of 100
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const { error } = await supabase
          .from('cliente_movimientos')
          .insert(chunk as any);

        if (error) {
          console.error('Error inserting batch:', error);
          errors += chunk.length;
        } else {
          imported += chunk.length;
        }
        processed += chunk.length;
        setProgress(Math.round((processed / totalFacturas) * 100));
        setStatusMsg(`Importando... ${processed} de ${totalFacturas} facturas`);

        await new Promise(r => setTimeout(r, 50));
      }
    }

    const skipped = agrupados.filter(g => !g.clienteId).reduce((sum, g) => sum + g.facturas.length, 0);

    setResults({ imported, skipped, errors, duplicates });
    setStep('results');
    setStatusMsg('');

    if (imported > 0) {
      onImportComplete?.();
    }
  };

  const encontrados = agrupados.filter(g => g.clienteId).length;
  const noEncontrados = agrupados.filter(g => !g.clienteId).length;
  const totalFacturasPreview = rows.length;
  const totalMonto = agrupados.reduce((s, g) => s + g.totalDeuda, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Facturas Adeudadas
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Seleccioná un archivo Excel con las columnas:<br />
              Fecha de emisión, Tipo comprobante, Nro. comprobante, Cód. cliente,<br />
              Razón social, Nombre Vendedor, Cód. Depósito, Importe Pendiente (CTE)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Seleccionar Archivo
            </Button>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{statusMsg}</p>
            {progress > 0 && <Progress value={progress} className="w-64" />}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Clientes encontrados</p>
                <p className="text-lg font-bold text-green-600">{encontrados}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">No encontrados</p>
                <p className="text-lg font-bold text-destructive">{noEncontrados}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Total facturas</p>
                <p className="text-lg font-bold">{totalFacturasPreview}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Monto total</p>
                <p className="text-lg font-bold">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {noEncontrados > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {noEncontrados} cliente(s) no encontrados. Se crearán automáticamente al importar, usando el código de depósito como zona.
              </div>
            )}

            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Facturas</TableHead>
                    <TableHead className="text-right">Deuda Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agrupados.slice(0, 100).map((g, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{g.codCliente}</TableCell>
                      <TableCell className="text-sm">
                        {g.clienteNombre || g.razonSocial}
                      </TableCell>
                      <TableCell>
                        {g.clienteId ? (
                          <Badge variant="default" className="bg-green-600">Encontrado</Badge>
                        ) : (
                          <Badge variant="destructive">No encontrado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{g.facturas.length}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${g.totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {agrupados.length > 100 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Mostrando 100 de {agrupados.length} clientes
                </p>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { reset(); }}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={agrupados.length === 0}>
                Importar {agrupados.length} cliente(s) ({noEncontrados > 0 ? `${noEncontrados} se crearán` : 'todos encontrados'})
              </Button>
            </div>
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-lg font-semibold">Importación completada</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Importadas</p>
                <p className="text-lg font-bold text-green-600">{results.imported}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Duplicadas (omitidas)</p>
                <p className="text-lg font-bold text-yellow-600">{results.duplicates}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Sin cliente</p>
                <p className="text-lg font-bold text-muted-foreground">{results.skipped}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Errores</p>
                <p className="text-lg font-bold text-destructive">{results.errors}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { reset(); onOpenChange(false); }}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
