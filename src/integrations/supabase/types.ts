export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_tokens: {
        Row: {
          admin_id: string
          created_at: string
          expira_en: string
          id: string
          token: string
          usado: boolean
        }
        Insert: {
          admin_id: string
          created_at?: string
          expira_en: string
          id?: string
          token: string
          usado?: boolean
        }
        Update: {
          admin_id?: string
          created_at?: string
          expira_en?: string
          id?: string
          token?: string
          usado?: boolean
        }
        Relationships: []
      }
      afip_tokens: {
        Row: {
          created_at: string
          expiration: string
          id: string
          service: string
          sign: string
          token: string
        }
        Insert: {
          created_at?: string
          expiration: string
          id?: string
          service: string
          sign: string
          token: string
        }
        Update: {
          created_at?: string
          expiration?: string
          id?: string
          service?: string
          sign?: string
          token?: string
        }
        Relationships: []
      }
      arqueo_detalles: {
        Row: {
          caja_id: string
          cantidad: number
          created_at: string | null
          denominacion: number
          id: string
          subtotal: number
        }
        Insert: {
          caja_id: string
          cantidad?: number
          created_at?: string | null
          denominacion: number
          id?: string
          subtotal?: number
        }
        Update: {
          caja_id?: string
          cantidad?: number
          created_at?: string | null
          denominacion?: number
          id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "arqueo_detalles_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
        ]
      }
      arqueo_otros_medios: {
        Row: {
          caja_id: string
          created_at: string | null
          id: string
          monto: number
          tipo: string
        }
        Insert: {
          caja_id: string
          created_at?: string | null
          id?: string
          monto?: number
          tipo: string
        }
        Update: {
          caja_id?: string
          created_at?: string | null
          id?: string
          monto?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "arqueo_otros_medios_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          created_at: string | null
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          id: string
          ip_address: string | null
          modulo: string
          registro_id: string | null
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string | null
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          ip_address?: string | null
          modulo: string
          registro_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string | null
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          ip_address?: string | null
          modulo?: string
          registro_id?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      cajas: {
        Row: {
          conteo_declarado: number | null
          created_at: string | null
          diferencia: number | null
          estado: Database["public"]["Enums"]["cash_register_status"] | null
          fecha_apertura: string | null
          fecha_cierre: string | null
          fondo_inicial: number
          id: string
          observaciones: string | null
          total_egresos: number | null
          total_ventas: number | null
          usuario_id: string
        }
        Insert: {
          conteo_declarado?: number | null
          created_at?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["cash_register_status"] | null
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          fondo_inicial?: number
          id?: string
          observaciones?: string | null
          total_egresos?: number | null
          total_ventas?: number | null
          usuario_id: string
        }
        Update: {
          conteo_declarado?: number | null
          created_at?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["cash_register_status"] | null
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          fondo_inicial?: number
          id?: string
          observaciones?: string | null
          total_egresos?: number | null
          total_ventas?: number | null
          usuario_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          activo: boolean | null
          codigo_familia: string
          created_at: string | null
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo_familia: string
          created_at?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo_familia?: string
          created_at?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          activo: boolean | null
          condicion_iva: number | null
          created_at: string | null
          direccion: string | null
          dni_cuit: string | null
          email: string | null
          id: string
          lista_precio_id: string | null
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          condicion_iva?: number | null
          created_at?: string | null
          direccion?: string | null
          dni_cuit?: string | null
          email?: string | null
          id?: string
          lista_precio_id?: string | null
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          condicion_iva?: number | null
          created_at?: string | null
          direccion?: string | null
          dni_cuit?: string | null
          email?: string | null
          id?: string
          lista_precio_id?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_lista_precio_id_fkey"
            columns: ["lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
        ]
      }
      comprobantes_afip: {
        Row: {
          cae: string
          cae_vencimiento: string
          created_at: string
          cuit_emisor: string
          cuit_receptor: string | null
          doc_nro: number
          doc_tipo: number
          estado: string
          fecha_emision: string
          id: string
          importe_iva: number
          importe_neto: number
          importe_total: number
          numero_comprobante: number
          punto_venta: number
          tipo_comprobante: number
          usuario_id: string
          venta_id: string | null
        }
        Insert: {
          cae: string
          cae_vencimiento: string
          created_at?: string
          cuit_emisor: string
          cuit_receptor?: string | null
          doc_nro: number
          doc_tipo: number
          estado?: string
          fecha_emision?: string
          id?: string
          importe_iva: number
          importe_neto: number
          importe_total: number
          numero_comprobante: number
          punto_venta: number
          tipo_comprobante: number
          usuario_id: string
          venta_id?: string | null
        }
        Update: {
          cae?: string
          cae_vencimiento?: string
          created_at?: string
          cuit_emisor?: string
          cuit_receptor?: string | null
          doc_nro?: number
          doc_tipo?: number
          estado?: string
          fecha_emision?: string
          id?: string
          importe_iva?: number
          importe_neto?: number
          importe_total?: number
          numero_comprobante?: number
          punto_venta?: number
          tipo_comprobante?: number
          usuario_id?: string
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_afip_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_comercio: {
        Row: {
          afip_modo: string
          codigo_postal: string | null
          condicion_iva: string
          created_at: string
          cuit: string
          direccion: string
          email: string | null
          id: string
          inicio_actividades: string | null
          localidad: string | null
          nombre_fantasia: string | null
          nombre_sistema: string | null
          provincia: string | null
          punto_venta: number
          razon_social: string
          telefono: string | null
          texto_login_footer: string | null
          updated_at: string
        }
        Insert: {
          afip_modo?: string
          codigo_postal?: string | null
          condicion_iva?: string
          created_at?: string
          cuit: string
          direccion: string
          email?: string | null
          id?: string
          inicio_actividades?: string | null
          localidad?: string | null
          nombre_fantasia?: string | null
          nombre_sistema?: string | null
          provincia?: string | null
          punto_venta?: number
          razon_social: string
          telefono?: string | null
          texto_login_footer?: string | null
          updated_at?: string
        }
        Update: {
          afip_modo?: string
          codigo_postal?: string | null
          condicion_iva?: string
          created_at?: string
          cuit?: string
          direccion?: string
          email?: string | null
          id?: string
          inicio_actividades?: string | null
          localidad?: string | null
          nombre_fantasia?: string | null
          nombre_sistema?: string | null
          provincia?: string | null
          punto_venta?: number
          razon_social?: string
          telefono?: string | null
          texto_login_footer?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracion_descuentos: {
        Row: {
          created_at: string | null
          descuento_maximo_global: number
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descuento_maximo_global?: number
          id?: string
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descuento_maximo_global?: number
          id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      descuentos_producto_rol: {
        Row: {
          created_at: string | null
          descuento_maximo: number
          id: string
          producto_id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          descuento_maximo?: number
          id?: string
          producto_id: string
          role: string
        }
        Update: {
          created_at?: string | null
          descuento_maximo?: number
          id?: string
          producto_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "descuentos_producto_rol_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_liquidaciones: {
        Row: {
          anio: number
          caja_id: string | null
          created_at: string | null
          empleado_id: string
          estado: string | null
          fecha_pago: string | null
          forma_pago_id: string | null
          id: string
          mes: number
          neto_a_pagar: number
          observaciones: string | null
          sueldo_base: number
          total_comisiones: number | null
          total_descuentos: number | null
          usuario_id: string
        }
        Insert: {
          anio: number
          caja_id?: string | null
          created_at?: string | null
          empleado_id: string
          estado?: string | null
          fecha_pago?: string | null
          forma_pago_id?: string | null
          id?: string
          mes: number
          neto_a_pagar: number
          observaciones?: string | null
          sueldo_base: number
          total_comisiones?: number | null
          total_descuentos?: number | null
          usuario_id: string
        }
        Update: {
          anio?: number
          caja_id?: string | null
          created_at?: string | null
          empleado_id?: string
          estado?: string | null
          fecha_pago?: string | null
          forma_pago_id?: string | null
          id?: string
          mes?: number
          neto_a_pagar?: number
          observaciones?: string | null
          sueldo_base?: number
          total_comisiones?: number | null
          total_descuentos?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_liquidaciones_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_liquidaciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_liquidaciones_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_movimientos: {
        Row: {
          concepto: string | null
          created_at: string | null
          empleado_id: string
          fecha: string | null
          id: string
          monto: number
          tipo: string
          usuario_registro_id: string
          venta_id: string | null
        }
        Insert: {
          concepto?: string | null
          created_at?: string | null
          empleado_id: string
          fecha?: string | null
          id?: string
          monto: number
          tipo: string
          usuario_registro_id: string
          venta_id?: string | null
        }
        Update: {
          concepto?: string | null
          created_at?: string | null
          empleado_id?: string
          fecha?: string | null
          id?: string
          monto?: number
          tipo?: string
          usuario_registro_id?: string
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empleado_movimientos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_movimientos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean | null
          cargo: string | null
          cbu_cuenta: string | null
          created_at: string | null
          direccion: string | null
          dni: string | null
          email: string | null
          estado_civil: string | null
          fecha_ingreso: string | null
          id: string
          nombre: string
          sucursal_id: string | null
          sueldo_base: number | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          cargo?: string | null
          cbu_cuenta?: string | null
          created_at?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          estado_civil?: string | null
          fecha_ingreso?: string | null
          id?: string
          nombre: string
          sucursal_id?: string | null
          sueldo_base?: number | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          cargo?: string | null
          cbu_cuenta?: string | null
          created_at?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          estado_civil?: string | null
          fecha_ingreso?: string | null
          id?: string
          nombre?: string
          sucursal_id?: string | null
          sueldo_base?: number | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empleados_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pago: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      lista_precio_excepciones: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          lista_precio_id: string | null
          porcentaje: number
          producto_id: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          lista_precio_id?: string | null
          porcentaje?: number
          producto_id: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          lista_precio_id?: string | null
          porcentaje?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_precio_excepciones_lista_precio_id_fkey"
            columns: ["lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_precio_excepciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_precio_porcentajes: {
        Row: {
          created_at: string | null
          es_general: boolean | null
          id: string
          lista_precio_id: string
          marca_id: string | null
          porcentaje: number
          tipo_producto_id: string | null
        }
        Insert: {
          created_at?: string | null
          es_general?: boolean | null
          id?: string
          lista_precio_id: string
          marca_id?: string | null
          porcentaje?: number
          tipo_producto_id?: string | null
        }
        Update: {
          created_at?: string | null
          es_general?: boolean | null
          id?: string
          lista_precio_id?: string
          marca_id?: string | null
          porcentaje?: number
          tipo_producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lista_precio_porcentajes_lista_precio_id_fkey"
            columns: ["lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_precio_porcentajes_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_precio_porcentajes_tipo_producto_id_fkey"
            columns: ["tipo_producto_id"]
            isOneToOne: false
            referencedRelation: "tipos_producto"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_precios: {
        Row: {
          activo: boolean | null
          codigo: string | null
          created_at: string | null
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      marcas: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      movimientos_caja: {
        Row: {
          caja_id: string
          concepto: string
          created_at: string | null
          id: string
          monto: number
          tipo: string
          usuario_id: string
          venta_id: string | null
        }
        Insert: {
          caja_id: string
          concepto: string
          created_at?: string | null
          id?: string
          monto: number
          tipo: string
          usuario_id: string
          venta_id?: string | null
        }
        Update: {
          caja_id?: string
          concepto?: string
          created_at?: string | null
          id?: string
          monto?: number
          tipo?: string
          usuario_id?: string
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          created_at: string | null
          id: string
          motivo: string | null
          producto_id: string
          stock_anterior: number
          stock_nuevo: number
          tipo: string
          usuario_id: string
          venta_id: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          id?: string
          motivo?: string | null
          producto_id: string
          stock_anterior: number
          stock_nuevo: number
          tipo: string
          usuario_id: string
          venta_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          id?: string
          motivo?: string | null
          producto_id?: string
          stock_anterior?: number
          stock_nuevo?: number
          tipo?: string
          usuario_id?: string
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean | null
          cantidad_por_empaque: number | null
          categoria_id: string | null
          codigo_articulo: string
          codigo_barra: string | null
          created_at: string | null
          desactivado_por: string | null
          descripcion: string
          fecha_desactivacion: string | null
          id: string
          marca_id: string | null
          precio_costo: number
          stock_actual: number | null
          stock_minimo: number | null
          subcategoria_id: string | null
          tipo_producto_id: string | null
          unidad_medida: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          cantidad_por_empaque?: number | null
          categoria_id?: string | null
          codigo_articulo: string
          codigo_barra?: string | null
          created_at?: string | null
          desactivado_por?: string | null
          descripcion: string
          fecha_desactivacion?: string | null
          id?: string
          marca_id?: string | null
          precio_costo?: number
          stock_actual?: number | null
          stock_minimo?: number | null
          subcategoria_id?: string | null
          tipo_producto_id?: string | null
          unidad_medida?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          cantidad_por_empaque?: number | null
          categoria_id?: string | null
          codigo_articulo?: string
          codigo_barra?: string | null
          created_at?: string | null
          desactivado_por?: string | null
          descripcion?: string
          fecha_desactivacion?: string | null
          id?: string
          marca_id?: string | null
          precio_costo?: number
          stock_actual?: number | null
          stock_minimo?: number | null
          subcategoria_id?: string | null
          tipo_producto_id?: string | null
          unidad_medida?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_tipo_producto_id_fkey"
            columns: ["tipo_producto_id"]
            isOneToOne: false
            referencedRelation: "tipos_producto"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          estado: boolean | null
          id: string
          nombre: string
          sucursal: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          estado?: boolean | null
          id: string
          nombre: string
          sucursal?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          estado?: boolean | null
          id?: string
          nombre?: string
          sucursal?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          modulo: string
          permiso: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          modulo: string
          permiso: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          modulo?: string
          permiso?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      solicitudes_descuento: {
        Row: {
          aprobado_por: string | null
          caja_id: string | null
          created_at: string
          estado: Database["public"]["Enums"]["solicitud_descuento_estado"]
          expira_en: string
          id: string
          monto_venta: number
          porcentaje_solicitado: number
          producto_id: string | null
          token: string
          token_usado: boolean
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          aprobado_por?: string | null
          caja_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["solicitud_descuento_estado"]
          expira_en: string
          id?: string
          monto_venta?: number
          porcentaje_solicitado: number
          producto_id?: string | null
          token: string
          token_usado?: boolean
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          aprobado_por?: string | null
          caja_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["solicitud_descuento_estado"]
          expira_en?: string
          id?: string
          monto_venta?: number
          porcentaje_solicitado?: number
          producto_id?: string | null
          token?: string
          token_usado?: boolean
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_descuento_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_descuento_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategorias: {
        Row: {
          activo: boolean | null
          categoria_id: string
          codigo_grupo: string
          created_at: string | null
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          categoria_id: string
          codigo_grupo: string
          created_at?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          categoria_id?: string
          codigo_grupo?: string
          created_at?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursales: {
        Row: {
          activo: boolean | null
          created_at: string | null
          direccion: string | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      tarjeta_cuotas: {
        Row: {
          activo: boolean | null
          coeficiente: number
          created_at: string | null
          cuotas: number
          id: string
          tarjeta_id: string
        }
        Insert: {
          activo?: boolean | null
          coeficiente?: number
          created_at?: string | null
          cuotas: number
          id?: string
          tarjeta_id: string
        }
        Update: {
          activo?: boolean | null
          coeficiente?: number
          created_at?: string | null
          cuotas?: number
          id?: string
          tarjeta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarjeta_cuotas_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "tarjetas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarjetas: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
          tipo: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
          tipo: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
          tipo?: string
        }
        Relationships: []
      }
      tipos_producto: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venta_detalles: {
        Row: {
          cantidad: number
          created_at: string | null
          descuento: number | null
          descuento_porcentaje: number | null
          id: string
          precio_unitario: number
          producto_id: string | null
          producto_temporal_nombre: string | null
          producto_temporal_precio: number | null
          subtotal: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          descuento?: number | null
          descuento_porcentaje?: number | null
          id?: string
          precio_unitario: number
          producto_id?: string | null
          producto_temporal_nombre?: string | null
          producto_temporal_precio?: number | null
          subtotal: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          descuento?: number | null
          descuento_porcentaje?: number | null
          id?: string
          precio_unitario?: number
          producto_id?: string | null
          producto_temporal_nombre?: string | null
          producto_temporal_precio?: number | null
          subtotal?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_detalles_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_pagos: {
        Row: {
          coeficiente: number | null
          created_at: string | null
          cuotas: number | null
          efectivo_entregado: number | null
          forma_pago_id: string
          id: string
          monto: number
          tarjeta_id: string | null
          venta_id: string
          vuelto: number | null
        }
        Insert: {
          coeficiente?: number | null
          created_at?: string | null
          cuotas?: number | null
          efectivo_entregado?: number | null
          forma_pago_id: string
          id?: string
          monto: number
          tarjeta_id?: string | null
          venta_id: string
          vuelto?: number | null
        }
        Update: {
          coeficiente?: number | null
          created_at?: string | null
          cuotas?: number | null
          efectivo_entregado?: number | null
          forma_pago_id?: string
          id?: string
          monto?: number
          tarjeta_id?: string | null
          venta_id?: string
          vuelto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venta_pagos_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_pagos_tarjeta_id_fkey"
            columns: ["tarjeta_id"]
            isOneToOne: false
            referencedRelation: "tarjetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          anulada: boolean | null
          anulada_por: string | null
          caja_id: string | null
          cliente_id: string | null
          created_at: string | null
          descuento: number | null
          empleado_id: string | null
          estado: string
          fecha: string | null
          fecha_anulacion: string | null
          id: string
          motivo_anulacion: string | null
          numero_comprobante: number
          subtotal: number
          total: number
          usuario_id: string
        }
        Insert: {
          anulada?: boolean | null
          anulada_por?: string | null
          caja_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          descuento?: number | null
          empleado_id?: string | null
          estado?: string
          fecha?: string | null
          fecha_anulacion?: string | null
          id?: string
          motivo_anulacion?: string | null
          numero_comprobante?: number
          subtotal?: number
          total?: number
          usuario_id: string
        }
        Update: {
          anulada?: boolean | null
          anulada_por?: string | null
          caja_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          descuento?: number | null
          empleado_id?: string | null
          estado?: string
          fecha?: string | null
          fecha_anulacion?: string | null
          id?: string
          motivo_anulacion?: string | null
          numero_comprobante?: number
          subtotal?: number
          total?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      empleado_saldos: {
        Row: {
          empleado_id: string | null
          saldo_actual: number | null
          total_comisiones: number | null
          total_deuda: number | null
          total_pagado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empleado_movimientos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_expire_solicitudes: { Args: never; Returns: number }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_permission: {
        Args: {
          _modulo: string
          _permiso: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_permission:
        | "ver"
        | "crear"
        | "editar"
        | "eliminar"
        | "anular"
        | "exportar"
      app_role: "admin" | "encargado" | "cajero" | "vendedor" | "deposito"
      cash_register_status: "abierta" | "cerrada"
      solicitud_descuento_estado:
        | "pendiente"
        | "aprobada"
        | "rechazada"
        | "expirada"
        | "usada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_permission: [
        "ver",
        "crear",
        "editar",
        "eliminar",
        "anular",
        "exportar",
      ],
      app_role: ["admin", "encargado", "cajero", "vendedor", "deposito"],
      cash_register_status: ["abierta", "cerrada"],
      solicitud_descuento_estado: [
        "pendiente",
        "aprobada",
        "rechazada",
        "expirada",
        "usada",
      ],
    },
  },
} as const
