import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface RowData {
  fecha_vencimiento: string;
  tipo_comprobante: string;
  numero_comprobante: string;
  fecha_emision: string;
  razon_social: string;
  total_pendiente: number;
}

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  // Try M/D/YY or M/D/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    let [m, d, y] = parts;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(cleaned) || 0;
}

export default function ImportarCuentaCorrienteDialog({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<RowData[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Leyendo archivo...');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws);

      const mapped: RowData[] = json.map((r: any) => ({
        fecha_vencimiento: parseExcelDate(r['Fecha de vencimiento']) || '',
        tipo_comprobante: String(r['Tipo de comprobante'] || '').trim(),
        numero_comprobante: String(r['Nro. Comprobante'] || r['Nro. comprobante'] || '').trim(),
        fecha_emision: parseExcelDate(r['Fecha de emisión'] || r['Fecha de emision']) || '',
        razon_social: String(r['Razón social'] || r['Razon social'] || '').trim(),
        total_pendiente: parseNumber(r['Total Pendiente (CTE)'] || r['Total Pendiente']),
      })).filter(r => r.razon_social && r.total_pendiente);

      setRows(mapped);
      setStatus(`${mapped.length} comprobantes encontrados`);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setImporting(true);
    
    // Get all proveedores to match by razon_social
    const { data: proveedores } = await supabase.from('proveedores').select('id, razon_social');
    const provMap = new Map<string, string>();
    (proveedores as any[])?.forEach(p => provMap.set(p.razon_social.toUpperCase(), p.id));

    let imported = 0;
    let skipped = 0;
    const batchSize = 50;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const toInsert: any[] = [];

      for (const r of batch) {
        const provId = provMap.get(r.razon_social.toUpperCase());
        if (!provId) { skipped++; continue; }
        toInsert.push({
          proveedor_id: provId,
          tipo: 'factura',
          tipo_comprobante: r.tipo_comprobante,
          numero_comprobante: r.numero_comprobante,
          fecha_emision: r.fecha_emision || null,
          fecha_vencimiento: r.fecha_vencimiento || null,
          monto: r.total_pendiente,
          saldo_pendiente: r.total_pendiente,
          usuario_registro_id: user?.id,
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('proveedor_movimientos').insert(toInsert);
        if (error) {
          toast({ title: 'Error en lote', description: error.message, variant: 'destructive' });
        }
      }

      imported += toInsert.length;
      setProgress(Math.round(((i + batch.length) / rows.length) * 100));
      setStatus(`Procesando ${i + batch.length} de ${rows.length}...`);
      await new Promise(r => setTimeout(r, 50));
    }

    toast({
      title: 'Importación completada',
      description: `${imported} comprobantes importados${skipped > 0 ? `, ${skipped} omitidos (proveedor no encontrado)` : ''}`,
    });
    setImporting(false);
    onImported();
    onOpenChange(false);
    setRows([]);
    setProgress(0);
  };

  const formatMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Importar Cuenta Corriente Proveedores</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={importing} />
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>

          <p className="text-xs text-muted-foreground">
            Primero importá los proveedores para que se puedan asociar los comprobantes correctamente.
          </p>

          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          {importing && <Progress value={progress} />}

          {rows.length > 0 && (
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nro. Comprobante</TableHead>
                    <TableHead>Emisión</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.fecha_vencimiento}</TableCell>
                      <TableCell>{r.tipo_comprobante}</TableCell>
                      <TableCell className="font-mono text-xs">{r.numero_comprobante}</TableCell>
                      <TableCell>{r.fecha_emision}</TableCell>
                      <TableCell>{r.razon_social}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.total_pendiente)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 100 && <p className="text-xs text-center py-2 text-muted-foreground">Mostrando 100 de {rows.length}</p>}
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setRows([]); }}>Cancelar</Button>
          <Button onClick={handleImport} disabled={importing || rows.length === 0}>
            {importing ? 'Importando...' : `Importar ${rows.length} comprobantes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
