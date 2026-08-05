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
