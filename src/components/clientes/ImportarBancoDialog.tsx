import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ImportarBancoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FilaBanco {
  fecha: string;
  descripcion: string;
  monto: number;
  referencia: string;
}

interface ResultadoCruce {
  tipo: 'matcheada' | 'no_encontrada' | 'sin_match_banco';
  filaBanco?: FilaBanco;
  movimiento?: {
    id: string;
    cliente_nombre: string;
    monto: number;
    numero_operacion: string;
    fecha: string;
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export function ImportarBancoDialog({ open, onOpenChange, onSuccess }: ImportarBancoDialogProps) {
  const [paso, setPaso] = useState<'upload' | 'mapeo' | 'resultados'>('upload');
  const [filas, setFilas] = useState<any[]>([]);
  const [columnas, setColumnas] = useState<string[]>([]);
  const [mapeo, setMapeo] = useState({ fecha: '', descripcion: '', monto: '', referencia: '' });
  const [resultados, setResultados] = useState<ResultadoCruce[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (jsonData.length === 0) {
        toast.error('El archivo está vacío');
        return;
      }

      const cols = Object.keys(jsonData[0] as object);
      setColumnas(cols);
      setFilas(jsonData);

      // Auto-detect columns
      const autoMapeo = { fecha: '', descripcion: '', monto: '', referencia: '' };
      for (const col of cols) {
        const lower = col.toLowerCase().trim();
        if (lower.includes('fecha')) autoMapeo.fecha = col;
        else if (lower.includes('descr') || lower.includes('concepto') || lower.includes('detalle')) autoMapeo.descripcion = col;
        else if (lower.includes('monto') || lower.includes('importe') || lower.includes('credito') || lower.includes('crédito')) autoMapeo.monto = col;
        else if (lower.includes('refer') || lower.includes('operac') || lower.includes('nro') || lower.includes('comprobante')) autoMapeo.referencia = col;
      }
      setMapeo(autoMapeo);
      setPaso('mapeo');
    };
    reader.readAsBinaryString(file);
  };

  const ejecutarCruce = async () => {
    if (!mapeo.referencia || !mapeo.monto) {
      toast.error('Debe mapear al menos las columnas de referencia y monto');
      return;
    }

    setProcessing(true);
    try {
      // Parse bank rows
      const filasBanco: FilaBanco[] = filas
        .map(f => ({
          fecha: String(f[mapeo.fecha] || ''),
          descripcion: String(f[mapeo.descripcion] || ''),
          monto: parseFloat(String(f[mapeo.monto]).replace(/[^0-9.,\-]/g, '').replace(',', '.')) || 0,
          referencia: String(f[mapeo.referencia] || '').trim(),
        }))
        .filter(f => f.referencia && f.monto > 0);

      // Fetch all transferencias with numero_operacion from system
      const { data: transferencias, error } = await supabase
        .from('cliente_movimientos')
        .select('id, monto, numero_operacion, fecha, cliente_id')
        .eq('tipo', 'pago')
        .not('numero_operacion', 'is', null)
        .neq('numero_operacion', '');

      if (error) throw error;

      // Get client names
      const clienteIds = [...new Set((transferencias || []).map(t => t.cliente_id))];
      const { data: clientes } = clienteIds.length > 0
        ? await supabase.from('clientes').select('id, nombre').in('id', clienteIds)
        : { data: [] };
      const clienteMap = new Map((clientes || []).map(c => [c.id, c.nombre]));

      // Build map of system transfers by numero_operacion
      const transMap = new Map<string, typeof transferencias[0]>();
      for (const t of (transferencias || [])) {
        if (t.numero_operacion) transMap.set(t.numero_operacion.trim(), t);
      }

      const results: ResultadoCruce[] = [];
      const matchedOps = new Set<string>();

      // Match bank rows to system transfers
      for (const fila of filasBanco) {
        const match = transMap.get(fila.referencia);
        if (match) {
          matchedOps.add(fila.referencia);
          results.push({
            tipo: 'matcheada',
            filaBanco: fila,
            movimiento: {
              id: match.id,
              cliente_nombre: clienteMap.get(match.cliente_id) || 'Desconocido',
              monto: match.monto,
              numero_operacion: match.numero_operacion!,
              fecha: match.fecha || '',
            },
          });
        } else {
          results.push({ tipo: 'no_encontrada', filaBanco: fila });
        }
      }

      // System transfers not found in bank
      for (const t of (transferencias || [])) {
        if (t.numero_operacion && !matchedOps.has(t.numero_operacion.trim())) {
          results.push({
            tipo: 'sin_match_banco',
            movimiento: {
              id: t.id,
              cliente_nombre: clienteMap.get(t.cliente_id) || 'Desconocido',
              monto: t.monto,
              numero_operacion: t.numero_operacion!,
              fecha: t.fecha || '',
            },
          });
        }
      }

      setResultados(results);
      setPaso('resultados');
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar el cruce');
    } finally {
      setProcessing(false);
    }
  };

  const matcheadas = resultados.filter(r => r.tipo === 'matcheada');
  const noEncontradas = resultados.filter(r => r.tipo === 'no_encontrada');
  const sinMatchBanco = resultados.filter(r => r.tipo === 'sin_match_banco');

  const handleClose = () => {
    setPaso('upload');
    setFilas([]);
    setColumnas([]);
    setMapeo({ fecha: '', descripcion: '', monto: '', referencia: '' });
    setResultados([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Extracto Bancario - Cruce de Transferencias</DialogTitle>
        </DialogHeader>

        {paso === 'upload' && (
          <div className="space-y-4 py-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Seleccione el archivo Excel o CSV del extracto bancario</p>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="max-w-xs mx-auto" />
            </div>
          </div>
        )}

        {paso === 'mapeo' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se encontraron {filas.length} filas. Mapee las columnas del archivo a los campos esperados:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['fecha', 'descripcion', 'monto', 'referencia'] as const).map(campo => (
                <div key={campo} className="space-y-1">
                  <Label className="text-xs capitalize">{campo === 'referencia' ? 'Nro. Operación / Referencia *' : campo === 'monto' ? 'Monto *' : campo}</Label>
                  <Select value={mapeo[campo]} onValueChange={v => setMapeo({ ...mapeo, [campo]: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- No mapear --</SelectItem>
                      {columnas.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {filas.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Vista previa: {Object.entries(filas[0] as object).map(([k, v]) => `${k}: ${v}`).join(' | ')}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPaso('upload')}>Volver</Button>
              <Button onClick={ejecutarCruce} disabled={processing}>
                {processing ? 'Procesando...' : 'Ejecutar Cruce'}
              </Button>
            </div>
          </div>
        )}

        {paso === 'resultados' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-primary/10 text-center">
                <CheckCircle className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{matcheadas.length}</p>
                <p className="text-xs text-muted-foreground">Coincidentes</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 text-center">
                <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                <p className="text-2xl font-bold">{noEncontradas.length}</p>
                <p className="text-xs text-muted-foreground">No encontradas en sistema</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/10 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-warning" />
                <p className="text-2xl font-bold">{sinMatchBanco.length}</p>
                <p className="text-xs text-muted-foreground">En sistema sin match bancario</p>
              </div>
            </div>

            <Tabs defaultValue="matcheadas">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="matcheadas">Coincidentes ({matcheadas.length})</TabsTrigger>
                <TabsTrigger value="no_encontradas">Sin match ({noEncontradas.length})</TabsTrigger>
                <TabsTrigger value="sin_banco">Sin banco ({sinMatchBanco.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="matcheadas">
                <ScrollArea className="h-[300px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referencia</TableHead>
                        <TableHead>Monto Banco</TableHead>
                        <TableHead>Monto Sistema</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matcheadas.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{r.filaBanco?.referencia}</TableCell>
                          <TableCell>{formatCurrency(r.filaBanco?.monto || 0)}</TableCell>
                          <TableCell>{formatCurrency(r.movimiento?.monto || 0)}</TableCell>
                          <TableCell>{r.movimiento?.cliente_nombre}</TableCell>
                          <TableCell>
                            {Math.abs((r.filaBanco?.monto || 0) - (r.movimiento?.monto || 0)) < 0.01 ? (
                              <Badge variant="default">OK</Badge>
                            ) : (
                              <Badge variant="destructive">Diferencia</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="no_encontradas">
                <ScrollArea className="h-[300px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referencia</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {noEncontradas.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{r.filaBanco?.referencia}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{r.filaBanco?.descripcion}</TableCell>
                          <TableCell>{formatCurrency(r.filaBanco?.monto || 0)}</TableCell>
                          <TableCell>{r.filaBanco?.fecha}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="sin_banco">
                <ScrollArea className="h-[300px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nro. Operación</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sinMatchBanco.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{r.movimiento?.numero_operacion}</TableCell>
                          <TableCell>{r.movimiento?.cliente_nombre}</TableCell>
                          <TableCell>{formatCurrency(r.movimiento?.monto || 0)}</TableCell>
                          <TableCell>{r.movimiento?.fecha}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
