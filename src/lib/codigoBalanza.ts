// Etiquetas de balanza Kretz: EAN-13 de peso variable, formato 2 + PLU(5) + gramos(6) + check.
// Devuelve {plu, pesoKg} si es un código de balanza válido, o null.
export function parseCodigoBalanza(raw: string): { plu: number; pesoKg: number } | null {
  const s = raw.trim();
  if (!/^2\d{12}$/.test(s)) return null;
  const d = s.split('').map(Number);
  const sum = d.slice(0, 12).reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 1 : 3), 0);
  if ((10 - (sum % 10)) % 10 !== d[12]) return null; // lectura corrupta → término normal
  const plu = parseInt(s.slice(1, 6), 10);
  const pesoKg = parseInt(s.slice(6, 12), 10) / 1000;
  if (pesoKg <= 0) return null;
  return { plu, pesoKg };
}
