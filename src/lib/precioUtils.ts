// Utilidades para cálculo de precios con sistema matricial
// Prioridad: Excepción > Marca > Tipo de Producto > General

export interface ListaPrecio {
  id: string;
  nombre: string;
  codigo: string | null;
  orden: number;
  activo: boolean;
}

export interface PorcentajeMatriz {
  id: string;
  lista_precio_id: string;
  marca_id: string | null;
  tipo_producto_id: string | null;
  es_general: boolean;
  porcentaje: number;
}

export interface ExcepcionProducto {
  id: string;
  lista_precio_id: string | null; // null = aplica a todas las listas
  producto_id: string;
  porcentaje: number | null;
  precio_fijo?: number | null; // precio de venta final, sin cálculo porcentual
  descripcion: string | null;
  fecha_inicio: string | null; // null = sin límite de inicio
  fecha_fin: string | null; // null = sin límite de fin
}

export interface ProductoParaCalculo {
  id: string;
  precio_costo: number;
  marca_id: string | null;
  tipo_producto_id: string | null;
}

/** Tramo de precio por cantidad. Si no hay tramos, el cálculo es idéntico al histórico. */
export interface EscalaCantidad {
  id: string;
  lista_precio_id: string | null; // null = aplica a todas las listas
  producto_id: string;
  cantidad_desde: number;
  precio_unitario: number | null;
  porcentaje: number | null;
  descripcion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
}

/**
 * Calcula el porcentaje de ganancia para un producto en una lista específica
 * Jerarquía de prioridad:
 * 1. Excepción por producto específico (mayor prioridad)
 * 2. Porcentaje por Marca del producto
 * 3. Porcentaje por Tipo de Producto
 * 4. Porcentaje General (menor prioridad)
 */
export function calcularPorcentajeProducto(
  producto: ProductoParaCalculo,
  listaId: string,
  matrizPorcentajes: PorcentajeMatriz[],
  excepciones: ExcepcionProducto[]
): { porcentaje: number; origen: 'excepcion' | 'fijo' | 'marca' | 'tipo' | 'general' | 'ninguno'; descripcion: string; precioFijo?: number } {
  
  // 1. Buscar excepción específica del producto (considerando vigencia)
  const hoy = new Date().toISOString().split('T')[0];
  const excepcion = excepciones.find(e => {
    if (e.producto_id !== producto.id) return false;
    if (e.lista_precio_id !== listaId && e.lista_precio_id !== null) return false;
    // Verificar vigencia por fechas
    const inicioOk = !e.fecha_inicio || e.fecha_inicio <= hoy;
    const finOk = !e.fecha_fin || e.fecha_fin >= hoy;
    return inicioOk && finOk;
  });
  if (excepcion) {
    if (excepcion.precio_fijo !== null && excepcion.precio_fijo !== undefined) {
      return {
        porcentaje: 0,
        origen: 'fijo',
        descripcion: excepcion.descripcion || 'Precio fijo',
        precioFijo: Number(excepcion.precio_fijo),
      };
    }
    return { 
      porcentaje: Number(excepcion.porcentaje ?? 0), 
      origen: 'excepcion',
      descripcion: excepcion.descripcion || 'Excepción'
    };
  }
  
  // 2. Buscar por MARCA del producto (PRIORIDAD ALTA)
  if (producto.marca_id) {
    const porMarca = matrizPorcentajes.find(p => 
      p.lista_precio_id === listaId && 
      p.marca_id === producto.marca_id &&
      !p.es_general
    );
    if (porMarca) {
      return { 
        porcentaje: porMarca.porcentaje, 
        origen: 'marca',
        descripcion: 'Por marca'
      };
    }
  }
  
  // 3. Buscar por TIPO DE PRODUCTO (PRIORIDAD MEDIA)
  if (producto.tipo_producto_id) {
    const porTipo = matrizPorcentajes.find(p => 
      p.lista_precio_id === listaId && 
      p.tipo_producto_id === producto.tipo_producto_id &&
      !p.es_general
    );
    if (porTipo) {
      return { 
        porcentaje: porTipo.porcentaje, 
        origen: 'tipo',
        descripcion: 'Por tipo'
      };
    }
  }
  
  // 4. Usar porcentaje GENERAL (FALLBACK)
  const general = matrizPorcentajes.find(p => 
    p.lista_precio_id === listaId && 
    p.es_general === true
  );
  if (general) {
    return { 
      porcentaje: general.porcentaje, 
      origen: 'general',
      descripcion: 'General'
    };
  }
  
  // Si no hay ningún porcentaje definido
  return { 
    porcentaje: 0, 
    origen: 'ninguno',
    descripcion: 'Sin precio definido'
  };
}

/**
 * Calcula el precio de venta de un producto
 */
export function calcularPrecioVenta(
  precioCosto: number,
  porcentaje: number
): number {
  return precioCosto * (1 + porcentaje / 100);
}

/**
 * Obtiene el precio de venta final de un producto
 * considerando el sistema de prioridad matricial
 */
export function obtenerPrecioVentaProducto(
  producto: ProductoParaCalculo,
  listaId: string,
  matrizPorcentajes: PorcentajeMatriz[],
  excepciones: ExcepcionProducto[]
): { precioVenta: number; porcentaje: number; origen: string; descripcion: string } {
  const resultado = calcularPorcentajeProducto(producto, listaId, matrizPorcentajes, excepciones);
  const precioVenta = resultado.origen === 'fijo' && resultado.precioFijo !== undefined
    ? resultado.precioFijo
    : calcularPrecioVenta(producto.precio_costo, resultado.porcentaje);
  
  return { 
    precioVenta, 
    porcentaje: resultado.porcentaje, 
    origen: resultado.origen,
    descripcion: resultado.descripcion
  };
}

/** Devuelve los tramos vigentes de un producto para una lista, ordenados por cantidad_desde asc. */
export function escalasVigentes(
  productoId: string,
  listaId: string | null,
  escalas: EscalaCantidad[],
): EscalaCantidad[] {
  const hoy = new Date().toISOString().split('T')[0];
  return escalas
    .filter((e) => {
      if (e.producto_id !== productoId) return false;
      if (e.lista_precio_id !== null && e.lista_precio_id !== listaId) return false;
      const inicioOk = !e.fecha_inicio || e.fecha_inicio <= hoy;
      const finOk = !e.fecha_fin || e.fecha_fin >= hoy;
      return inicioOk && finOk;
    })
    // La escala específica de la lista gana sobre la global cuando comparten cantidad_desde
    .sort((a, b) =>
      a.cantidad_desde - b.cantidad_desde ||
      (a.lista_precio_id === null ? 1 : 0) - (b.lista_precio_id === null ? 1 : 0),
    )
    .filter((e, i, arr) => arr.findIndex((x) => x.cantidad_desde === e.cantidad_desde) === i);
}

/**
 * Precio unitario considerando tramos por cantidad.
 * Sin tramos aplicables devuelve exactamente el precio base (compatibilidad total).
 */
export function obtenerPrecioVentaPorCantidad(
  producto: ProductoParaCalculo,
  listaId: string,
  matrizPorcentajes: PorcentajeMatriz[],
  excepciones: ExcepcionProducto[],
  escalas: EscalaCantidad[],
  cantidad: number,
): {
  precioVenta: number;
  precioBase: number;
  origen: string;
  descripcion: string;
  escalaAplicada: EscalaCantidad | null;
} {
  const base = obtenerPrecioVentaProducto(producto, listaId, matrizPorcentajes, excepciones);
  const tramos = escalasVigentes(producto.id, listaId, escalas);
  const aplicable = [...tramos]
    .filter((e) => cantidad >= e.cantidad_desde)
    .sort((a, b) => b.cantidad_desde - a.cantidad_desde)[0];

  if (!aplicable) {
    return {
      precioVenta: base.precioVenta,
      precioBase: base.precioVenta,
      origen: base.origen,
      descripcion: base.descripcion,
      escalaAplicada: null,
    };
  }

  const precio =
    aplicable.precio_unitario !== null && aplicable.precio_unitario !== undefined
      ? Number(aplicable.precio_unitario)
      : calcularPrecioVenta(producto.precio_costo, Number(aplicable.porcentaje ?? 0));

  return {
    precioVenta: Math.round(precio * 100) / 100,
    precioBase: base.precioVenta,
    origen: 'escala',
    descripcion: aplicable.descripcion || `Desde ${aplicable.cantidad_desde} u.`,
    escalaAplicada: aplicable,
  };
}

export interface CoherenciaEmpaque {
  ok: boolean;
  precioCajaUnitario: number;
  precioEquivalenteUnidad: number;
  diferenciaPorcentaje: number;
  mensaje: string;
}

/**
 * Compara el precio unitario del producto caja contra el tramo equivalente del producto unidad.
 * Informativo: nunca bloquea la venta.
 */
export function calcularCoherenciaEmpaque(
  precioCajaTotal: number,
  unidadesPorCaja: number,
  precioUnidadEnTramo: number,
  toleranciaPorcentaje = 1,
): CoherenciaEmpaque {
  if (!unidadesPorCaja || unidadesPorCaja <= 0 || !precioUnidadEnTramo) {
    return {
      ok: true,
      precioCajaUnitario: 0,
      precioEquivalenteUnidad: 0,
      diferenciaPorcentaje: 0,
      mensaje: 'Sin datos suficientes para comparar',
    };
  }
  const cajaUnitario = precioCajaTotal / unidadesPorCaja;
  const dif = ((cajaUnitario - precioUnidadEnTramo) / precioUnidadEnTramo) * 100;
  const ok = Math.abs(dif) <= toleranciaPorcentaje;
  return {
    ok,
    precioCajaUnitario: Math.round(cajaUnitario * 100) / 100,
    precioEquivalenteUnidad: Math.round(precioUnidadEnTramo * 100) / 100,
    diferenciaPorcentaje: Math.round(dif * 100) / 100,
    mensaje: ok
      ? 'Precios coherentes'
      : `La caja queda ${dif > 0 ? 'más cara' : 'más barata'} ${Math.abs(Math.round(dif * 100) / 100)}% que el equivalente por unidad`,
  };
}
