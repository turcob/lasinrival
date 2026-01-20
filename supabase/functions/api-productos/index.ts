import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const productId = pathParts[pathParts.length - 1] !== 'api-productos' ? pathParts[pathParts.length - 1] : null

    // GET - Listar productos o obtener uno específico
    if (req.method === 'GET') {
      if (productId && productId !== 'api-productos') {
        // Obtener producto específico por ID o código
        const { data, error } = await supabase
          .from('productos')
          .select(`
            *,
            categorias(id, nombre),
            subcategorias(id, nombre),
            marcas(id, nombre),
            tipos_producto(id, nombre)
          `)
          .or(`id.eq.${productId},codigo_articulo.eq.${productId},codigo_barra.eq.${productId}`)
          .single()

        if (error) {
          return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Listar productos con filtros opcionales
      const search = url.searchParams.get('search') || ''
      const categoria = url.searchParams.get('categoria')
      const activo = url.searchParams.get('activo')
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      let query = supabase
        .from('productos')
        .select(`
          *,
          categorias(id, nombre),
          subcategorias(id, nombre),
          marcas(id, nombre),
          tipos_producto(id, nombre)
        `, { count: 'exact' })

      if (search) {
        query = query.or(`descripcion.ilike.%${search}%,codigo_articulo.ilike.%${search}%,codigo_barra.ilike.%${search}%`)
      }

      if (categoria) {
        query = query.eq('categoria_id', categoria)
      }

      if (activo !== null && activo !== undefined) {
        query = query.eq('activo', activo === 'true')
      }

      const { data, error, count } = await query
        .order('descripcion')
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Error fetching productos:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        data,
        pagination: {
          total: count,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST - Crear producto
    if (req.method === 'POST') {
      const body = await req.json()

      const { data, error } = await supabase
        .from('productos')
        .insert({
          codigo_articulo: body.codigo_articulo,
          descripcion: body.descripcion,
          precio_costo: body.precio_costo || 0,
          unidad_medida: body.unidad_medida,
          categoria_id: body.categoria_id,
          subcategoria_id: body.subcategoria_id,
          marca_id: body.marca_id,
          tipo_producto_id: body.tipo_producto_id,
          codigo_barra: body.codigo_barra,
          stock_actual: body.stock_actual || 0,
          stock_minimo: body.stock_minimo || 0,
          cantidad_por_empaque: body.cantidad_por_empaque,
          activo: body.activo !== false
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating producto:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PUT/PATCH - Actualizar producto
    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'ID de producto requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const body = await req.json()
      const updateData: Record<string, unknown> = {}

      // Solo incluir campos que vienen en el body
      const allowedFields = [
        'codigo_articulo', 'descripcion', 'precio_costo', 'unidad_medida',
        'categoria_id', 'subcategoria_id', 'marca_id', 'tipo_producto_id',
        'codigo_barra', 'stock_actual', 'stock_minimo', 'cantidad_por_empaque', 'activo'
      ]

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      const { data, error } = await supabase
        .from('productos')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single()

      if (error) {
        console.error('Error updating producto:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE - Eliminar producto
    if (req.method === 'DELETE') {
      if (!productId) {
        return new Response(JSON.stringify({ error: 'ID de producto requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', productId)

      if (error) {
        console.error('Error deleting producto:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
