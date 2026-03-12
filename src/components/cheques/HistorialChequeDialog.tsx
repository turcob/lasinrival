import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Cheque, ChequeHistorial, ChequeEstado } from '@/hooks/useCheques';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

const ESTADO_LABELS: Record<ChequeEstado, string> = {
  en_cartera: 'En Cartera',
  depositado: 'Depositado',
  cobrado: 'Cobrado',
  rechazado: 'Rechazado',
  endosado: 'Endosado',
  vencido: 'Vencido',
  anulado: 'Anulado',
};

const ESTADO_COLORS: Record<ChequeEstado, string> = {
  en_cartera: 'bg-blue-100 text-blue-800',
  depositado: 'bg-amber-100 text-amber-800',
  cobrado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
  endosado: 'bg-purple-100 text-purple-800',
  vencido: 'bg-orange-100 text-orange-800',
  anulado: 'bg-gray-100 text-gray-800',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: Cheque | null;
  fetchHistorial: (chequeId: string) => Promise<ChequeHistorial[]>;
}

export function HistorialChequeDialog({ open, onOpenChange, cheque, fetchHistorial }: Props) {
  const [historial, setHistorial] = useState<ChequeHistorial[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && cheque) {
      setLoading(true);
      fetchHistorial(cheque.id).then(data => {
        setHistorial(data);
        setLoading(false);
      });
    }
  }, [open, cheque]);

  if (!cheque) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial - Cheque #{cheque.numero_cheque}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-muted p-3 text-sm mb-4">
          <p><span className="font-medium">Emisor:</span> {cheque.emisor}</p>
          <p><span className="font-medium">Banco:</span> {cheque.banco}</p>
          <p><span className="font-medium">Monto:</span> ${Number(cheque.monto).toLocaleString()}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin historial</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {historial.map(h => (
              <div key={h.id} className="flex items-start gap-3 border-l-2 border-primary/20 pl-4 py-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.estado_anterior && (
                      <>
                        <Badge variant="outline" className={ESTADO_COLORS[h.estado_anterior]}>
                          {ESTADO_LABELS[h.estado_anterior]}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    )}
                    <Badge variant="outline" className={ESTADO_COLORS[h.estado_nuevo]}>
                      {ESTADO_LABELS[h.estado_nuevo]}
                    </Badge>
                  </div>
                  {h.observaciones && (
                    <p className="text-sm text-muted-foreground mt-1">{h.observaciones}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
