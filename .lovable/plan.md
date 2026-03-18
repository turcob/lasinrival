

# Importar Excel para marcar productos como "Frio"

## Objetivo
Crear un importador especializado que lea un archivo Excel, compare los productos por codigo de articulo (`COD_ARTIC`) y actualice unicamente el campo `es_frio` en la base de datos. No se agregan ni eliminan productos.

## Logica del importador

1. El usuario selecciona un archivo Excel
2. Se lee la primera hoja del archivo
3. Por cada fila, se toma:
   - `COD_ARTIC` (codigo de articulo)
   - `CATEGORIO PARA LISTAS` (si el valor es "frio", se marca como frio)
4. Se buscan todos los productos existentes en la base de datos por `codigo_articulo`
5. Para cada coincidencia:
   - Si `CATEGORIO PARA LISTAS` = "frio" (case insensitive) -> `es_frio = true`
   - Si no es "frio" -> `es_frio = false`
6. Se actualiza en lotes de 100 para rendimiento
7. Se muestra resumen: cantidad actualizados como frio, cantidad marcados como no frio, no encontrados

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/components/productos/ImportarFriosDialog.tsx` | Nuevo - Dialog con el importador |
| `src/pages/Productos.tsx` | Modificar - Agregar boton "Importar Frios" que abre el dialog |

## Detalle tecnico

### ImportarFriosDialog.tsx
- Componente Dialog con input de archivo Excel
- Usa la libreria `xlsx` ya instalada
- Proceso:
  1. Lee el Excel con `XLSX.read()`
  2. Extrae `COD_ARTIC` y `CATEGORIO PARA LISTAS` de cada fila (con normalizacion de nombres de columna mediante trim)
  3. Busca todos los productos en la DB con paginacion (batches de 1000) para superar el limite de Supabase
  4. Crea un mapa `codigo_articulo -> id` de productos existentes
  5. Recorre las filas del Excel, y por cada coincidencia arma un update
  6. Ejecuta updates en lotes de 100
  7. Muestra barra de progreso y resumen final (marcados frio, marcados no frio, no encontrados)

### Productos.tsx
- Se agrega un boton "Importar Frios" (con icono de copo de nieve o similar) junto a los botones existentes de importacion
- Al hacer clic, abre el `ImportarFriosDialog`

