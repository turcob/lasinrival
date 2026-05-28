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
          arqueo_confirmado: boolean | null
          arqueo_pendiente_revision: boolean | null
          confirmado_por: string | null
          conteo_declarado: number | null
          created_at: string | null
          diferencia: number | null
          estado: Database["public"]["Enums"]["cash_register_status"] | null
          fecha_apertura: string | null
          fecha_cierre: string | null
          fecha_confirmacion: string | null
          fondo_inicial: number
          id: string
          observaciones: string | null
          total_egresos: number | null
          total_ventas: number | null
          usuario_id: string
        }
        Insert: {
          arqueo_confirmado?: boolean | null
          arqueo_pendiente_revision?: boolean | null
          confirmado_por?: string | null
          conteo_declarado?: number | null
          created_at?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["cash_register_status"] | null
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          fecha_confirmacion?: string | null
          fondo_inicial?: number
          id?: string
          observaciones?: string | null
          total_egresos?: number | null
          total_ventas?: number | null
          usuario_id: string
        }
        Update: {
          arqueo_confirmado?: boolean | null
          arqueo_pendiente_revision?: boolean | null
          confirmado_por?: string | null
          conteo_declarado?: number | null
          created_at?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["cash_register_status"] | null
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          fecha_confirmacion?: string | null
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
      cheque_detalles: {
        Row: {
          banco: string
          cliente_movimiento_id: string
          created_at: string | null
          cuit_emisor: string | null
          emisor: string
          fecha_emision: string
          fecha_vencimiento: string
          id: string
          numero_cheque: string
          observaciones: string | null
        }
        Insert: {
          banco: string
          cliente_movimiento_id: string
          created_at?: string | null
          cuit_emisor?: string | null
          emisor: string
          fecha_emision: string
          fecha_vencimiento: string
          id?: string
          numero_cheque: string
          observaciones?: string | null
        }
        Update: {
          banco?: string
          cliente_movimiento_id?: string
          created_at?: string | null
          cuit_emisor?: string | null
          emisor?: string
          fecha_emision?: string
          fecha_vencimiento?: string
          id?: string
          numero_cheque?: string
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cheque_detalles_cliente_movimiento_id_fkey"
            columns: ["cliente_movimiento_id"]
            isOneToOne: false
            referencedRelation: "cliente_movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      cheque_historial: {
        Row: {
          cheque_id: string
          created_at: string
          estado_anterior: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["cheque_estado"]
          id: string
          observaciones: string | null
          usuario_id: string
        }
        Insert: {
          cheque_id: string
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["cheque_estado"]
          id?: string
          observaciones?: string | null
          usuario_id: string
        }
        Update: {
          cheque_id?: string
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo?: Database["public"]["Enums"]["cheque_estado"]
          id?: string
          observaciones?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheque_historial_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          banco: string
          banco_deposito: string | null
          beneficiario: string | null
          cliente_id: string | null
          cliente_movimiento_id: string | null
          created_at: string
          cuenta_deposito: string | null
          cuit_emisor: string | null
          emisor: string
          endosado_a: string | null
          estado: Database["public"]["Enums"]["cheque_estado"]
          fecha_cobro: string | null
          fecha_deposito: string | null
          fecha_emision: string
          fecha_endoso: string | null
          fecha_rechazo: string | null
          fecha_vencimiento: string
          id: string
          monto: number
          motivo_rechazo: string | null
          numero_cheque: string
          observaciones: string | null
          sucursal_banco: string | null
          tipo: Database["public"]["Enums"]["cheque_tipo"]
          updated_at: string
          usuario_registro_id: string
        }
        Insert: {
          banco: string
          banco_deposito?: string | null
          beneficiario?: string | null
          cliente_id?: string | null
          cliente_movimiento_id?: string | null
          created_at?: string
          cuenta_deposito?: string | null
          cuit_emisor?: string | null
          emisor: string
          endosado_a?: string | null
          estado?: Database["public"]["Enums"]["cheque_estado"]
          fecha_cobro?: string | null
          fecha_deposito?: string | null
          fecha_emision: string
          fecha_endoso?: string | null
          fecha_rechazo?: string | null
          fecha_vencimiento: string
          id?: string
          monto?: number
          motivo_rechazo?: string | null
          numero_cheque: string
          observaciones?: string | null
          sucursal_banco?: string | null
          tipo?: Database["public"]["Enums"]["cheque_tipo"]
          updated_at?: string
          usuario_registro_id: string
        }
        Update: {
          banco?: string
          banco_deposito?: string | null
          beneficiario?: string | null
          cliente_id?: string | null
          cliente_movimiento_id?: string | null
          created_at?: string
          cuenta_deposito?: string | null
          cuit_emisor?: string | null
          emisor?: string
          endosado_a?: string | null
          estado?: Database["public"]["Enums"]["cheque_estado"]
          fecha_cobro?: string | null
          fecha_deposito?: string | null
          fecha_emision?: string
          fecha_endoso?: string | null
          fecha_rechazo?: string | null
          fecha_vencimiento?: string
          id?: string
          monto?: number
          motivo_rechazo?: string | null
          numero_cheque?: string
          observaciones?: string | null
          sucursal_banco?: string | null
          tipo?: Database["public"]["Enums"]["cheque_tipo"]
          updated_at?: string
          usuario_registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheques_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_cliente_movimiento_id_fkey"
            columns: ["cliente_movimiento_id"]
            isOneToOne: false
            referencedRelation: "cliente_movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_movimiento_imputaciones: {
        Row: {
          created_at: string | null
          id: string
          monto: number
          movimiento_factura_id: string
          movimiento_pago_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          monto: number
          movimiento_factura_id: string
          movimiento_pago_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          monto?: number
          movimiento_factura_id?: string
          movimiento_pago_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_movimiento_imputaciones_movimiento_factura_id_fkey"
            columns: ["movimiento_factura_id"]
            isOneToOne: false
            referencedRelation: "cliente_movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_movimiento_imputaciones_movimiento_pago_id_fkey"
            columns: ["movimiento_pago_id"]
            isOneToOne: false
            referencedRelation: "cliente_movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_movimientos: {
        Row: {
          cliente_id: string
          codigo_deposito: string | null
          concepto: string | null
          created_at: string | null
          estado_imputacion: string | null
          fecha: string | null
          fecha_imputacion: string | null
          forma_pago_id: string | null
          id: string
          imputado_por: string | null
          monto: number
          motivo_rechazo: string | null
          nombre_vendedor: string | null
          numero_comprobante: string | null
          numero_operacion: string | null
          origen: string | null
          tipo: string
          usuario_registro_id: string
          venta_id: string | null
        }
        Insert: {
          cliente_id: string
          codigo_deposito?: string | null
          concepto?: string | null
          created_at?: string | null
          estado_imputacion?: string | null
          fecha?: string | null
          fecha_imputacion?: string | null
          forma_pago_id?: string | null
          id?: string
          imputado_por?: string | null
          monto: number
          motivo_rechazo?: string | null
          nombre_vendedor?: string | null
          numero_comprobante?: string | null
          numero_operacion?: string | null
          origen?: string | null
          tipo: string
          usuario_registro_id: string
          venta_id?: string | null
        }
        Update: {
          cliente_id?: string
          codigo_deposito?: string | null
          concepto?: string | null
          created_at?: string | null
          estado_imputacion?: string | null
          fecha?: string | null
          fecha_imputacion?: string | null
          forma_pago_id?: string | null
          id?: string
          imputado_por?: string | null
          monto?: number
          motivo_rechazo?: string | null
          nombre_vendedor?: string | null
          numero_comprobante?: string | null
          numero_operacion?: string | null
          origen?: string | null
          tipo?: string
          usuario_registro_id?: string
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_movimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_movimientos_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_movimientos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_movimientos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean | null
          bloqueado: boolean
          codigo_cliente: string | null
          codigo_postal: string | null
          condicion_iva: number | null
          condicion_venta_id: string | null
          created_at: string | null
          dias_gracia_vencimiento: number | null
          direccion: string | null
          dni_cuit: string | null
          email: string | null
          facturas_adeudadas_bloqueo_override: number | null
          fecha_alta: string | null
          id: string
          limite_credito: number | null
          lista_precio_id: string | null
          localidad: string | null
          monto_adeudado_bloqueo_override: number | null
          motivo_bloqueo: string | null
          nombre: string
          numero_terminal_clover: string | null
          provincia_id: string | null
          telefono: string | null
          telefono_contacto: string | null
          updated_at: string | null
          vendedor_id: string | null
          zona_id: string | null
        }
        Insert: {
          activo?: boolean | null
          bloqueado?: boolean
          codigo_cliente?: string | null
          codigo_postal?: string | null
          condicion_iva?: number | null
          condicion_venta_id?: string | null
          created_at?: string | null
          dias_gracia_vencimiento?: number | null
          direccion?: string | null
          dni_cuit?: string | null
          email?: string | null
          facturas_adeudadas_bloqueo_override?: number | null
          fecha_alta?: string | null
          id?: string
          limite_credito?: number | null
          lista_precio_id?: string | null
          localidad?: string | null
          monto_adeudado_bloqueo_override?: number | null
          motivo_bloqueo?: string | null
          nombre: string
          numero_terminal_clover?: string | null
          provincia_id?: string | null
          telefono?: string | null
          telefono_contacto?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          zona_id?: string | null
        }
        Update: {
          activo?: boolean | null
          bloqueado?: boolean
          codigo_cliente?: string | null
          codigo_postal?: string | null
          condicion_iva?: number | null
          condicion_venta_id?: string | null
          created_at?: string | null
          dias_gracia_vencimiento?: number | null
          direccion?: string | null
          dni_cuit?: string | null
          email?: string | null
          facturas_adeudadas_bloqueo_override?: number | null
          fecha_alta?: string | null
          id?: string
          limite_credito?: number | null
          lista_precio_id?: string | null
          localidad?: string | null
          monto_adeudado_bloqueo_override?: number | null
          motivo_bloqueo?: string | null
          nombre?: string
          numero_terminal_clover?: string | null
          provincia_id?: string | null
          telefono?: string | null
          telefono_contacto?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_condicion_venta_id_fkey"
            columns: ["condicion_venta_id"]
            isOneToOne: false
            referencedRelation: "condiciones_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_lista_precio_id_fkey"
            columns: ["lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_provincia_id_fkey"
            columns: ["provincia_id"]
            isOneToOne: false
            referencedRelation: "provincias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      clover_pagos: {
        Row: {
          asociado: boolean | null
          cliente_id: string | null
          codigo_autorizacion: string | null
          created_at: string
          dispositivo: string | null
          factura_numero: string | null
          fecha_pago: string
          id: string
          importe: number
          importe_devolucion: number | null
          importe_impuestos: number | null
          importe_propinas: number | null
          marca_tarjeta: string | null
          medio_pago: string | null
          moneda: string | null
          movimiento_id: string | null
          nombre_cliente_clover: string | null
          numero_cuotas: number | null
          numero_lote: string | null
          numero_recibo: string | null
          numero_tarjeta: string | null
          numero_transaccion: string | null
          pago_id_clover: string
          resultado: string | null
          terminal_id: string | null
          usuario_importacion_id: string
        }
        Insert: {
          asociado?: boolean | null
          cliente_id?: string | null
          codigo_autorizacion?: string | null
          created_at?: string
          dispositivo?: string | null
          factura_numero?: string | null
          fecha_pago: string
          id?: string
          importe?: number
          importe_devolucion?: number | null
          importe_impuestos?: number | null
          importe_propinas?: number | null
          marca_tarjeta?: string | null
          medio_pago?: string | null
          moneda?: string | null
          movimiento_id?: string | null
          nombre_cliente_clover?: string | null
          numero_cuotas?: number | null
          numero_lote?: string | null
          numero_recibo?: string | null
          numero_tarjeta?: string | null
          numero_transaccion?: string | null
          pago_id_clover: string
          resultado?: string | null
          terminal_id?: string | null
          usuario_importacion_id: string
        }
        Update: {
          asociado?: boolean | null
          cliente_id?: string | null
          codigo_autorizacion?: string | null
          created_at?: string
          dispositivo?: string | null
          factura_numero?: string | null
          fecha_pago?: string
          id?: string
          importe?: number
          importe_devolucion?: number | null
          importe_impuestos?: number | null
          importe_propinas?: number | null
          marca_tarjeta?: string | null
          medio_pago?: string | null
          moneda?: string | null
          movimiento_id?: string | null
          nombre_cliente_clover?: string | null
          numero_cuotas?: number | null
          numero_lote?: string | null
          numero_recibo?: string | null
          numero_tarjeta?: string | null
          numero_transaccion?: string | null
          pago_id_clover?: string
          resultado?: string | null
          terminal_id?: string | null
          usuario_importacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clover_pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clover_pagos_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "cliente_movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros: {
        Row: {
          banco: string | null
          created_at: string | null
          fecha_cheque: string | null
          hoja_ruta_parada_id: string
          id: string
          medio_pago: string
          monto: number
          numero_cheque: string | null
          observaciones: string | null
          referencia: string | null
        }
        Insert: {
          banco?: string | null
          created_at?: string | null
          fecha_cheque?: string | null
          hoja_ruta_parada_id: string
          id?: string
          medio_pago: string
          monto: number
          numero_cheque?: string | null
          observaciones?: string | null
          referencia?: string | null
        }
        Update: {
          banco?: string | null
          created_at?: string | null
          fecha_cheque?: string | null
          hoja_ruta_parada_id?: string
          id?: string
          medio_pago?: string
          monto?: number
          numero_cheque?: string | null
          observaciones?: string | null
          referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobros_hoja_ruta_parada_id_fkey"
            columns: ["hoja_ruta_parada_id"]
            isOneToOne: false
            referencedRelation: "hoja_ruta_paradas"
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
          {
            foreignKeyName: "comprobantes_afip_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
          },
        ]
      }
      condiciones_venta: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string | null
          descripcion: string
          id: string
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          descripcion: string
          id?: string
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          descripcion?: string
          id?: string
        }
        Relationships: []
      }
      configuracion_comercio: {
        Row: {
          afip_modo: string
          bloqueo_automatico_activo: boolean
          codigo_postal: string | null
          condicion_iva: string
          created_at: string
          cuit: string
          direccion: string
          email: string | null
          facturas_adeudadas_bloqueo: number
          id: string
          inicio_actividades: string | null
          localidad: string | null
          monto_adeudado_bloqueo: number
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
          bloqueo_automatico_activo?: boolean
          codigo_postal?: string | null
          condicion_iva?: string
          created_at?: string
          cuit: string
          direccion: string
          email?: string | null
          facturas_adeudadas_bloqueo?: number
          id?: string
          inicio_actividades?: string | null
          localidad?: string | null
          monto_adeudado_bloqueo?: number
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
          bloqueo_automatico_activo?: boolean
          codigo_postal?: string | null
          condicion_iva?: string
          created_at?: string
          cuit?: string
          direccion?: string
          email?: string | null
          facturas_adeudadas_bloqueo?: number
          id?: string
          inicio_actividades?: string | null
          localidad?: string | null
          monto_adeudado_bloqueo?: number
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
          rol_codigo: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descuento_maximo_global?: number
          id?: string
          rol_codigo?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descuento_maximo_global?: number
          id?: string
          rol_codigo?: string | null
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
          {
            foreignKeyName: "descuentos_producto_rol_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "descuentos_producto_rol_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "descuentos_producto_rol_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      devoluciones: {
        Row: {
          cantidad: number
          created_at: string | null
          detalle_motivo: string | null
          hoja_ruta_parada_id: string
          id: string
          motivo: string
          producto_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          detalle_motivo?: string | null
          hoja_ruta_parada_id: string
          id?: string
          motivo: string
          producto_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          detalle_motivo?: string | null
          hoja_ruta_parada_id?: string
          id?: string
          motivo?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_hoja_ruta_parada_id_fkey"
            columns: ["hoja_ruta_parada_id"]
            isOneToOne: false
            referencedRelation: "hoja_ruta_paradas"
            referencedColumns: ["id"]
          },
        ]
      }
      devoluciones_manuales: {
        Row: {
          cantidad: number
          cliente_id: string
          created_at: string
          detalle_motivo: string | null
          fecha: string
          generar_nc: boolean | null
          id: string
          importe_total: number
          motivo: string
          nc_pendiente_id: string | null
          observaciones: string | null
          precio_unitario: number
          producto_id: string
          reingresar_stock: boolean | null
          usuario_id: string
        }
        Insert: {
          cantidad: number
          cliente_id: string
          created_at?: string
          detalle_motivo?: string | null
          fecha?: string
          generar_nc?: boolean | null
          id?: string
          importe_total?: number
          motivo: string
          nc_pendiente_id?: string | null
          observaciones?: string | null
          precio_unitario?: number
          producto_id: string
          reingresar_stock?: boolean | null
          usuario_id: string
        }
        Update: {
          cantidad?: number
          cliente_id?: string
          created_at?: string
          detalle_motivo?: string | null
          fecha?: string
          generar_nc?: boolean | null
          id?: string
          importe_total?: number
          motivo?: string
          nc_pendiente_id?: string | null
          observaciones?: string | null
          precio_unitario?: number
          producto_id?: string
          reingresar_stock?: boolean | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_manuales_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_manuales_nc_pendiente_id_fkey"
            columns: ["nc_pendiente_id"]
            isOneToOne: false
            referencedRelation: "notas_credito_pendientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_manuales_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_manuales_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "devoluciones_manuales_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "devoluciones_manuales_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
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
          {
            foreignKeyName: "empleado_movimientos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
      hoja_ruta_carga_items: {
        Row: {
          cantidad_cargada: number | null
          cantidad_esperada: number
          created_at: string
          estado: string
          hoja_ruta_id: string
          id: string
          observaciones: string | null
          pedido_id: string
          producto_id: string
          updated_at: string
          verificado_at: string | null
          verificado_por: string | null
        }
        Insert: {
          cantidad_cargada?: number | null
          cantidad_esperada?: number
          created_at?: string
          estado?: string
          hoja_ruta_id: string
          id?: string
          observaciones?: string | null
          pedido_id: string
          producto_id: string
          updated_at?: string
          verificado_at?: string | null
          verificado_por?: string | null
        }
        Update: {
          cantidad_cargada?: number | null
          cantidad_esperada?: number
          created_at?: string
          estado?: string
          hoja_ruta_id?: string
          id?: string
          observaciones?: string | null
          pedido_id?: string
          producto_id?: string
          updated_at?: string
          verificado_at?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_ruta_carga_items_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_ruta_cobros: {
        Row: {
          created_at: string
          forma_pago_id: string
          foto_comprobante_nombre: string | null
          foto_comprobante_path: string | null
          hoja_ruta_id: string
          id: string
          monto: number
          observaciones: string | null
          parada_id: string
          pedido_id: string
          referencia: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string
          forma_pago_id: string
          foto_comprobante_nombre?: string | null
          foto_comprobante_path?: string | null
          hoja_ruta_id: string
          id?: string
          monto?: number
          observaciones?: string | null
          parada_id: string
          pedido_id: string
          referencia?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string
          forma_pago_id?: string
          foto_comprobante_nombre?: string | null
          foto_comprobante_path?: string | null
          hoja_ruta_id?: string
          id?: string
          monto?: number
          observaciones?: string | null
          parada_id?: string
          pedido_id?: string
          referencia?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoja_ruta_cobros_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_cobros_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_cobros_parada_id_fkey"
            columns: ["parada_id"]
            isOneToOne: false
            referencedRelation: "hoja_ruta_paradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_cobros_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_ruta_devoluciones: {
        Row: {
          cantidad: number
          created_at: string
          detalle_motivo: string | null
          hoja_ruta_id: string
          id: string
          motivo: string
          parada_id: string
          pedido_detalle_id: string
          reingresado_stock: boolean | null
          usuario_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          detalle_motivo?: string | null
          hoja_ruta_id: string
          id?: string
          motivo: string
          parada_id: string
          pedido_detalle_id: string
          reingresado_stock?: boolean | null
          usuario_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          detalle_motivo?: string | null
          hoja_ruta_id?: string
          id?: string
          motivo?: string
          parada_id?: string
          pedido_detalle_id?: string
          reingresado_stock?: boolean | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoja_ruta_devoluciones_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_devoluciones_parada_id_fkey"
            columns: ["parada_id"]
            isOneToOne: false
            referencedRelation: "hoja_ruta_paradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_devoluciones_pedido_detalle_id_fkey"
            columns: ["pedido_detalle_id"]
            isOneToOne: false
            referencedRelation: "pedido_detalles"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_ruta_devoluciones_vendedor: {
        Row: {
          created_at: string
          descripcion: string
          hoja_ruta_id: string
          id: string
          monto: number
          parada_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          hoja_ruta_id: string
          id?: string
          monto: number
          parada_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          hoja_ruta_id?: string
          id?: string
          monto?: number
          parada_id?: string
          usuario_id?: string
        }
        Relationships: []
      }
      hoja_ruta_paradas: {
        Row: {
          created_at: string
          estado: string
          hoja_ruta_id: string
          hora_llegada: string | null
          hora_salida: string | null
          id: string
          observaciones: string | null
          orden: number
          pedido_id: string
          updated_at: string
          ventana_horaria_desde: string | null
          ventana_horaria_hasta: string | null
        }
        Insert: {
          created_at?: string
          estado?: string
          hoja_ruta_id: string
          hora_llegada?: string | null
          hora_salida?: string | null
          id?: string
          observaciones?: string | null
          orden?: number
          pedido_id: string
          updated_at?: string
          ventana_horaria_desde?: string | null
          ventana_horaria_hasta?: string | null
        }
        Update: {
          created_at?: string
          estado?: string
          hoja_ruta_id?: string
          hora_llegada?: string | null
          hora_salida?: string | null
          id?: string
          observaciones?: string | null
          orden?: number
          pedido_id?: string
          updated_at?: string
          ventana_horaria_desde?: string | null
          ventana_horaria_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_ruta_paradas_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_paradas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_ruta_refacturaciones: {
        Row: {
          cantidad_anterior: number
          cantidad_descontada: number
          cantidad_nueva: number
          created_at: string
          hoja_ruta_id: string
          id: string
          pedidos_afectados: Json
          producto_id: string
          usuario_id: string
        }
        Insert: {
          cantidad_anterior: number
          cantidad_descontada: number
          cantidad_nueva: number
          created_at?: string
          hoja_ruta_id: string
          id?: string
          pedidos_afectados?: Json
          producto_id: string
          usuario_id: string
        }
        Update: {
          cantidad_anterior?: number
          cantidad_descontada?: number
          cantidad_nueva?: number
          created_at?: string
          hoja_ruta_id?: string
          id?: string
          pedidos_afectados?: Json
          producto_id?: string
          usuario_id?: string
        }
        Relationships: []
      }
      hoja_ruta_rendiciones: {
        Row: {
          aprobado_por: string | null
          caja_id: string | null
          created_at: string
          diferencia: number | null
          estado: string
          fecha_aprobacion: string | null
          fecha_rendicion: string
          hoja_ruta_id: string
          id: string
          observaciones: string | null
          total_efectivo: number
          total_general: number
          total_qr: number
          total_tarjeta: number
          total_transferencias: number
          updated_at: string
          usuario_id: string
        }
        Insert: {
          aprobado_por?: string | null
          caja_id?: string | null
          created_at?: string
          diferencia?: number | null
          estado?: string
          fecha_aprobacion?: string | null
          fecha_rendicion?: string
          hoja_ruta_id: string
          id?: string
          observaciones?: string | null
          total_efectivo?: number
          total_general?: number
          total_qr?: number
          total_tarjeta?: number
          total_transferencias?: number
          updated_at?: string
          usuario_id: string
        }
        Update: {
          aprobado_por?: string | null
          caja_id?: string | null
          created_at?: string
          diferencia?: number | null
          estado?: string
          fecha_aprobacion?: string | null
          fecha_rendicion?: string
          hoja_ruta_id?: string
          id?: string
          observaciones?: string | null
          total_efectivo?: number
          total_general?: number
          total_qr?: number
          total_tarjeta?: number
          total_transferencias?: number
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoja_ruta_rendiciones_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_rendiciones_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_ruta_ventas_rechazados: {
        Row: {
          cantidad: number
          cliente_id: string
          cobro_id: string | null
          created_at: string
          forma_pago_id: string
          hoja_ruta_id: string
          id: string
          monto_total: number
          observaciones: string | null
          parada_id: string
          precio_unitario: number
          producto_id: string
          usuario_id: string
        }
        Insert: {
          cantidad: number
          cliente_id: string
          cobro_id?: string | null
          created_at?: string
          forma_pago_id: string
          hoja_ruta_id: string
          id?: string
          monto_total?: number
          observaciones?: string | null
          parada_id: string
          precio_unitario?: number
          producto_id: string
          usuario_id: string
        }
        Update: {
          cantidad?: number
          cliente_id?: string
          cobro_id?: string | null
          created_at?: string
          forma_pago_id?: string
          hoja_ruta_id?: string
          id?: string
          monto_total?: number
          observaciones?: string | null
          parada_id?: string
          precio_unitario?: number
          producto_id?: string
          usuario_id?: string
        }
        Relationships: []
      }
      hojas_ruta: {
        Row: {
          carga_confirmada_at: string | null
          carga_confirmada_por: string | null
          carga_forzada: boolean
          chofer_id: string | null
          created_at: string
          estado: string
          fecha: string
          hora_regreso: string | null
          hora_salida_estimada: string | null
          hora_salida_real: string | null
          id: string
          km_final: number | null
          km_inicial: number | null
          monto_esperado: number | null
          numero_hoja: number
          observaciones: string | null
          responsable_id: string | null
          updated_at: string
          usuario_id: string
          vehiculo_id: string | null
        }
        Insert: {
          carga_confirmada_at?: string | null
          carga_confirmada_por?: string | null
          carga_forzada?: boolean
          chofer_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          hora_regreso?: string | null
          hora_salida_estimada?: string | null
          hora_salida_real?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          monto_esperado?: number | null
          numero_hoja?: number
          observaciones?: string | null
          responsable_id?: string | null
          updated_at?: string
          usuario_id: string
          vehiculo_id?: string | null
        }
        Update: {
          carga_confirmada_at?: string | null
          carga_confirmada_por?: string | null
          carga_forzada?: boolean
          chofer_id?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          hora_regreso?: string | null
          hora_salida_estimada?: string | null
          hora_salida_real?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          monto_esperado?: number | null
          numero_hoja?: number
          observaciones?: string | null
          responsable_id?: string | null
          updated_at?: string
          usuario_id?: string
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hojas_ruta_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_precio_excepciones: {
        Row: {
          created_at: string | null
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          lista_precio_id: string | null
          porcentaje: number
          producto_id: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          lista_precio_id?: string | null
          porcentaje?: number
          producto_id: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
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
          {
            foreignKeyName: "lista_precio_excepciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "lista_precio_excepciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "lista_precio_excepciones_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
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
          destino: string
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          destino?: string
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          destino?: string
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
          {
            foreignKeyName: "movimientos_caja_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
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
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_inventario_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
          },
        ]
      }
      notas_credito_pendientes: {
        Row: {
          cantidad: number
          cliente_id: string
          cliente_movimiento_id: string | null
          created_at: string
          detalle_motivo: string | null
          estado: string
          fecha_aprobacion: string | null
          generar_nc: boolean | null
          hoja_ruta_id: string | null
          id: string
          importe_total: number
          motivo: string
          observaciones_admin: string | null
          origen: string
          parada_id: string | null
          pedido_detalle_id: string | null
          pedido_id: string | null
          precio_unitario: number
          producto_id: string | null
          reingresar_stock: boolean | null
          updated_at: string
          usuario_aprobador_id: string | null
          usuario_creador_id: string
        }
        Insert: {
          cantidad: number
          cliente_id: string
          cliente_movimiento_id?: string | null
          created_at?: string
          detalle_motivo?: string | null
          estado?: string
          fecha_aprobacion?: string | null
          generar_nc?: boolean | null
          hoja_ruta_id?: string | null
          id?: string
          importe_total?: number
          motivo: string
          observaciones_admin?: string | null
          origen: string
          parada_id?: string | null
          pedido_detalle_id?: string | null
          pedido_id?: string | null
          precio_unitario?: number
          producto_id?: string | null
          reingresar_stock?: boolean | null
          updated_at?: string
          usuario_aprobador_id?: string | null
          usuario_creador_id: string
        }
        Update: {
          cantidad?: number
          cliente_id?: string
          cliente_movimiento_id?: string | null
          created_at?: string
          detalle_motivo?: string | null
          estado?: string
          fecha_aprobacion?: string | null
          generar_nc?: boolean | null
          hoja_ruta_id?: string | null
          id?: string
          importe_total?: number
          motivo?: string
          observaciones_admin?: string | null
          origen?: string
          parada_id?: string | null
          pedido_detalle_id?: string | null
          pedido_id?: string | null
          precio_unitario?: number
          producto_id?: string | null
          reingresar_stock?: boolean | null
          updated_at?: string
          usuario_aprobador_id?: string | null
          usuario_creador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_credito_pendientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_pendientes_cliente_movimiento_id_fkey"
            columns: ["cliente_movimiento_id"]
            isOneToOne: false
            referencedRelation: "cliente_movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_pendientes_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_pendientes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_pendientes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_pendientes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "notas_credito_pendientes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "notas_credito_pendientes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      objetivos_vendedor: {
        Row: {
          cobertura_actual: number | null
          created_at: string
          id: string
          meta_cobertura_porcentaje: number | null
          meta_ticket_promedio: number | null
          meta_ventas: number | null
          meta_visitas: number | null
          periodo_anio: number
          periodo_mes: number
          ticket_promedio_actual: number | null
          updated_at: string
          vendedor_id: string
          ventas_realizadas: number | null
          visitas_realizadas: number | null
        }
        Insert: {
          cobertura_actual?: number | null
          created_at?: string
          id?: string
          meta_cobertura_porcentaje?: number | null
          meta_ticket_promedio?: number | null
          meta_ventas?: number | null
          meta_visitas?: number | null
          periodo_anio: number
          periodo_mes: number
          ticket_promedio_actual?: number | null
          updated_at?: string
          vendedor_id: string
          ventas_realizadas?: number | null
          visitas_realizadas?: number | null
        }
        Update: {
          cobertura_actual?: number | null
          created_at?: string
          id?: string
          meta_cobertura_porcentaje?: number | null
          meta_ticket_promedio?: number | null
          meta_ventas?: number | null
          meta_visitas?: number | null
          periodo_anio?: number
          periodo_mes?: number
          ticket_promedio_actual?: number | null
          updated_at?: string
          vendedor_id?: string
          ventas_realizadas?: number | null
          visitas_realizadas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_vendedor_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      objetivos_zona: {
        Row: {
          clientes_nuevos: number | null
          created_at: string
          id: string
          meta_clientes_nuevos: number | null
          meta_ventas: number | null
          meta_visitas: number | null
          periodo_anio: number
          periodo_mes: number
          updated_at: string
          ventas_realizadas: number | null
          visitas_realizadas: number | null
          zona_id: string
        }
        Insert: {
          clientes_nuevos?: number | null
          created_at?: string
          id?: string
          meta_clientes_nuevos?: number | null
          meta_ventas?: number | null
          meta_visitas?: number | null
          periodo_anio: number
          periodo_mes: number
          updated_at?: string
          ventas_realizadas?: number | null
          visitas_realizadas?: number | null
          zona_id: string
        }
        Update: {
          clientes_nuevos?: number | null
          created_at?: string
          id?: string
          meta_clientes_nuevos?: number | null
          meta_ventas?: number | null
          meta_visitas?: number | null
          periodo_anio?: number
          periodo_mes?: number
          updated_at?: string
          ventas_realizadas?: number | null
          visitas_realizadas?: number | null
          zona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_zona_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_compra_detalles: {
        Row: {
          cantidad: number
          cantidad_recibida: number | null
          created_at: string | null
          descripcion: string | null
          id: string
          orden_compra_id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad?: number
          cantidad_recibida?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          orden_compra_id: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
        }
        Update: {
          cantidad?: number
          cantidad_recibida?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          orden_compra_id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orden_compra_detalles_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_compra_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_compra_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "orden_compra_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "orden_compra_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      ordenes_compra: {
        Row: {
          created_at: string | null
          descuento: number | null
          estado: Database["public"]["Enums"]["orden_compra_estado"]
          fecha_entrega_estimada: string | null
          fecha_orden: string
          fecha_recepcion: string | null
          id: string
          numero_orden: number
          observaciones: string | null
          proveedor_id: string
          subtotal: number
          total: number
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          descuento?: number | null
          estado?: Database["public"]["Enums"]["orden_compra_estado"]
          fecha_entrega_estimada?: string | null
          fecha_orden?: string
          fecha_recepcion?: string | null
          id?: string
          numero_orden?: never
          observaciones?: string | null
          proveedor_id: string
          subtotal?: number
          total?: number
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          descuento?: number | null
          estado?: Database["public"]["Enums"]["orden_compra_estado"]
          fecha_entrega_estimada?: string | null
          fecha_orden?: string
          fecha_recepcion?: string | null
          id?: string
          numero_orden?: never
          observaciones?: string | null
          proveedor_id?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_detalles: {
        Row: {
          cantidad_devuelta: number | null
          cantidad_entregada: number | null
          cantidad_pedida: number
          created_at: string
          descuento_porcentaje: number | null
          id: string
          observaciones: string | null
          pedido_id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad_devuelta?: number | null
          cantidad_entregada?: number | null
          cantidad_pedida: number
          created_at?: string
          descuento_porcentaje?: number | null
          id?: string
          observaciones?: string | null
          pedido_id: string
          precio_unitario: number
          producto_id?: string | null
          subtotal: number
        }
        Update: {
          cantidad_devuelta?: number | null
          cantidad_entregada?: number | null
          cantidad_pedida?: number
          created_at?: string
          descuento_porcentaje?: number | null
          id?: string
          observaciones?: string | null
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_detalles_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "pedido_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "pedido_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      pedido_devoluciones: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          motivo: string | null
          pedido_detalle_id: string
          pedido_id: string
          reingresado_stock: boolean | null
          usuario_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          motivo?: string | null
          pedido_detalle_id: string
          pedido_id: string
          reingresado_stock?: boolean | null
          usuario_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          motivo?: string | null
          pedido_detalle_id?: string
          pedido_id?: string
          reingresado_stock?: boolean | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_devoluciones_pedido_detalle_id_fkey"
            columns: ["pedido_detalle_id"]
            isOneToOne: false
            referencedRelation: "pedido_detalles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_devoluciones_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_historial: {
        Row: {
          created_at: string
          estado_anterior: Database["public"]["Enums"]["pedido_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["pedido_estado"]
          id: string
          observaciones: string | null
          pedido_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["pedido_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["pedido_estado"]
          id?: string
          observaciones?: string | null
          pedido_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["pedido_estado"] | null
          estado_nuevo?: Database["public"]["Enums"]["pedido_estado"]
          id?: string
          observaciones?: string | null
          pedido_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_historial_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          cobrado_en_entrega: boolean | null
          created_at: string
          descuento: number | null
          estado: Database["public"]["Enums"]["pedido_estado"]
          fecha_entrega_estimada: string | null
          fecha_entrega_real: string | null
          fecha_pedido: string
          fecha_rendicion: string | null
          id: string
          lista_precio_id: string | null
          monto_cobrado: number | null
          numero_pedido: number
          observaciones: string | null
          rendido: boolean | null
          rendido_por: string | null
          subtotal: number
          tipo_pedido: string
          total: number
          updated_at: string
          usuario_id: string
          vendedor_id: string | null
          venta_id: string | null
        }
        Insert: {
          cliente_id: string
          cobrado_en_entrega?: boolean | null
          created_at?: string
          descuento?: number | null
          estado?: Database["public"]["Enums"]["pedido_estado"]
          fecha_entrega_estimada?: string | null
          fecha_entrega_real?: string | null
          fecha_pedido?: string
          fecha_rendicion?: string | null
          id?: string
          lista_precio_id?: string | null
          monto_cobrado?: number | null
          numero_pedido?: number
          observaciones?: string | null
          rendido?: boolean | null
          rendido_por?: string | null
          subtotal?: number
          tipo_pedido?: string
          total?: number
          updated_at?: string
          usuario_id: string
          vendedor_id?: string | null
          venta_id?: string | null
        }
        Update: {
          cliente_id?: string
          cobrado_en_entrega?: boolean | null
          created_at?: string
          descuento?: number | null
          estado?: Database["public"]["Enums"]["pedido_estado"]
          fecha_entrega_estimada?: string | null
          fecha_entrega_real?: string | null
          fecha_pedido?: string
          fecha_rendicion?: string | null
          id?: string
          lista_precio_id?: string | null
          monto_cobrado?: number | null
          numero_pedido?: number
          observaciones?: string | null
          rendido?: boolean | null
          rendido_por?: string | null
          subtotal?: number
          tipo_pedido?: string
          total?: number
          updated_at?: string
          usuario_id?: string
          vendedor_id?: string | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_lista_precio_id_fkey"
            columns: ["lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
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
          es_frio: boolean
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
          es_frio?: boolean
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
          es_frio?: boolean
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
      productos_foco: {
        Row: {
          activo: boolean | null
          created_at: string
          id: string
          meta_monto: number | null
          meta_unidades: number | null
          monto_vendido: number | null
          periodo_anio: number
          periodo_mes: number
          producto_id: string
          unidades_vendidas: number | null
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          id?: string
          meta_monto?: number | null
          meta_unidades?: number | null
          monto_vendido?: number | null
          periodo_anio: number
          periodo_mes: number
          producto_id: string
          unidades_vendidas?: number | null
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          id?: string
          meta_monto?: number | null
          meta_unidades?: number | null
          monto_vendido?: number | null
          periodo_anio?: number
          periodo_mes?: number
          producto_id?: string
          unidades_vendidas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_foco_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_foco_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "productos_foco_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "productos_foco_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      productos_foco_vendedor: {
        Row: {
          created_at: string
          id: string
          meta_unidades: number | null
          producto_foco_id: string
          unidades_vendidas: number | null
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_unidades?: number | null
          producto_foco_id: string
          unidades_vendidas?: number | null
          vendedor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_unidades?: number | null
          producto_foco_id?: string
          unidades_vendidas?: number | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_foco_vendedor_producto_foco_id_fkey"
            columns: ["producto_foco_id"]
            isOneToOne: false
            referencedRelation: "productos_foco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_foco_vendedor_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
      proveedor_movimientos: {
        Row: {
          banco_transferencia: string | null
          caja_id: string | null
          cheque_id: string | null
          cheque_propio_banco: string | null
          cheque_propio_fecha_emision: string | null
          cheque_propio_fecha_vencimiento: string | null
          cheque_propio_monto: number | null
          cheque_propio_numero: string | null
          concepto: string | null
          created_at: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          forma_pago_id: string | null
          id: string
          medio_pago: string | null
          monto: number
          numero_comprobante: string | null
          observaciones: string | null
          proveedor_id: string
          referencia_transferencia: string | null
          saldo_pendiente: number
          tipo: Database["public"]["Enums"]["proveedor_movimiento_tipo"]
          tipo_comprobante: string | null
          usuario_registro_id: string
        }
        Insert: {
          banco_transferencia?: string | null
          caja_id?: string | null
          cheque_id?: string | null
          cheque_propio_banco?: string | null
          cheque_propio_fecha_emision?: string | null
          cheque_propio_fecha_vencimiento?: string | null
          cheque_propio_monto?: number | null
          cheque_propio_numero?: string | null
          concepto?: string | null
          created_at?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          forma_pago_id?: string | null
          id?: string
          medio_pago?: string | null
          monto?: number
          numero_comprobante?: string | null
          observaciones?: string | null
          proveedor_id: string
          referencia_transferencia?: string | null
          saldo_pendiente?: number
          tipo: Database["public"]["Enums"]["proveedor_movimiento_tipo"]
          tipo_comprobante?: string | null
          usuario_registro_id: string
        }
        Update: {
          banco_transferencia?: string | null
          caja_id?: string | null
          cheque_id?: string | null
          cheque_propio_banco?: string | null
          cheque_propio_fecha_emision?: string | null
          cheque_propio_fecha_vencimiento?: string | null
          cheque_propio_monto?: number | null
          cheque_propio_numero?: string | null
          concepto?: string | null
          created_at?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          forma_pago_id?: string | null
          id?: string
          medio_pago?: string | null
          monto?: number
          numero_comprobante?: string | null
          observaciones?: string | null
          proveedor_id?: string
          referencia_transferencia?: string | null
          saldo_pendiente?: number
          tipo?: Database["public"]["Enums"]["proveedor_movimiento_tipo"]
          tipo_comprobante?: string | null
          usuario_registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_movimientos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_movimientos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_movimientos_forma_pago_id_fkey"
            columns: ["forma_pago_id"]
            isOneToOne: false
            referencedRelation: "formas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_movimientos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean | null
          codigo_proveedor: string
          condicion_iva: string | null
          contacto: string | null
          created_at: string | null
          cuit: string | null
          direccion: string | null
          email: string | null
          id: string
          observaciones: string | null
          razon_social: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo_proveedor: string
          condicion_iva?: string | null
          contacto?: string | null
          created_at?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          observaciones?: string | null
          razon_social: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo_proveedor?: string
          condicion_iva?: string | null
          contacto?: string | null
          created_at?: string | null
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          observaciones?: string | null
          razon_social?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provincias: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
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
          rol_codigo: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          modulo: string
          permiso: Database["public"]["Enums"]["app_permission"]
          rol_codigo?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          modulo?: string
          permiso?: Database["public"]["Enums"]["app_permission"]
          rol_codigo?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      roles: {
        Row: {
          activo: boolean | null
          codigo: string
          color: string | null
          created_at: string | null
          descripcion: string | null
          es_sistema: boolean | null
          id: string
          nombre: string
          orden: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          color?: string | null
          created_at?: string | null
          descripcion?: string | null
          es_sistema?: boolean | null
          id?: string
          nombre: string
          orden?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          color?: string | null
          created_at?: string | null
          descripcion?: string | null
          es_sistema?: boolean | null
          id?: string
          nombre?: string
          orden?: number | null
          updated_at?: string | null
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
          {
            foreignKeyName: "solicitudes_descuento_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "solicitudes_descuento_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "solicitudes_descuento_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
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
      sugerencias: {
        Row: {
          contenido: string
          created_at: string
          estado: string
          fecha_respuesta: string | null
          id: string
          respondido_por: string | null
          respuesta: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          estado?: string
          fecha_respuesta?: string | null
          id?: string
          respondido_por?: string | null
          respuesta?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          estado?: string
          fecha_respuesta?: string | null
          id?: string
          respondido_por?: string | null
          respuesta?: string | null
          updated_at?: string
          usuario_id?: string
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
          rol_codigo: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          rol_codigo?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          rol_codigo?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehiculos: {
        Row: {
          activo: boolean | null
          capacidad_bultos: number | null
          capacidad_kg: number | null
          created_at: string
          id: string
          marca: string | null
          modelo: string | null
          observaciones: string | null
          patente: string
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          capacidad_bultos?: number | null
          capacidad_kg?: number | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          observaciones?: string | null
          patente: string
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          capacidad_bultos?: number | null
          capacidad_kg?: number | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          observaciones?: string | null
          patente?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendedor_zonas: {
        Row: {
          created_at: string
          id: string
          vendedor_id: string
          zona_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          vendedor_id: string
          zona_id: string
        }
        Update: {
          created_at?: string
          id?: string
          vendedor_id?: string
          zona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_zonas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_zonas_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string | null
          empleado_id: string | null
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          empleado_id?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          empleado_id?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedores_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_detalles_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
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
          {
            foreignKeyName: "venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_line"
            referencedColumns: ["venta_id"]
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
      visita_incidencias: {
        Row: {
          created_at: string
          descripcion: string
          estado: string
          id: string
          prioridad: string
          tipo: string
          visita_id: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          estado?: string
          id?: string
          prioridad?: string
          tipo: string
          visita_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          estado?: string
          id?: string
          prioridad?: string
          tipo?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_incidencias_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          cliente_id: string
          created_at: string
          estado: string
          fecha_checkin: string | null
          fecha_programada: string
          hora_programada: string | null
          id: string
          latitud_checkin: number | null
          longitud_checkin: number | null
          motivo_no_visita: string | null
          notas: string | null
          precision_gps: number | null
          updated_at: string
          usuario_id: string
          vendedor_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          estado?: string
          fecha_checkin?: string | null
          fecha_programada: string
          hora_programada?: string | null
          id?: string
          latitud_checkin?: number | null
          longitud_checkin?: number | null
          motivo_no_visita?: string | null
          notas?: string | null
          precision_gps?: number | null
          updated_at?: string
          usuario_id: string
          vendedor_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          estado?: string
          fecha_checkin?: string | null
          fecha_programada?: string
          hora_programada?: string | null
          id?: string
          latitud_checkin?: number | null
          longitud_checkin?: number | null
          motivo_no_visita?: string | null
          notas?: string | null
          precision_gps?: number | null
          updated_at?: string
          usuario_id?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      zona_horarios: {
        Row: {
          activo: boolean
          capacidad_maxima: number | null
          created_at: string
          dia_semana: number
          hora_desde: string | null
          hora_hasta: string | null
          id: string
          tipo: string
          turno_nombre: string
          updated_at: string
          zona_id: string
        }
        Insert: {
          activo?: boolean
          capacidad_maxima?: number | null
          created_at?: string
          dia_semana: number
          hora_desde?: string | null
          hora_hasta?: string | null
          id?: string
          tipo: string
          turno_nombre?: string
          updated_at?: string
          zona_id: string
        }
        Update: {
          activo?: boolean
          capacidad_maxima?: number | null
          created_at?: string
          dia_semana?: number
          hora_desde?: string | null
          hora_hasta?: string | null
          id?: string
          tipo?: string
          turno_nombre?: string
          updated_at?: string
          zona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zona_horarios_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      zonas: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string | null
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      cliente_facturas_adeudadas: {
        Row: {
          cantidad_facturas_adeudadas: number | null
          cliente_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_movimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_productos_frecuentes: {
        Row: {
          cantidad_total: number | null
          cliente_id: string | null
          codigo_articulo: string | null
          producto_id: string | null
          producto_nombre: string | null
          ultima_compra: string | null
          veces_comprado: number | null
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
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_saldos: {
        Row: {
          cliente_id: string | null
          saldo_actual: number | null
          total_deuda: number | null
          total_pagado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_movimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
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
      vw_candidatos_precio: {
        Row: {
          facturacion_30d: number | null
          margen_pct_prom: number | null
          margen_total_30d: number | null
          prioridad: string | null
          producto: string | null
          producto_id: string | null
          unidades_30d: number | null
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
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      vw_focus_final: {
        Row: {
          foco_detectado: string | null
        }
        Relationships: []
      }
      vw_kpis_30d_comparativo: {
        Row: {
          facturacion_30d: number | null
          facturacion_prev: number | null
          facturacion_var_pct: number | null
          margen_30d: number | null
          margen_pct_30d: number | null
          margen_pct_delta: number | null
          margen_pct_prev: number | null
          margen_prev: number | null
          margen_var_pct: number | null
          unidades_30d: number | null
          unidades_prev: number | null
          unidades_var_pct: number | null
        }
        Relationships: []
      }
      vw_kpis_producto: {
        Row: {
          facturacion: number | null
          margen_promedio: number | null
          margen_total: number | null
          precio_venta_prom: number | null
          producto: string | null
          producto_id: string | null
          unidades: number | null
        }
        Relationships: []
      }
      vw_productos_sensibles: {
        Row: {
          producto: string | null
          producto_id: string | null
          unidades_30d: number | null
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
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      vw_quiebre_probable: {
        Row: {
          dias_stock_estimados: number | null
          producto: string | null
          producto_id: string | null
          stock_actual: number | null
          stock_minimo: number | null
          unidades_30d: number | null
        }
        Relationships: []
      }
      vw_sales_line: {
        Row: {
          cantidad: number | null
          categoria_id: string | null
          cliente_id: string | null
          descuento: number | null
          empleado_id: string | null
          fecha: string | null
          marca_id: string | null
          margen_bruto: number | null
          margen_pct: number | null
          precio_costo: number | null
          precio_unitario: number | null
          producto: string | null
          producto_id: string | null
          subcategoria_id: string | null
          subtotal: number | null
          venta_id: string | null
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
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_kpis_producto"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_quiebre_probable"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_actual"
            referencedColumns: ["producto_id"]
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
      vw_stock_actual: {
        Row: {
          producto_id: string | null
          stock_actual: number | null
          stock_minimo: number | null
        }
        Insert: {
          producto_id?: string | null
          stock_actual?: never
          stock_minimo?: never
        }
        Update: {
          producto_id?: string | null
          stock_actual?: never
          stock_minimo?: never
        }
        Relationships: []
      }
    }
    Functions: {
      auto_expire_solicitudes: { Args: never; Returns: number }
      get_empleado_id: { Args: never; Returns: string }
      get_ventas_totales_por_medio_pago: {
        Args: {
          p_estado?: string
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_usuario_id?: string
        }
        Returns: {
          count_pedidos: number
          count_ventas: number
          forma_pago_nombre: string
          total: number
          total_general: number
        }[]
      }
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
      is_route_owner: { Args: { route_id: string }; Returns: boolean }
      is_route_responsable: { Args: { route_id: string }; Returns: boolean }
      is_stop_owner: { Args: { stop_id: string }; Returns: boolean }
      refacturar_hoja_ruta_producto: {
        Args: {
          p_hoja_ruta_id: string
          p_nueva_cantidad: number
          p_producto_id: string
        }
        Returns: Json
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
      app_role:
        | "admin"
        | "encargado"
        | "cajero"
        | "vendedor"
        | "deposito"
        | "chofer"
        | "administracion"
        | "responsable"
      cash_register_status: "abierta" | "cerrada"
      cheque_estado:
        | "en_cartera"
        | "depositado"
        | "cobrado"
        | "rechazado"
        | "endosado"
        | "vencido"
        | "anulado"
      cheque_tipo: "terceros" | "propio"
      orden_compra_estado:
        | "borrador"
        | "confirmada"
        | "parcial"
        | "recibida"
        | "anulada"
      pedido_estado:
        | "borrador"
        | "pendiente"
        | "confirmado"
        | "preparado"
        | "despachado"
        | "entregado"
        | "parcial"
        | "devuelto"
        | "anulado"
        | "rechazado"
      proveedor_movimiento_tipo:
        | "factura"
        | "pago"
        | "nota_credito"
        | "nota_debito"
        | "ajuste"
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
      app_role: [
        "admin",
        "encargado",
        "cajero",
        "vendedor",
        "deposito",
        "chofer",
        "administracion",
        "responsable",
      ],
      cash_register_status: ["abierta", "cerrada"],
      cheque_estado: [
        "en_cartera",
        "depositado",
        "cobrado",
        "rechazado",
        "endosado",
        "vencido",
        "anulado",
      ],
      cheque_tipo: ["terceros", "propio"],
      orden_compra_estado: [
        "borrador",
        "confirmada",
        "parcial",
        "recibida",
        "anulada",
      ],
      pedido_estado: [
        "borrador",
        "pendiente",
        "confirmado",
        "preparado",
        "despachado",
        "entregado",
        "parcial",
        "devuelto",
        "anulado",
        "rechazado",
      ],
      proveedor_movimiento_tipo: [
        "factura",
        "pago",
        "nota_credito",
        "nota_debito",
        "ajuste",
      ],
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
