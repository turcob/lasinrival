## Simplificar footer de `CobrarSheet`

Como el tipo de entrega (completa / parcial) ya se elige antes en `ParadaSheet`, el `CobrarSheet` no necesita los dos botones del footer.

### Cambio en `src/components/encargado/CobrarSheet.tsx`

Reemplazar el grid de 2 botones (líneas 208-225) por un único botón **"Confirmar cobro"** ancho completo:

- Llama a `handleConfirmar(...)` con un único modo.
- Deshabilitado si `totalCobros <= 0` o `saldoFinal > 0.01` (debe cobrarse todo el saldo restante, que ya está recalculado con las devoluciones aplicadas).
- Para el estado de la parada: si existieron devoluciones previas la parada se marca `entrega_parcial`; si no, `entregado`. Esto se puede inferir comparando `montoCobradoPrevio + totalCobros` vs el total original, pero como `CobrarSheet` solo recibe `totalPedido` ya ajustado, lo más simple es: pasar un prop nuevo opcional `huboDevolucion: boolean` desde `ParadaSheet` y usarlo para decidir el estado final. Alternativa más simple aún (preferida): siempre marcar `entregado` cuando el saldo queda en 0 — la información de devolución ya queda registrada en la tabla de devoluciones, así que el estado `entrega_parcial` deja de usarse desde este flujo.

Voy con la alternativa simple: **siempre `entregado`** al confirmar, ya que el saldo se cobra completo.

### Limpieza adicional
- Quitar el parámetro `'completo' | 'parcial'` de `handleConfirmar` (queda sin parámetro).
- Mantener la validación de "Falta cobrar el saldo total".

Sin cambios en otros archivos.
