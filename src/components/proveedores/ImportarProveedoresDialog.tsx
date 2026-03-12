import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface RowData {
  codigo_proveedor: string;
  razon_social: string;
  contacto: string;
  telefono: string;
}

export default function ImportarProveedoresDialog({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<RowData[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const { toast } = useToast();

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
        codigo_proveedor: String(r['Cód. proveedor'] || r['Código'] || r['codigo_proveedor'] || '').trim(),
        razon_social: String(r['Razón social'] || r['razon_social'] || r['Nombre'] || '').trim(),
        contacto: String(r['Contacto habitual'] || r['contacto'] || r['Contacto'] || '').trim(),
        telefono: String(r['Teléfono del Contacto'] || r['telefono'] || r['Teléfono'] || '').trim(),
      })).filter(r => r.razon_social);

      setRows(mapped);
      setStatus(`${mapped.length} proveedores encontrados`);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setImporting(true);
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('proveedores').upsert(
        batch.map(r => ({
          codigo_proveedor: r.codigo_proveedor,
          razon_social: r.razon_social,
          contacto: r.contacto === 'Contacto' || !r.contacto ? null : r.contacto,
          telefono: !r.telefono || r.telefono === '0' ? null : r.telefono,
        })) as any,
        { onConflict: 'codigo_proveedor' }
      );

      if (error) {
        toast({ title: 'Error en lote', description: error.message, variant: 'destructive' });
      }
      imported += batch.length;
      setProgress(Math.round((imported / rows.length) * 100));
      setStatus(`Importando ${imported} de ${rows.length}...`);
      await new Promise(r => setTimeout(r, 50));
    }

    toast({ title: 'Importación completada', description: `${imported} proveedores procesados` });
    setImporting(false);
    onImported();
    onOpenChange(false);
    setRows([]);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Importar Proveedores desde Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={importing} />
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>

          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          {importing && <Progress value={progress} />}

          {rows.length > 0 && (
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Teléfono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.codigo_proveedor}</TableCell>
                      <TableCell>{r.razon_social}</TableCell>
                      <TableCell>{r.contacto}</TableCell>
                      <TableCell>{r.telefono}</TableCell>
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
            {importing ? 'Importando...' : `Importar ${rows.length} proveedores`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
