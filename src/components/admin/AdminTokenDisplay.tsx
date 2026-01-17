import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AdminTokenDisplayProps {
  onTokenUsed?: () => void;
}

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return '0:00';

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function AdminTokenDisplay({ onTokenUsed }: AdminTokenDisplayProps) {
  const [token, setToken] = useState<string | null>(null);
  const [expiraEn, setExpiraEn] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const generateToken = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generar-token-admin');
      
      if (error) {
        console.error('Error generando token:', error);
        toast.error('Error al generar token');
        return;
      }

      if (data?.success && data.token) {
        setToken(data.token);
        setExpiraEn(data.expira_en);
        setIsExpired(false);
        setTimeRemaining(formatTimeRemaining(data.expira_en));
      } else {
        toast.error(data?.error || 'Error al generar token');
      }
    } catch (e) {
      console.error('Error:', e);
      toast.error('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate initial token on mount
  useEffect(() => {
    generateToken();
  }, [generateToken]);

  // Subscribe to realtime changes on admin_tokens to detect when token is used
  useEffect(() => {
    const channel = supabase
      .channel('admin-token-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_tokens',
        },
        (payload) => {
          // If our token was marked as used, generate a new one
          if (payload.new.usado === true && payload.old.usado === false) {
            console.log('Token usado, generando nuevo...');
            toast.success('Token utilizado - generando nuevo');
            generateToken();
            onTokenUsed?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [generateToken, onTokenUsed]);

  // Countdown timer
  useEffect(() => {
    if (!expiraEn) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expiry = new Date(expiraEn);
      
      if (now >= expiry) {
        setIsExpired(true);
        setTimeRemaining('0:00');
        clearInterval(interval);
        // Auto-regenerate when expired
        generateToken();
      } else {
        setTimeRemaining(formatTimeRemaining(expiraEn));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiraEn, generateToken]);

  const handleCopy = async () => {
    if (!token) return;
    
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success('Token copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar');
    }
  };

  if (!token && loading) {
    return (
      <Card className="bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30">
        <CardContent className="p-4 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 shadow-lg">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Tu Token de Autorización</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={generateToken}
            disabled={loading}
            className="h-8 w-8"
            title="Generar nuevo token"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Token display */}
        <div className="p-4 rounded-xl bg-background/80 border-2 border-primary/40">
          <div className="text-center">
            <p className="text-3xl font-mono font-black tracking-[0.3em] text-primary">
              {token?.split('').map((char, i) => (
                <span key={i} className="inline-block">{char}</span>
              ))}
            </p>
          </div>
        </div>

        {/* Timer and actions */}
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${isExpired ? 'bg-destructive/20' : 'bg-orange-500/10'}`}>
            <Clock className={`h-4 w-4 ${isExpired ? 'text-destructive' : 'text-orange-500'}`} />
            <span className={`text-sm font-mono font-bold ${isExpired ? 'text-destructive' : 'text-orange-500'}`}>
              {timeRemaining}
            </span>
          </div>
          
          <Button
            onClick={handleCopy}
            disabled={!token || isExpired}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </Button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-muted-foreground text-center">
          Dicte este token al vendedor cuando solicite autorización
        </p>
      </CardContent>
    </Card>
  );
}
