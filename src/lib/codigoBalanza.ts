// Etiquetas de balanza: EAN-13 de peso variable.
// plu5_peso6 = 2 + PLU(5) + gramos(6) + check | plu6_peso5 = 2 + PLU(6) + gramos(5) + check.
// Devuelve {plu, pesoKg} si es un código de balanza válido, o null.
export type FormatoCodigoBalanza = 'plu5_peso6' | 'plu6_peso5';

export function parseCodigoBalanza(
  raw: string,
  formato: FormatoCodigoBalanza = 'plu5_peso6'
): { plu: number; pesoKg: number } | null {
  const s = raw.trim();
  if (!/^2\d{12}$/.test(s)) return null;
  const d = s.split('').map(Number);
  const sum = d.slice(0, 12).reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 1 : 3), 0);
  if ((10 - (sum % 10)) % 10 !== d[12]) return null; // lectura corrupta → término normal
  const pluLen = formato === 'plu6_peso5' ? 6 : 5;
  const plu = parseInt(s.slice(1, 1 + pluLen), 10);
  const pesoKg = parseInt(s.slice(1 + pluLen, 12), 10) / 1000;
  if (pesoKg <= 0) return null;
  return { plu, pesoKg };
}
