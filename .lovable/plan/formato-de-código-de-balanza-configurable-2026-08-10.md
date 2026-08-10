# Formato de código de balanza configurable

Hoy el parser de etiquetas de balanza asume siempre el formato `2 + PLU(5) + gramos(6) + check`. Se hace configurable desde Configuración, leyendo el parámetro global ya creado en la base (`formato_codigo_balanza`).

## Cambios

**1. `src/lib/codigoBalanza.ts`**
- Nuevo tipo exportado `FormatoCodigoBalanza = 'plu5_peso6' | 'plu6_peso5'`.
- `parseCodigoBalanza(raw, formato = 'plu5_peso6')`: el largo del PLU pasa a ser 5 o 6 según el formato; el peso toma los dígitos restantes hasta la posición 12. Sin autodetección.
- Checksum EAN-13 y validación `pesoKg > 0` sin cambios. Default conservado, así que sin config el comportamiento es idéntico al actual.

**2. `src/hooks/useConfiguracionComercio.ts`**
- Se agrega `formato_codigo_balanza?: FormatoCodigoBalanza | null` a la interfaz local. La lógica de fetch no se toca.

**3. `src/pages/Configuracion.tsx`** (mismo patrón que `condicion_iva`)
- Campo en la interfaz `ConfiguracionComercio`, en `initialFormData` con default `'plu5_peso6'`, en el mapeo de `fetchConfig` y en `dataToSave` del submit.
- Select con dos opciones:
  - `plu5_peso6` → "PLU 5 dígitos + Peso 6 (estándar)"
  - `plu6_peso5` → "PLU 6 dígitos + Peso 5"
- Texto de ayuda: "Debe coincidir con la configuración física de la balanza. Todas las balanzas deben usar el mismo formato."

**4. `src/pages/POS.tsx`**
- Se resuelve una sola vez: `const formatoBalanza = (comercioConfig?.formato_codigo_balanza ?? 'plu5_peso6') as FormatoCodigoBalanza`.
- La llamada del handler de escaneo pasa el formato.
- Se pasa `formatoCodigoBalanza={formatoBalanza}` al modal de búsqueda de productos.

**5. `src/components/pos/ProductSearchModal.tsx`**
- Nueva prop opcional `formatoCodigoBalanza` (default `'plu5_peso6'`), usada en su llamada al parser.

## Fuera de alcance
No se modifica el checksum, la lógica de match por PLU (1 / 0 / >1 resultados), ni `calcSubtotal` / `getProductoPrice`. No hay cambios de base de datos: la columna ya existe.
