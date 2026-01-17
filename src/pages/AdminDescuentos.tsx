import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useSolicitudesDescuento } from '@/hooks/useSolicitudesDescuento';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { SolicitudCard } from '@/components/admin/SolicitudCard';
import { TokenDisplay } from '@/components/admin/TokenDisplay';
import { Shield, Inbox, RefreshCw, Bell, BellOff, BellRing, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function AdminDescuentos() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const { solicitudes, loading, error, aprobarSolicitud, rechazarSolicitud, refetch } = useSolicitudesDescuento();
  const { 
    permission, 
    isSupported, 
    isSubscribed,
    requestPermission, 
    subscribeToPush,
    showNotification, 
    sendBackgroundNotification,
    isGranted, 
    isDenied 
  } = usePushNotifications();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<{ token: string; expiraEn: string } | null>(null);
  const prevCountRef = useRef(solicitudes.length);
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Check admin role
  const isAdmin = hasRole('admin');

  // Request notification permission and subscribe on mount if not already subscribed
  useEffect(() => {
    if (isSupported && isGranted && !isSubscribed && user && isAdmin) {
      const setupPush = async () => {
        setIsSettingUp(true);
        try {
          const subscribed = await subscribeToPush();
          if (subscribed) {
            console.log('Push subscription set up successfully');
          }
        } catch (e) {
          console.error('Error setting up push:', e);
        }
        setIsSettingUp(false);
      };
      
      // Delay to ensure everything is loaded
      const timer = setTimeout(setupPush, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, isGranted, isSubscribed, user, isAdmin, subscribeToPush]);

  // Request notification permission on mount if not already granted
  useEffect(() => {
    if (isSupported && permission === 'default' && user && isAdmin) {
      const timer = setTimeout(() => {
        requestPermission().then((granted) => {
          if (granted) {
            toast.success('Notificaciones activadas');
          }
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, requestPermission, user, isAdmin]);

  // Play sound, vibrate and show push notification on new request
  useEffect(() => {
    if (solicitudes.length > prevCountRef.current) {
      const newCount = solicitudes.length - prevCountRef.current;
      
      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Play notification sound
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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

      // Show notification (works in foreground and background)
      if (isGranted) {
        const latestSolicitud = solicitudes[0];
        // Try background notification first (works when app is minimized)
        sendBackgroundNotification({
          title: '🔔 Nueva Solicitud de Descuento',
          body: `${latestSolicitud?.vendedor_nombre || 'Vendedor'} solicita ${latestSolicitud?.porcentaje_solicitado}% de descuento`,
          data: { solicitud_id: latestSolicitud?.id, type: 'nueva_solicitud' },
        }).catch(() => {
          // Fallback to regular notification
          showNotification({
            title: '🔔 Nueva Solicitud de Descuento',
            body: `${latestSolicitud?.vendedor_nombre || 'Vendedor'} solicita ${latestSolicitud?.porcentaje_solicitado}% de descuento`,
            tag: 'nueva-solicitud-' + latestSolicitud?.id,
            requireInteraction: true,
          });
        });
      }

      toast.info(`${newCount} nueva${newCount > 1 ? 's' : ''} solicitud${newCount > 1 ? 'es' : ''} de descuento`);
    }
    prevCountRef.current = solicitudes.length;
  }, [solicitudes, isGranted, showNotification, sendBackgroundNotification]);

  const handleRequestNotifications = async () => {
    setIsSettingUp(true);
    const granted = await requestPermission();
    if (granted) {
      toast.success('Permiso concedido');
      // Now subscribe to push
      const subscribed = await subscribeToPush();
      if (subscribed) {
        toast.success('Notificaciones push activadas');
      } else {
        toast.error('Error al activar notificaciones push');
      }
    } else {
      toast.error('Permiso de notificaciones denegado');
    }
    setIsSettingUp(false);
  };

  const handleTestPush = async () => {
    try {
      toast.info('Enviando notificación de prueba...');
      
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title: '🧪 Prueba de Push',
          body: 'Si ves esto, las notificaciones funcionan correctamente!',
          target_role: 'admin'
        }
      });
      
      if (error) {
        console.error('Error enviando push de prueba:', error);
        toast.error('Error: ' + error.message);
      } else {
        console.log('Push de prueba enviado:', data);
        toast.success(`Notificación enviada a ${data?.sent || 0} dispositivo(s)`);
      }
    } catch (e) {
      console.error('Error:', e);
      toast.error('Error al enviar notificación de prueba');
    }
  };

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
          <div className="flex items-center gap-2">
            {/* Notification status button */}
            {isSupported && !isGranted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRequestNotifications}
                disabled={isSettingUp}
                className={isDenied ? 'text-destructive' : 'text-warning'}
                title={isDenied ? 'Notificaciones bloqueadas' : 'Activar notificaciones'}
              >
                <BellOff className="h-5 w-5" />
              </Button>
            )}
            {isGranted && !isSubscribed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRequestNotifications}
                disabled={isSettingUp}
                className="text-warning"
                title="Activar notificaciones push"
              >
                <Bell className="h-5 w-5" />
              </Button>
            )}
            {isGranted && isSubscribed && (
              <>
                <div className="h-10 w-10 flex items-center justify-center text-primary" title="Notificaciones push activas">
                  <BellRing className="h-5 w-5" />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleTestPush}
                  title="Enviar notificación de prueba"
                  className="border-primary/50 hover:bg-primary/10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </>
            )}
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
            {isGranted && isSubscribed && (
              <p className="text-xs text-primary mt-4">
                🔔 Recibirás una notificación cuando llegue una solicitud
              </p>
            )}
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
