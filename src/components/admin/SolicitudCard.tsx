import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, User, Percent, DollarSign, Clock } from 'lucide-react';
import type { SolicitudConVendedor } from '@/hooks/useSolicitudesDescuento';

interface SolicitudCardProps {
  solicitud: SolicitudConVendedor;
  onAprobar: (id: string) => Promise<void>;
  onRechazar: (id: string) => Promise<void>;
  isProcessing: boolean;
}

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expirada';

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(amount);
}

export function SolicitudCard({ solicitud, onAprobar, onRechazar, isProcessing }: SolicitudCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(formatTimeRemaining(solicitud.expira_en));
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const expiry = new Date(solicitud.expira_en);
      
      if (now >= expiry) {
        setIsExpired(true);
        setTimeRemaining('Expirada');
        clearInterval(interval);
      } else {
        setTimeRemaining(formatTimeRemaining(solicitud.expira_en));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [solicitud.expira_en]);

  if (isExpired) {
    return null;
  }

  return (
    <Card className="bg-card border-border/50 shadow-lg">
      <CardContent className="p-4 space-y-4">
        {/* Vendedor */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{solicitud.vendedor_nombre}</p>
            <p className="text-xs text-muted-foreground">Vendedor</p>
          </div>
        </div>

        {/* Detalles */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Percent className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-lg font-bold text-foreground">{solicitud.porcentaje_solicitado}%</p>
              <p className="text-xs text-muted-foreground">Descuento</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <DollarSign className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-lg font-bold text-foreground">{formatCurrency(solicitud.monto_venta)}</p>
              <p className="text-xs text-muted-foreground">Venta</p>
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <Clock className="h-4 w-4 text-destructive" />
          <span className="text-sm font-mono font-bold text-destructive">
            Expira en: {timeRemaining}
          </span>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <Button
            onClick={() => onAprobar(solicitud.id)}
            disabled={isProcessing}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            Aprobar
          </Button>
          <Button
            onClick={() => onRechazar(solicitud.id)}
            disabled={isProcessing}
            variant="destructive"
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Rechazar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
