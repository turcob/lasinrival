import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Clock, CheckCircle, XCircle, Send } from 'lucide-react';

interface SolicitarDescuentoModalProps {
  open: boolean;
  onClose: () => void;
  onAuthorized: (porcentaje: number) => void;
  porcentajeSolicitado: number;
  montoVenta: number;
  cajaId?: string;
  productoId?: string;
  descripcionProducto?: string;
}

type RequestState = 'idle' | 'sending' | 'waiting' | 'entering_token' | 'validating' | 'approved' | 'rejected' | 'expired';

export function SolicitarDescuentoModal({
  open,
  onClose,
  onAuthorized,
  porcentajeSolicitado,
  montoVenta,
  cajaId,
  productoId,
  descripcionProducto,
}: SolicitarDescuentoModalProps) {
  const [state, setState] = useState<RequestState>('idle');
  const [solicitudId, setSolicitudId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setState('idle');
      setSolicitudId(null);
      setExpiresAt(null);
      setTimeRemaining(0);
      setTokenInput('');
      setError(null);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setState('expired');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // Subscribe to realtime changes for the solicitud
  useEffect(() => {
    if (!solicitudId || state !== 'waiting') return;

    const channel = supabase
      .channel(`solicitud-${solicitudId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'solicitudes_descuento',
          filter: `id=eq.${solicitudId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.estado === 'aprobada') {
            setState('entering_token');
            toast.success('¡Solicitud aprobada! Ingrese el token proporcionado por el administrador.');
          } else if (newData.estado === 'rechazada') {
            setState('rejected');
            setError('El administrador rechazó la solicitud de descuento.');
          } else if (newData.estado === 'expirada') {
            setState('expired');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [solicitudId, state]);

  const handleSendRequest = async () => {
    setState('sending');
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('solicitar-descuento', {
        body: {
          porcentaje_solicitado: porcentajeSolicitado,
          monto_venta: montoVenta,
          caja_id: cajaId,
          producto_id: productoId,
          descripcion_producto: descripcionProducto,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSolicitudId(data.solicitud_id);
      setExpiresAt(new Date(data.expira_en));
      setState('waiting');
      toast.info('Solicitud enviada. Esperando autorización del administrador...');
    } catch (err: any) {
      console.error('Error sending request:', err);
      setError(err.message || 'Error al enviar la solicitud');
      setState('idle');
    }
  };

  const handleValidateToken = async () => {
    if (!tokenInput.trim()) {
      setError('Ingrese el token');
      return;
    }

    setState('validating');
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('validar-token-descuento', {
        body: {
          token: tokenInput.toUpperCase(),
          solicitud_id: solicitudId,
        },
      });

      if (error) throw error;

      if (data.valid) {
        setState('approved');
        toast.success('¡Descuento autorizado!');
        setTimeout(() => {
          onAuthorized(data.porcentaje_autorizado);
        }, 500);
      } else {
        setError(data.error || 'Token inválido');
        setState('entering_token');
      }
    } catch (err: any) {
      console.error('Error validating token:', err);
      setError(err.message || 'Error al validar el token');
      setState('entering_token');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (state === 'approved') {
      onClose();
      return;
    }
    
    // Allow closing in any state except validating
    if (state !== 'validating') {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {state === 'approved' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : state === 'rejected' || state === 'expired' ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-primary" />
            )}
            Autorización de Descuento
          </DialogTitle>
          <DialogDescription>
            {porcentajeSolicitado}% de descuento
            {descripcionProducto && ` - ${descripcionProducto}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* IDLE state - Show request button */}
          {state === 'idle' && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Solicite autorización al administrador para aplicar este descuento.
              </p>
              <Button onClick={handleSendRequest} className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Solicitar Autorización
              </Button>
            </div>
          )}

          {/* SENDING state - Loading */}
          {state === 'sending' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Enviando solicitud...</p>
            </div>
          )}

          {/* WAITING state - Waiting for admin approval */}
          {state === 'waiting' && (
            <div className="text-center space-y-4">
              <div className="bg-muted rounded-lg p-6">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-4 font-medium">Esperando autorización...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Se ha notificado al administrador
                </p>
                <div className="mt-4 text-2xl font-mono font-bold text-primary">
                  {formatTime(timeRemaining)}
                </div>
                <p className="text-xs text-muted-foreground">Tiempo restante</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Cuando el administrador apruebe, podrá ingresar el token aquí.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setState('entering_token')}
                className="w-full"
              >
                Ya tengo el token
              </Button>
            </div>
          )}

          {/* ENTERING_TOKEN state - Input for token */}
          {state === 'entering_token' && (
            <div className="space-y-4">
              {timeRemaining > 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  Tiempo restante: <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="token">Token de Autorización</Label>
                <Input
                  id="token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="Ingrese el token"
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={8}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Ingrese el token proporcionado por el administrador
                </p>
              </div>
              <Button 
                onClick={handleValidateToken} 
                className="w-full"
                disabled={!tokenInput.trim()}
              >
                Validar Token
              </Button>
            </div>
          )}

          {/* VALIDATING state - Loading */}
          {state === 'validating' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Validando token...</p>
            </div>
          )}

          {/* APPROVED state - Success */}
          {state === 'approved' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="mt-4 font-medium text-lg">¡Descuento Autorizado!</p>
              <p className="text-muted-foreground">
                Se aplicará el {porcentajeSolicitado}% de descuento
              </p>
            </div>
          )}

          {/* REJECTED state */}
          {state === 'rejected' && (
            <div className="text-center py-8 space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="font-medium text-lg">Solicitud Rechazada</p>
              <p className="text-muted-foreground">
                El administrador no autorizó este descuento.
              </p>
              <Button variant="outline" onClick={onClose} className="w-full">
                Cerrar
              </Button>
            </div>
          )}

          {/* EXPIRED state */}
          {state === 'expired' && (
            <div className="text-center py-8 space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="font-medium text-lg">Solicitud Expirada</p>
              <p className="text-muted-foreground">
                El tiempo para autorizar ha expirado.
              </p>
              <Button onClick={() => {
                setState('idle');
                setError(null);
              }} className="w-full">
                Solicitar Nuevamente
              </Button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md text-center">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}