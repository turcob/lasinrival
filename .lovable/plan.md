# Unificar NC en Ventas con el wizard existente

Alcance: solo front. No se toca la edge `afip-facturacion` ni `get_factura_saldo_disponible`.

## Cambios

### 1) `src/components/facturacion/NotaCreditoParcialWizard.tsx` — props opcionales de preset

Agregar dos props opcionales para que el llamador pueda abrir el wizard "preseteado":

```ts
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factura: FacturaOrigen | null;
  onEmitida: () => void;
  presetAlcance?: Alcance;         // "parcial" | "total"
  presetAnularVenta?: "si" | "no"; // default "no"
}
```

En el `useEffect` de reset (línea ~128) aplicar el preset si viene:
- `setAlcance(presetAlcance ?? "parcial")`
- `setAnularVenta(presetAnularVenta ?? "no")`
- si `presetAlcance === "total"`: `setModo("bonificacion")` no aplica; el modo queda "items" por defecto, el usuario igual puede revisar. (El wizard ya soporta alcance total en modo items marcando todas las cantidades.)

No se cambia lógica interna de emisión, validaciones, resolución financiera ni marcado de `anulada`.

### 2) `src/pages/Ventas.tsx` — reemplazar `handleAnular` propio por el wizard

**a. Fetch de ventas:** ampliar el select de `comprobantes_afip` para incluir los campos que exige `FacturaOrigen` del wizard: agregar `cuit_emisor, venta_id` al select (ya trae el resto).

**b. Estado nuevo:**
```ts
const [ncWizardOpen, setNcWizardOpen] = useState(false);
const [facturaParaNc, setFacturaParaNc] = useState<any>(null);
const [ncPreset, setNcPreset] = useState<{ alcance: "parcial" | "total"; anular: "si" | "no" }>({ alcance: "parcial", anular: "no" });
```

**c. Handlers:**
- `openNcWizard(item, preset)`: setea `facturaParaNc = item.comprobantes_afip[0]`, `ncPreset = preset`, abre el wizard. Si la venta no tiene comprobante AFIP, `toast.error("La venta no tiene factura electrónica; no se puede emitir NC")` y no abre.
- `onEmitida`: `fetchVentas()` + `setRefreshTotales(n => n + 1)`.

**d. Grilla — columna Acciones (línea ~902):**
- Eliminar el actual botón "Anular venta" que abre `AnularDialog`.
- Agregar dos botones cuando `!item._es_pedido && !item.anulada && canAnular && item.comprobantes_afip?.length`:
  - `FileText` — "Nota de crédito" → `openNcWizard(item, { alcance: "parcial", anular: "no" })`
  - `XCircle` (destructive) — "Anular venta" → `openNcWizard(item, { alcance: "total", anular: "si" })`
- Si no hay factura AFIP, no se muestra ninguno (la anulación sin factura queda fuera de alcance de este paso).

**e. Eliminar:**
- Función `handleAnular` (líneas ~436-688).
- Estado `anularDialogOpen`, `motivoAnulacion` y el `<AlertDialog>` de anulación (buscar `AnularDialog` / `setAnularDialogOpen`).

**f. Render del wizard** (antes del cierre de `MainLayout`):
```tsx
<NotaCreditoParcialWizard
  open={ncWizardOpen}
  onOpenChange={setNcWizardOpen}
  factura={facturaParaNc}
  presetAlcance={ncPreset.alcance}
  presetAnularVenta={ncPreset.anular}
  onEmitida={() => { fetchVentas(); setRefreshTotales(n => n + 1); }}
/>
```

## Cobertura de los dos gaps (confirmación pedida)

1. **Validación contra NCs previas (doble acreditación):** cubierta. Toda emisión pasa ahora por `get_factura_saldo_disponible`, que descuenta NCs previas y expone `monto_disponible`. El wizard bloquea si `monto_disponible <= 0` (paso 1 del wizard). Antes, `handleAnular` no consultaba saldos y podía emitir una NC total incluso con NCs parciales previas.
2. **Reposición de stock:** cubierta. El wizard, en modo items, reingresa stock cuando `reingresarStock === "si"` (default) y registra el movimiento de inventario. Cuando "Anular venta" abra el wizard con `alcance="total" + anular="si"`, el modo por defecto es items con reingreso activo, así que la anulación total queda con reingreso equivalente al comportamiento anterior. Además marca `anulada=true` con `motivo_anulacion` que incluye referencia a la NC total.

## Fuera de alcance (explícito)

- Edge `afip-facturacion`: `CbtesAsoc` ya está correcto en el wizard.
- `get_factura_saldo_disponible`: no se toca.
- Ventas sin factura AFIP: quedan sin acción de anulación en este paso (se puede tratar aparte).
- Movimientos de caja por anulación: el wizard resuelve financieramente por caja o CC según su propia lógica; ya no se replica el `movimientos_caja` egreso que hacía `handleAnular`.
