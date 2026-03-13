

## Plan: Agregar sección de Workflows PDF en Configuración

### Qué se hará

Agregar una nueva Card en la página de Configuración con botones para generar y descargar/imprimir los diagramas de workflows del sistema como PDF. Se incluirán 3 workflows:

1. **Venta a clientes por vendedores** (carga pedido → preparación → despacho → entrega)
2. **Cobros y cuenta corriente** (registro pago → imputación → bloqueo automático)
3. **Rendición logística** (hoja de ruta → cobros → devoluciones → ajustes)

### Enfoque técnico

- Crear un archivo `src/lib/imprimirWorkflows.ts` con funciones que generen documentos HTML imprimibles (mismo patrón que `imprimirRemito.ts` y `imprimirConsolidado.ts`) con los diagramas de flujo renderizados como tablas/bloques HTML con flechas CSS (no Mermaid, para máxima compatibilidad con impresión).
- Agregar una nueva Card "Documentación de Procesos" en `src/pages/Configuracion.tsx` con 3 botones: uno por cada workflow. Al hacer click se abre ventana de impresión (el usuario puede guardar como PDF desde el diálogo de impresión del navegador).
- Usar iconos `FileText` y `Printer` de lucide-react.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/imprimirWorkflows.ts` | **Nuevo** - 3 funciones de generación HTML para cada workflow |
| `src/pages/Configuracion.tsx` | Agregar Card con botones de descarga |

