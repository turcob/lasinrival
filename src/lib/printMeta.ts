/**
 * Helpers para agregar metadatos de impresión (usuario, alias de PC, fecha/hora)
 * en todas las impresiones del sistema EXCEPTO facturas / remitos.
 *
 * El alias de PC se guarda en localStorage por dispositivo
 * (clave: print_pc_alias). El nombre del usuario se guarda al iniciar sesión
 * desde AuthContext (clave: print_user_name).
 */

const PC_ALIAS_KEY = 'print_pc_alias';
const USER_NAME_KEY = 'print_user_name';

export function getPcAlias(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(PC_ALIAS_KEY) || '';
}

export function setPcAlias(alias: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PC_ALIAS_KEY, alias.trim());
}

export function getPrintUserName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(USER_NAME_KEY) || '';
}

export function setPrintUserName(name: string | null | undefined) {
  if (typeof window === 'undefined') return;
  if (name) localStorage.setItem(USER_NAME_KEY, name);
  else localStorage.removeItem(USER_NAME_KEY);
}

function nowText(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

/**
 * Devuelve un bloque HTML con metadatos para incluir al pie de impresiones.
 * Usar para todo lo que no sea factura/remito.
 */
export function getPrintMetaHTML(): string {
  const user = getPrintUserName() || '—';
  const pc = getPcAlias() || 'PC sin configurar';
  const fecha = nowText();
  return `
    <div style="margin-top:10px;padding:6px 10px;border-top:1px dashed #999;
      font-size:10px;color:#555;display:flex;justify-content:space-between;
      font-family:'Segoe UI',Arial,sans-serif;flex-wrap:wrap;gap:8px;">
      <span><strong>Usuario:</strong> ${escapeHtml(user)}</span>
      <span><strong>PC:</strong> ${escapeHtml(pc)}</span>
      <span><strong>Impreso:</strong> ${fecha}</span>
    </div>
  `;
}

/** Versión en una sola línea de texto para títulos / encabezados pequeños. */
export function getPrintMetaLine(): string {
  const user = getPrintUserName() || '—';
  const pc = getPcAlias() || 'PC sin configurar';
  return `Usuario: ${user} | PC: ${pc} | Impreso: ${nowText()}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}