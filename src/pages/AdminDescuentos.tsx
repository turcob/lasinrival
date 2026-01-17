import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useSolicitudesDescuento } from '@/hooks/useSolicitudesDescuento';
import { SolicitudCard } from '@/components/admin/SolicitudCard';
import { TokenDisplay } from '@/components/admin/TokenDisplay';
import { Shield, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function AdminDescuentos() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const { solicitudes, loading, error, aprobarSolicitud, rechazarSolicitud, refetch } = useSolicitudesDescuento();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<{ token: string; expiraEn: string } | null>(null);
  const prevCountRef = useRef(solicitudes.length);

  // Check admin role
  const isAdmin = hasRole('admin');

  // Play sound and vibrate on new request
  useEffect(() => {
    if (solicitudes.length > prevCountRef.current) {
      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Play notification sound
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 200);
      } catch (e) {
        console.log('Audio not available');
      }

      toast.info('Nueva solicitud de descuento');
    }
    prevCountRef.current = solicitudes.length;
  }, [solicitudes.length]);

  const handleAprobar = async (id: string) => {
    setProcessingId(id);
    const result = await aprobarSolicitud(id);
    
    if (result.success && result.token && result.expira_en) {
      setTokenData({ token: result.token, expiraEn: result.expira_en });
      toast.success('Solicitud aprobada');
    } else {
      toast.error(result.error || 'Error al aprobar');
    }
    
    setProcessingId(null);
  };

  const handleRechazar = async (id: string) => {
    setProcessingId(id);
    const result = await rechazarSolicitud(id);
    
    if (result.success) {
      toast.success('Solicitud rechazada');
    } else {
      toast.error(result.error || 'Error al rechazar');
    }
    
    setProcessingId(null);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in - redirect to auth with return URL
  if (!user) {
    return <Navigate to="/auth?redirect=/admin-descuentos" replace />;
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Shield className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Denegado</h1>
        <p className="text-muted-foreground">Esta página es solo para administradores.</p>
      </div>
    );
  }

  // Token display overlay
  if (tokenData) {
    return (
      <TokenDisplay
        token={tokenData.token}
        expiraEn={tokenData.expiraEn}
        onClose={() => setTokenData(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Autorización</h1>
              <p className="text-xs text-muted-foreground">Descuentos</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Sin solicitudes</h2>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Las solicitudes de descuento aparecerán aquí
            </p>
          </div>
        ) : (
          solicitudes.map((solicitud) => (
            <SolicitudCard
              key={solicitud.id}
              solicitud={solicitud}
              onAprobar={handleAprobar}
              onRechazar={handleRechazar}
              isProcessing={processingId === solicitud.id}
            />
          ))
        )}
      </div>

      {/* Badge showing count */}
      {solicitudes.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold shadow-lg">
          {solicitudes.length} pendiente{solicitudes.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
