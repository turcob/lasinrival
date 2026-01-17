import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SolicitudDescuento = Database['public']['Tables']['solicitudes_descuento']['Row'];

export interface SolicitudConVendedor extends SolicitudDescuento {
  vendedor_nombre: string;
}

export function useSolicitudesDescuento() {
  const [solicitudes, setSolicitudes] = useState<SolicitudConVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSolicitudes = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('solicitudes_descuento')
        .select('*')
        .eq('estado', 'pendiente')
        .gt('expira_en', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch vendor names
      const vendorIds = [...new Set(data?.map(s => s.vendedor_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nombre')
        .in('id', vendorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.nombre]) || []);

      const solicitudesConNombre: SolicitudConVendedor[] = (data || []).map(s => ({
        ...s,
        vendedor_nombre: profileMap.get(s.vendedor_id) || 'Vendedor desconocido'
      }));

      setSolicitudes(solicitudesConNombre);
      setError(null);
    } catch (err) {
      console.error('Error fetching solicitudes:', err);
      setError('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolicitudes();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('solicitudes_descuento_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitudes_descuento'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          fetchSolicitudes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSolicitudes]);

  const aprobarSolicitud = async (solicitudId: string): Promise<{ success: boolean; token?: string; expira_en?: string; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'No autenticado' };
      }

      const response = await supabase.functions.invoke('aprobar-descuento', {
        body: { solicitud_id: solicitudId, aprobar: true }
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      if (response.data?.error) {
        return { success: false, error: response.data.error };
      }

      return { 
        success: true, 
        token: response.data.token,
        expira_en: response.data.expira_en
      };
    } catch (err) {
      console.error('Error aprobando solicitud:', err);
      return { success: false, error: 'Error al aprobar solicitud' };
    }
  };

  const rechazarSolicitud = async (solicitudId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'No autenticado' };
      }

      const response = await supabase.functions.invoke('aprobar-descuento', {
        body: { solicitud_id: solicitudId, aprobar: false }
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      if (response.data?.error) {
        return { success: false, error: response.data.error };
      }

      return { success: true };
    } catch (err) {
      console.error('Error rechazando solicitud:', err);
      return { success: false, error: 'Error al rechazar solicitud' };
    }
  };

  return {
    solicitudes,
    loading,
    error,
    aprobarSolicitud,
    rechazarSolicitud,
    refetch: fetchSolicitudes
  };
}
