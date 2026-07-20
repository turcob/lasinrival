import {
  ShieldCheck,
  UserCog,
  Wallet,
  UserCheck,
  PackageSearch,
  Truck,
  ShoppingCart,
  CreditCard,
  ClipboardList,
  Route as RouteIcon,
  FileText,
  Receipt,
  Building2,
  Users,
  Settings,
  Package,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

export interface Rol {
  nombre: string;
  descripcion: string;
  icon: LucideIcon;
}

export const roles: Rol[] = [
  {
    nombre: "Administrador",
    descripcion:
      "Acceso total: configura el sistema, gestiona usuarios, roles y ve todos los reportes.",
    icon: ShieldCheck,
  },
  {
    nombre: "Encargado",
    descripcion:
      "Supervisa la operación diaria: cajas, pedidos, logística y liquidaciones.",
    icon: UserCog,
  },
  {
    nombre: "Cajero",
    descripcion:
      "Opera el POS de mostrador, cobra ventas y realiza arqueos de caja.",
    icon: Wallet,
  },
  {
    nombre: "Vendedor",
    descripcion:
      "Toma pedidos, gestiona clientes de su zona y emite comprobantes/NC.",
    icon: UserCheck,
  },
  {
    nombre: "Depósito",
    descripcion:
      "Prepara pedidos, arma hojas de ruta y controla la carga de vehículos.",
    icon: PackageSearch,
  },
  {
    nombre: "Chofer",
    descripcion:
      "Ejecuta el reparto desde la app móvil: cobra, registra devoluciones y rinde.",
    icon: Truck,
  },
];

export interface PasoFlujo {
  titulo: string;
  descripcion: string;
  pantallaId?: string;
  icon: LucideIcon;
}

export interface Flujo {
  id: string;
  titulo: string;
  resumen: string;
  icon: LucideIcon;
  pasos: PasoFlujo[];
}

export const flujos: Flujo[] = [
  {
    id: "venta-mostrador",
    titulo: "Venta en mostrador (contado)",
    resumen:
      "Circuito estándar del POS cuando el cliente paga en el acto por cualquier medio.",
    icon: ShoppingCart,
    pasos: [
      {
        titulo: "Búsqueda y carga de productos",
        descripcion:
          "El cajero busca productos por código o nombre y los suma al carrito con cantidad y precio.",
        pantallaId: "pantalla-pos",
        icon: Package,
      },
      {
        titulo: "Cliente (opcional)",
        descripcion:
          "Se puede asociar un cliente para trazabilidad o dejar la venta como consumidor final.",
        pantallaId: "pantalla-clientes",
        icon: Users,
      },
      {
        titulo: "Cobro multi-medio",
        descripcion:
          "Se combinan efectivo, tarjeta, transferencia y/o cheque hasta cubrir el total. El sistema calcula recargos de tarjeta automáticamente.",
        pantallaId: "pantalla-pos",
        icon: CreditCard,
      },
      {
        titulo: "Factura AFIP",
        descripcion:
          "Si corresponde, se emite Factura A/B/C contra AFIP y se guarda CAE + QR.",
        pantallaId: "pantalla-facturacion",
        icon: FileText,
      },
      {
        titulo: "Ticket térmico e impacto en caja",
        descripcion:
          "Se imprime ticket 80mm y se registra ingreso en la caja del usuario.",
        pantallaId: "pantalla-cajas",
        icon: Receipt,
      },
    ],
  },
  {
    id: "venta-cc",
    titulo: "Venta en cuenta corriente",
    resumen:
      "Mismo flujo del POS pero sin cobro: la deuda queda registrada en la CC del cliente.",
    icon: ClipboardList,
    pasos: [
      {
        titulo: "Selección obligatoria de cliente",
        descripcion:
          "La CC requiere cliente asignado. Si supera el límite o tiene deuda vencida, el sistema bloquea la venta.",
        pantallaId: "pantalla-clientes",
        icon: Users,
      },
      {
        titulo: "Carga de productos y confirmación CC",
        descripcion:
          "Se cargan productos y se elige 'Cuenta Corriente' como forma de pago.",
        pantallaId: "pantalla-pos",
        icon: ShoppingCart,
      },
      {
        titulo: "Emisión de factura AFIP",
        descripcion:
          "Se emite la factura y se imprime ticket que indica 'Cond. Venta: Cuenta Corriente'.",
        pantallaId: "pantalla-facturacion",
        icon: FileText,
      },
      {
        titulo: "Impacto en CC del cliente",
        descripcion:
          "Se genera un movimiento tipo 'factura' en la cuenta corriente aumentando el saldo deudor.",
        pantallaId: "pantalla-clientes",
        icon: DollarSign,
      },
    ],
  },
  {
    id: "pedido-entrega-cobro",
    titulo: "Pedido → Entrega → Cobro (reparto)",
    resumen:
      "Circuito completo mayorista: desde que el vendedor toma el pedido hasta que se rinde el reparto.",
    icon: Truck,
    pasos: [
      {
        titulo: "Toma de pedido",
        descripcion:
          "El vendedor carga el pedido del cliente (estado 'pendiente'). Se validan deuda y sugerencias de productos.",
        pantallaId: "pantalla-pedidos",
        icon: ClipboardList,
      },
      {
        titulo: "Preparación en depósito",
        descripcion:
          "Depósito prepara los bultos y confirma cantidades reales. El pedido pasa a 'preparado'.",
        pantallaId: "pantalla-pedidos",
        icon: PackageSearch,
      },
      {
        titulo: "Armado de Hoja de Ruta",
        descripcion:
          "Se agrupan pedidos preparados por zona y se asignan a un chofer/vehículo.",
        pantallaId: "pantalla-logistica",
        icon: RouteIcon,
      },
      {
        titulo: "Carga del vehículo",
        descripcion:
          "Se controla la carga contra la hoja de ruta y se marca la hoja como 'En Ruta'.",
        pantallaId: "pantalla-logistica",
        icon: Truck,
      },
      {
        titulo: "Reparto (app chofer)",
        descripcion:
          "En cada parada el chofer registra cobro, devolución parcial o rechazo total desde la APK.",
        pantallaId: "pantalla-encargado",
        icon: Wallet,
      },
      {
        titulo: "Despacho automático",
        descripcion:
          "Al marcar la hoja 'En Ruta' los pedidos pasan automáticamente a 'despachado' y se generan las ventas.",
        pantallaId: "pantalla-pedidos",
        icon: FileText,
      },
      {
        titulo: "Rendición del chofer",
        descripcion:
          "Al regresar, se rinden cobros (efectivo, cheques, transferencias) y se concilian devoluciones.",
        pantallaId: "pantalla-logistica",
        icon: Receipt,
      },
    ],
  },
  {
    id: "facturacion-nc",
    titulo: "Facturación y Notas de Crédito",
    resumen:
      "Emisión de comprobantes AFIP y devoluciones vía NC total o parcial con resolución financiera automática.",
    icon: FileText,
    pasos: [
      {
        titulo: "Emisión de comprobante AFIP",
        descripcion:
          "Facturas A/B/C se emiten desde POS o Pedidos. Se guarda CAE, vencimiento y QR.",
        pantallaId: "pantalla-facturacion",
        icon: FileText,
      },
      {
        titulo: "NC Total (anulación)",
        descripcion:
          "Anula íntegramente una factura. Reingresa stock y opcionalmente anula la venta.",
        pantallaId: "pantalla-facturacion",
        icon: Receipt,
      },
      {
        titulo: "NC Parcial",
        descripcion:
          "Permite devolver ítems puntuales o aplicar descuento comercial sobre una factura ya emitida.",
        pantallaId: "pantalla-facturacion",
        icon: ClipboardList,
      },
      {
        titulo: "Resolución financiera automática",
        descripcion:
          "Si el pago original fue en efectivo → egreso automático en caja. Si fue en CC → crédito en la cuenta corriente del cliente.",
        pantallaId: "pantalla-cajas",
        icon: DollarSign,
      },
    ],
  },
  {
    id: "ciclo-financiero",
    titulo: "Ciclo financiero",
    resumen:
      "Cómo el dinero recorre el sistema: cobranzas, rendiciones, cajas e imputación.",
    icon: DollarSign,
    pasos: [
      {
        titulo: "Cobranza",
        descripcion:
          "En POS, en reparto o carga manual desde la CC del cliente. Se admiten pagos parciales y multi-medio.",
        pantallaId: "pantalla-clientes",
        icon: Wallet,
      },
      {
        titulo: "Rendición",
        descripcion:
          "Vendedores y choferes rinden lo recaudado. Cada rendición se asocia a una caja de destino.",
        pantallaId: "pantalla-logistica",
        icon: Receipt,
      },
      {
        titulo: "Impacto en cajas",
        descripcion:
          "Cada ingreso/egreso queda registrado en la caja abierta con auditoría de usuario y arqueo diario.",
        pantallaId: "pantalla-cajas",
        icon: CreditCard,
      },
      {
        titulo: "Imputación de pagos",
        descripcion:
          "Los pagos (REC/NCR) se aplican FIFO a las facturas pendientes del cliente. Las transferencias requieren validación con comprobante.",
        pantallaId: "pantalla-imputacion",
        icon: ClipboardList,
      },
      {
        titulo: "Cheques y transferencias",
        descripcion:
          "Los cheques recorren 7 estados (cartera → depositado → acreditado / rechazado). Las transferencias se validan por número de operación único.",
        pantallaId: "pantalla-cheques",
        icon: FileText,
      },
    ],
  },
];

export interface Pantalla {
  id: string;
  nombre: string;
  ruta: string;
  queEs: string;
  paraQue: string;
  flujos: { id: string; label: string }[];
}

export interface ModuloPantallas {
  modulo: string;
  icon: LucideIcon;
  pantallas: Pantalla[];
}

export const modulos: ModuloPantallas[] = [
  {
    modulo: "POS",
    icon: ShoppingCart,
    pantallas: [
      {
        id: "pantalla-pos",
        nombre: "Punto de Venta",
        ruta: "/pos",
        queEs: "Terminal de venta para mostrador y ventas asistidas.",
        paraQue:
          "Cargar productos, cobrar por múltiples medios, emitir factura y ticket.",
        flujos: [
          { id: "venta-mostrador", label: "Venta en mostrador" },
          { id: "venta-cc", label: "Venta en CC" },
        ],
      },
    ],
  },
  {
    modulo: "Pedidos",
    icon: ClipboardList,
    pantallas: [
      {
        id: "pantalla-pedidos",
        nombre: "Gestión de Pedidos",
        ruta: "/pedidos",
        queEs: "Bandeja centralizada de pedidos por estado.",
        paraQue:
          "Tomar, preparar, editar y consolidar pedidos antes de armar la hoja de ruta.",
        flujos: [{ id: "pedido-entrega-cobro", label: "Pedido → Entrega → Cobro" }],
      },
    ],
  },
  {
    modulo: "Logística",
    icon: Truck,
    pantallas: [
      {
        id: "pantalla-logistica",
        nombre: "Logística",
        ruta: "/logistica",
        queEs: "Armado de hojas de ruta, carga, despacho y rendición.",
        paraQue:
          "Asignar pedidos preparados a choferes/vehículos y cerrar la operación del día.",
        flujos: [{ id: "pedido-entrega-cobro", label: "Pedido → Entrega → Cobro" }],
      },
      {
        id: "pantalla-encargado",
        nombre: "App Encargado / Chofer",
        ruta: "/encargado",
        queEs: "Vista móvil para ejecutar el reparto en calle.",
        paraQue:
          "Registrar cobros, devoluciones y rechazos parada por parada.",
        flujos: [{ id: "pedido-entrega-cobro", label: "Pedido → Entrega → Cobro" }],
      },
    ],
  },
  {
    modulo: "Facturación",
    icon: FileText,
    pantallas: [
      {
        id: "pantalla-facturacion",
        nombre: "Facturación Electrónica",
        ruta: "/facturacion",
        queEs: "Listado de comprobantes AFIP emitidos.",
        paraQue:
          "Consultar, reimprimir y generar Notas de Crédito totales o parciales.",
        flujos: [
          { id: "facturacion-nc", label: "Facturación y NC" },
          { id: "venta-mostrador", label: "Venta en mostrador" },
        ],
      },
    ],
  },
  {
    modulo: "Cajas",
    icon: CreditCard,
    pantallas: [
      {
        id: "pantalla-cajas",
        nombre: "Cajas",
        ruta: "/cajas",
        queEs: "Cajas por usuario con apertura, movimientos y arqueo.",
        paraQue:
          "Auditar ingresos/egresos, confirmar arqueos y ver saldo real.",
        flujos: [
          { id: "venta-mostrador", label: "Venta en mostrador" },
          { id: "ciclo-financiero", label: "Ciclo financiero" },
        ],
      },
      {
        id: "pantalla-imputacion",
        nombre: "Imputación / Asociar Pagos",
        ruta: "/imputacion",
        queEs: "Bandeja de transferencias y pagos pendientes de validar.",
        paraQue:
          "Confirmar/rechazar transferencias con comprobante y aplicar pagos a facturas (FIFO).",
        flujos: [{ id: "ciclo-financiero", label: "Ciclo financiero" }],
      },
      {
        id: "pantalla-cheques",
        nombre: "Cheques",
        ruta: "/cheques",
        queEs: "Cartera de cheques recibidos y entregados.",
        paraQue:
          "Seguir el ciclo (cartera → depósito → acreditado/rechazado) con historial completo.",
        flujos: [{ id: "ciclo-financiero", label: "Ciclo financiero" }],
      },
    ],
  },
  {
    modulo: "Clientes / Empleados / Proveedores",
    icon: Users,
    pantallas: [
      {
        id: "pantalla-clientes",
        nombre: "Clientes",
        ruta: "/clientes",
        queEs: "Padrón de clientes con CC, zonas y vendedor asignado.",
        paraQue:
          "Ver saldo, historial de movimientos, registrar pagos y notas de crédito manuales.",
        flujos: [
          { id: "venta-cc", label: "Venta en CC" },
          { id: "ciclo-financiero", label: "Ciclo financiero" },
        ],
      },
      {
        id: "pantalla-empleados",
        nombre: "Empleados",
        ruta: "/empleados",
        queEs: "Gestión de empleados con CC interna y liquidaciones.",
        paraQue:
          "Registrar movimientos, generar liquidaciones y pagos (que impactan en caja).",
        flujos: [{ id: "ciclo-financiero", label: "Ciclo financiero" }],
      },
      {
        id: "pantalla-proveedores",
        nombre: "Proveedores",
        ruta: "/proveedores",
        queEs: "Padrón de proveedores, órdenes de compra y CC.",
        paraQue:
          "Registrar pagos por efectivo, transferencia, cheque propio o de tercero.",
        flujos: [{ id: "ciclo-financiero", label: "Ciclo financiero" }],
      },
    ],
  },
  {
    modulo: "Configuración",
    icon: Settings,
    pantallas: [
      {
        id: "pantalla-usuarios",
        nombre: "Usuarios y Roles",
        ruta: "/usuarios",
        queEs: "Alta de usuarios, asignación de roles y permisos por módulo.",
        paraQue: "Controlar quién ve y puede operar cada sección del sistema.",
        flujos: [],
      },
      {
        id: "pantalla-configuracion",
        nombre: "Configuración",
        ruta: "/configuracion",
        queEs: "Datos del comercio, sucursales, integraciones y parámetros.",
        paraQue:
          "Definir nombre del sistema, logos, sucursales y credenciales de AFIP.",
        flujos: [],
      },
    ],
  },
];

export const secciones = [
  { id: "introduccion", label: "Introducción" },
  { id: "roles", label: "Roles" },
  { id: "flujos", label: "Flujos principales" },
  { id: "pantallas", label: "Pantallas (referencia)" },
];