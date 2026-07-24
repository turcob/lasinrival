import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConfiguracionComercio {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string;
  direccion: string;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  email: string | null;
  condicion_iva: string;
  inicio_actividades: string | null;
  punto_venta: number;
  nombre_sistema: string | null;
  texto_login_footer: string | null;
  pos_flujo_mayorista_activo?: boolean | null;
}

export function useConfiguracionComercio() {
  const [config, setConfig] = useState<ConfiguracionComercio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_comercio')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching config:', error);
      }
      
      setConfig(data as ConfiguracionComercio | null);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCuit = (cuit: string) => {
    if (!cuit) return '';
    const clean = cuit.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
    }
    return cuit;
  };

  return { config, loading, formatCuit, refetch: fetchConfig };
}
