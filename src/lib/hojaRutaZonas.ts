/**
 * Helper para extraer y formatear las zonas que cubre una hoja de ruta
 * a partir de sus paradas (cada parada referencia un pedido -> cliente -> zona).
 */

type ParadaConZona = {
  pedido?: {
    cliente?: {
      zona?: { nombre?: string | null } | null;
      zona_id?: string | null;
    } | null;
  } | null;
};

export function getZonasDeParadas(paradas?: ParadaConZona[] | null): string[] {
  if (!paradas?.length) return [];
  const set = new Set<string>();
  paradas.forEach((p) => {
    const nombre = p.pedido?.cliente?.zona?.nombre;
    if (nombre) set.add(nombre);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function formatZonasResumen(paradas?: ParadaConZona[] | null): string {
  const zonas = getZonasDeParadas(paradas);
  if (!zonas.length) return '';
  if (zonas.length === 1) return zonas[0];
  if (zonas.length <= 3) return zonas.join(' / ');
  return `${zonas.slice(0, 2).join(' / ')} +${zonas.length - 2}`;
}

export function buildHojaRutaTitulo(numeroHoja: number | string, paradas?: ParadaConZona[] | null): string {
  const zonas = formatZonasResumen(paradas);
  return zonas ? `Hoja #${numeroHoja} — ${zonas}` : `Hoja #${numeroHoja}`;
}