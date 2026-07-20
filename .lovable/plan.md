
## Objetivo

Crear una página estática `/ayuda` accesible desde el menú lateral, orientada a que un usuario nuevo entienda los **circuitos comerciales** del negocio (no solo pantallas sueltas). Contenido en español (AR), responsive, con índice lateral fijo y flujos visuales tipo stepper.

## Alcance

- Sin cambios de backend, sin tablas nuevas, sin RLS.
- Todo el contenido vive en componentes React (`src/pages/Ayuda.tsx` + subcomponentes en `src/components/ayuda/`).
- Accesible a todos los roles autenticados (sin restricción por permisos de módulo).

## Estructura de la página

```text
/ayuda
├── Sidebar interno (sticky en desktop, tabs en mobile)
│   ├─ Introducción
│   ├─ Roles
│   ├─ Flujos
│   │   ├─ Venta mostrador (contado)
│   │   ├─ Venta en cuenta corriente
│   │   ├─ Pedido → Entrega → Cobro
│   │   ├─ Facturación y NC
│   │   └─ Ciclo financiero
│   └─ Pantallas (referencia)
└─ Contenido (scroll con anchors)
```

### 1. Introducción
Bloque corto: qué es el sistema (gestión integral mayorista + mostrador + reparto) y su propósito operativo.

### 2. Roles
Grilla de tarjetas (una por rol): **admin, encargado, cajero, vendedor, depósito, chofer**. Cada tarjeta: ícono lucide + una línea de qué puede hacer.

### 3. Flujos principales (bloque dominante)
Cada flujo se renderiza con un **Stepper vertical** (componente propio `<FlujoStepper />`) mostrando pasos numerados con ícono, título, descripción breve y un chip "Pantalla: [link a #pantalla-x]" que hace scroll al acordeón de la sección 4.

Flujos incluidos (mismos 5 que pide el usuario):
1. **Venta en mostrador (contado)** — productos → carrito → cliente opcional → cobro multi-medio → factura AFIP → ticket térmico.
2. **Venta en cuenta corriente** — igual, sin cobro, impacto en CC.
3. **Pedido → Entrega → Cobro (reparto)** — toma pedido → preparación → hoja de ruta → carga → reparto (cobro/devolución/rechazo) → rendición chofer → despacho automático → venta + factura.
4. **Facturación y Notas de Crédito** — emisión AFIP, NC total vs parcial, resolución financiera automática (Caja vs CC según origen del pago).
5. **Ciclo financiero** — cobranzas → rendiciones → impacto en cajas → imputación de pagos; ramas para cheques y transferencias.

### 4. Explicación de pantallas (referencia)
Acordeón (`shadcn Accordion`) agrupado por módulo:
- POS, Pedidos, Logística, Facturación, Cajas, Clientes, Empleados, Proveedores, Configuración.

Cada item: **qué es**, **para qué se usa**, **en qué flujo participa** (link ancla al flujo de la sección 3).

## Diseño

- Layout: `grid` con `<aside>` sticky (índice) + `<main>` scrolleable. En mobile, el índice se colapsa a `Tabs` horizontales scrolleables.
- Tokens semánticos de `src/index.css` (`bg-card`, `text-foreground`, `border-border`, `text-primary`, etc.). Cero colores hardcodeados.
- Steppers: círculo numerado con `bg-primary text-primary-foreground`, líneas conectoras con `bg-border`, íconos lucide dentro de cada paso.
- Tipografía existente (Inter). Títulos con `text-2xl font-bold tracking-tight`, subtítulos `text-lg font-semibold`.
- Responsive: breakpoint `md` para pasar de sidebar a tabs.

## Cambios técnicos

1. **`src/pages/Ayuda.tsx`** — página nueva envuelta en `<MainLayout>` con `<PageHeader title="Ayuda / Manual de uso" />` y layout de dos columnas.
2. **`src/components/ayuda/FlujoStepper.tsx`** — componente reutilizable (props: `titulo`, `descripcion`, `pasos[]`).
3. **`src/components/ayuda/RolCard.tsx`** — tarjeta de rol.
4. **`src/components/ayuda/PantallaAccordion.tsx`** — acordeón agrupado por módulo.
5. **`src/components/ayuda/ayudaContent.ts`** — data estática (roles, flujos, pantallas) para mantener el JSX limpio.
6. **`src/App.tsx`** — nueva ruta `<Route path="/ayuda" element={<ProtectedRoute><Ayuda /></ProtectedRoute>} />`.
7. **`src/components/layout/AppSidebar.tsx`** — nuevo item en `adminNavItems` (o en un grupo "Ayuda" al pie) con ícono `HelpCircle`, sin `module` para que sea visible a todos los roles.

## Fuera de alcance

- Sin edición de contenido desde la UI (no CMS).
- Sin búsqueda full-text (puede sumarse después).
- Sin cambios en `index.css` ni `tailwind.config.ts`.
