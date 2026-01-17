import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Copy, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface TokenDisplayProps {
  token: string;
  expiraEn: string;
  onClose: () => void;
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

export function TokenDisplay({ token, expiraEn, onClose }: TokenDisplayProps) {
  const [timeRemaining, setTimeRemaining] = useState(formatTimeRemaining(expiraEn));
  const [copied, setCopied] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const expiry = new Date(expiraEn);
      
      if (now >= expiry) {
        setIsExpired(true);
        setTimeRemaining('0:00');
        clearInterval(interval);
      } else {
        setTimeRemaining(formatTimeRemaining(expiraEn));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiraEn]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success('Token copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar');
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md bg-card border-border/50 shadow-2xl">
        <CardContent className="p-6 space-y-6">
          {/* Success icon */}
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">¡APROBADO!</h2>
            <p className="text-muted-foreground mt-1">Dicte este token al vendedor</p>
          </div>

          {/* Token display */}
          <div className="p-6 rounded-xl bg-muted/50 border-2 border-primary/30">
            <div className="text-center">
              <p className="text-4xl font-mono font-black tracking-[0.3em] text-primary">
                {token.split('').map((char, i) => (
                  <span key={i} className="inline-block">{char}</span>
                ))}
              </p>
            </div>
          </div>

          {/* Timer */}
          <div className={`flex items-center justify-center gap-2 p-3 rounded-lg ${isExpired ? 'bg-destructive/20' : 'bg-orange-500/10'}`}>
            <Clock className={`h-5 w-5 ${isExpired ? 'text-destructive' : 'text-orange-500'}`} />
            <span className={`text-lg font-mono font-bold ${isExpired ? 'text-destructive' : 'text-orange-500'}`}>
              {isExpired ? 'Token expirado' : `Expira en: ${timeRemaining}`}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleCopy}
              disabled={isExpired}
              variant="outline"
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
