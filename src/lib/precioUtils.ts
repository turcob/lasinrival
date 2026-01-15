// Utilidades para cálculo de precios con sistema de prioridad

export interface ListaPrecioConNivel {
  id: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
  nivel: 'global' | 'marca' | 'tipo_producto';
  prioridad: number;
  marca_id: string | null;
  tipo_producto_id: string | null;
}

export interface ProductoConRelaciones {
  id: string;
  precio_costo: number;
  marca_id: string | null;
  tipo_producto_id: string | null;
}

/**
 * Calcula el porcentaje de ganancia aplicable a un producto
 * basándose en la jerarquía de prioridad:
 * 1. Lista por Marca (prioridad más alta)
 * 2. Lista por Tipo de Producto
 * 3. Lista Global (prioridad más baja)
 */
export function calcularPorcentajeProducto(
  producto: ProductoConRelaciones,
  listasPrecios: ListaPrecioConNivel[]
): { porcentaje: number; listaAplicada: ListaPrecioConNivel | null } {
  // Filtrar solo listas activas
  const listasActivas = listasPrecios.filter(l => l.activo);
  
  // Ordenar por prioridad descendente (mayor prioridad primero)
  const listasOrdenadas = [...listasActivas].sort((a, b) => b.prioridad - a.prioridad);
  
  // 1. Buscar lista por marca del producto (prioridad más alta)
  if (producto.marca_id) {
    const listaMarca = listasOrdenadas.find(l => 
      l.nivel === 'marca' && l.marca_id === producto.marca_id
    );
    if (listaMarca) {
      return { porcentaje: listaMarca.porcentaje, listaAplicada: listaMarca };
    }
  }
  
  // 2. Buscar lista por tipo de producto
  if (producto.tipo_producto_id) {
    const listaTipo = listasOrdenadas.find(l => 
      l.nivel === 'tipo_producto' && l.tipo_producto_id === producto.tipo_producto_id
    );
    if (listaTipo) {
      return { porcentaje: listaTipo.porcentaje, listaAplicada: listaTipo };
    }
  }
  
  // 3. Buscar lista global (o la primera disponible)
  const listaGlobal = listasOrdenadas.find(l => l.nivel === 'global');
  if (listaGlobal) {
    return { porcentaje: listaGlobal.porcentaje, listaAplicada: listaGlobal };
  }
  
  // Si no hay ninguna lista, retornar 0
  return { porcentaje: 0, listaAplicada: null };
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
 * considerando el sistema de prioridad de listas de precios
 */
export function obtenerPrecioVentaProducto(
  producto: ProductoConRelaciones,
  listasPrecios: ListaPrecioConNivel[]
): { precioVenta: number; porcentaje: number; listaAplicada: ListaPrecioConNivel | null } {
  const { porcentaje, listaAplicada } = calcularPorcentajeProducto(producto, listasPrecios);
  const precioVenta = calcularPrecioVenta(producto.precio_costo, porcentaje);
  
  return { precioVenta, porcentaje, listaAplicada };
}

/**
 * Obtiene la prioridad por defecto según el nivel
 */
export function getPrioridadPorNivel(nivel: string): number {
  switch (nivel) {
    case 'marca':
      return 3;
    case 'tipo_producto':
      return 2;
    case 'global':
    default:
      return 1;
  }
}
