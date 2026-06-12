import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Package, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

interface ConfiguracionPublica {
  nombre_sistema: string | null;
  texto_login_footer: string | null;
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signIn } = useAuth();
  
  // Get redirect URL from query params (for PWA isolation)
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [config, setConfig] = useState<ConfiguracionPublica>({
    nombre_sistema: 'GestiónPro',
    texto_login_footer: 'Sistema de Gestión Comercial © 2024',
  });
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(redirectTo);
    }
  }, [user, authLoading, navigate, redirectTo]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_comercio')
        .select('nombre_sistema, texto_login_footer')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setConfig({
          nombre_sistema: (data as any).nombre_sistema || 'GestiónPro',
          texto_login_footer: (data as any).texto_login_footer || 'Sistema de Gestión Comercial © 2024',
        });
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Verifica tu email y contraseña.');
      } else {
        setError(error.message);
      }
    }
  };

  if (authLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="h-44 w-auto bg-white p-4 rounded-2xl shadow-md flex items-center justify-center border border-muted">
            <img src="/logo-empresa.jpg" alt="Logo" className="h-full object-contain" />
          </div>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="pb-2">
            <h2 className="text-lg font-semibold text-center">Bienvenido</h2>
            <p className="text-sm text-muted-foreground text-center">
              Ingresa tus credenciales para acceder
            </p>
          </CardHeader>
          
          <CardContent className="pt-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {config.texto_login_footer}
        </p>
      </div>
    </div>
  );
}