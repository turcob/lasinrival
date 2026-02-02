import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface Visita {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  fecha_programada: string;
  hora_programada: string | null;
  estado: 'pendiente' | 'en_curso' | 'completada' | 'cancelada' | 'no_visitado';
  fecha_checkin: string | null;
  latitud_checkin: number | null;
  longitud_checkin: number | null;
  precision_gps: number | null;
  notas: string | null;
  motivo_no_visita: string | null;
  usuario_id: string;
  created_at: string;
  updated_at: string;
  vendedor?: { id: string; nombre: string; codigo: string };
  cliente?: { id: string; nombre: string; direccion: string | null; telefono: string | null; zona_id: string | null };
}

export interface VisitaIncidencia {
  id: string;
  visita_id: string;
  tipo: 'reclamo' | 'devolucion' | 'competencia' | 'exhibicion' | 'stock' | 'otro';
  descripcion: string;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  estado: 'abierta' | 'en_proceso' | 'resuelta';
  created_at: string;
}

export interface ObjetivoVendedor {
  id: string;
  vendedor_id: string;
  periodo_mes: number;
  periodo_anio: number;
  meta_ventas: number;
  meta_visitas: number;
  meta_cobertura_porcentaje: number;
  meta_ticket_promedio: number;
  ventas_realizadas: number;
  visitas_realizadas: number;
  cobertura_actual: number;
  ticket_promedio_actual: number;
  vendedor?: { id: string; nombre: string; codigo: string };
}

export interface ObjetivoZona {
  id: string;
  zona_id: string;
  periodo_mes: number;
  periodo_anio: number;
  meta_ventas: number;
  meta_visitas: number;
  meta_clientes_nuevos: number;
  ventas_realizadas: number;
  visitas_realizadas: number;
  clientes_nuevos: number;
  zona?: { id: string; nombre: string; codigo: string };
}

export interface ProductoFoco {
  id: string;
  producto_id: string;
  periodo_mes: number;
  periodo_anio: number;
  meta_unidades: number;
  meta_monto: number;
  unidades_vendidas: number;
  monto_vendido: number;
  activo: boolean;
  producto?: { id: string; descripcion: string; codigo_articulo: string };
}

export function useVisitas(fecha?: string, vendedorId?: string) {
  return useQuery({
    queryKey: ['visitas', fecha, vendedorId],
    queryFn: async () => {
      let query = supabase
        .from('visitas')
        .select(`
          *,
          vendedor:vendedores(id, nombre, codigo),
          cliente:clientes(id, nombre, direccion, telefono, zona_id)
        `)
        .order('fecha_programada', { ascending: true })
        .order('hora_programada', { ascending: true, nullsFirst: false });

      if (fecha) {
        query = query.eq('fecha_programada', fecha);
      }
      if (vendedorId) {
        query = query.eq('vendedor_id', vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Visita[];
    },
  });
}

export function useVisitaIncidencias(visitaId?: string) {
  return useQuery({
    queryKey: ['visita_incidencias', visitaId],
    queryFn: async () => {
      if (!visitaId) return [];
      const { data, error } = await supabase
        .from('visita_incidencias')
        .select('*')
        .eq('visita_id', visitaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VisitaIncidencia[];
    },
    enabled: !!visitaId,
  });
}

export function useObjetivosVendedor(mes: number, anio: number) {
  return useQuery({
    queryKey: ['objetivos_vendedor', mes, anio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objetivos_vendedor')
        .select(`
          *,
          vendedor:vendedores(id, nombre, codigo)
        `)
        .eq('periodo_mes', mes)
        .eq('periodo_anio', anio);
      if (error) throw error;
      return data as ObjetivoVendedor[];
    },
  });
}

export function useObjetivosZona(mes: number, anio: number) {
  return useQuery({
    queryKey: ['objetivos_zona', mes, anio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objetivos_zona')
        .select(`
          *,
          zona:zonas(id, nombre, codigo)
        `)
        .eq('periodo_mes', mes)
        .eq('periodo_anio', anio);
      if (error) throw error;
      return data as ObjetivoZona[];
    },
  });
}

export function useProductosFoco(mes: number, anio: number) {
  return useQuery({
    queryKey: ['productos_foco', mes, anio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos_foco')
        .select(`
          *,
          producto:productos(id, descripcion, codigo_articulo)
        `)
        .eq('periodo_mes', mes)
        .eq('periodo_anio', anio)
        .eq('activo', true);
      if (error) throw error;
      return data as ProductoFoco[];
    },
  });
}

export function useVisitaMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const generarVisitas = useMutation({
    mutationFn: async ({ vendedorId, fecha }: { vendedorId: string; fecha: string }) => {
      // Obtener clientes de las zonas asignadas al vendedor
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, zona_id')
        .eq('vendedor_id', vendedorId)
        .eq('activo', true);

      if (clientesError) throw clientesError;

      if (!clientes || clientes.length === 0) {
        throw new Error('No hay clientes asignados a este vendedor');
      }

      // Crear visitas para cada cliente
      const visitas = clientes.map((cliente) => ({
        vendedor_id: vendedorId,
        cliente_id: cliente.id,
        fecha_programada: fecha,
        estado: 'pendiente' as const,
        usuario_id: user?.id,
      }));

      const { error } = await supabase.from('visitas').insert(visitas);
      if (error) throw error;

      return visitas.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      toast({ title: 'Visitas generadas', description: `Se crearon ${count} visitas.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const hacerCheckin = useMutation({
    mutationFn: async ({ visitaId, notas }: { visitaId: string; notas?: string }) => {
      let latitud: number | null = null;
      let longitud: number | null = null;
      let precision: number | null = null;

      // Intentar obtener ubicación GPS
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          latitud = position.coords.latitude;
          longitud = position.coords.longitude;
          precision = position.coords.accuracy;
        } catch {
          console.log('No se pudo obtener ubicación GPS');
        }
      }

      const { error } = await supabase
        .from('visitas')
        .update({
          estado: 'completada',
          fecha_checkin: new Date().toISOString(),
          latitud_checkin: latitud,
          longitud_checkin: longitud,
          precision_gps: precision,
          notas: notas || null,
        })
        .eq('id', visitaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      toast({ title: 'Check-in realizado' });
    },
    onError: () => {
      toast({ title: 'Error al hacer check-in', variant: 'destructive' });
    },
  });

  const marcarNoVisitado = useMutation({
    mutationFn: async ({ visitaId, motivo }: { visitaId: string; motivo: string }) => {
      const { error } = await supabase
        .from('visitas')
        .update({
          estado: 'no_visitado',
          motivo_no_visita: motivo,
        })
        .eq('id', visitaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      toast({ title: 'Visita marcada como no realizada' });
    },
    onError: () => {
      toast({ title: 'Error', variant: 'destructive' });
    },
  });

  const agregarIncidencia = useMutation({
    mutationFn: async (incidencia: Omit<VisitaIncidencia, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('visita_incidencias').insert(incidencia);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visita_incidencias'] });
      toast({ title: 'Incidencia registrada' });
    },
    onError: () => {
      toast({ title: 'Error al registrar incidencia', variant: 'destructive' });
    },
  });

  return { generarVisitas, hacerCheckin, marcarNoVisitado, agregarIncidencia };
}
