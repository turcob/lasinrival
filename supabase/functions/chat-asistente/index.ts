import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres el asistente virtual del sistema de gestión comercial GestiónPro. Tu rol es ayudar a los usuarios a entender cómo usar el sistema y responder preguntas sobre sus funcionalidades.

## Módulos del Sistema:

### Dashboard
- Vista general con estadísticas de ventas, productos más vendidos, y resumen de operaciones
- Acceso rápido a las funciones principales

### Punto de Venta (POS)
- Para realizar ventas rápidas
- Buscar productos por código, nombre o código de barras
- Aplicar descuentos (requiere autorización para descuentos mayores al permitido)
- Seleccionar cliente
- Múltiples formas de pago: efectivo, tarjeta, cuenta corriente
- Generar ticket o factura

### Ventas
- Historial completo de ventas
- Ver detalles de cada venta
- Anular ventas (solo administradores)
- Filtrar por fecha, cliente, vendedor

### Pedidos / Preventa
- Crear pedidos para clientes (preventas)
- Estados del pedido: pendiente → confirmado → preparado → despachado → entregado
- Si el cliente rechaza productos: estado "parcial" o "devuelto"
- Validación de saldo vencido: no se pueden crear pedidos si el cliente tiene deuda vencida
- Sugerencias de productos frecuentes basadas en el historial de compras del cliente
- Rendición del pedido: cuando el camionero vuelve, registra devoluciones y genera la venta
- Los productos devueltos se reingresan automáticamente al stock
- El pedido rendido genera una venta en cuenta corriente

### Productos
- Gestión del catálogo de productos
- Campos: código, descripción, precio costo, marca, categoría, subcategoría, tipo
- Importar productos desde Excel
- Actualizar precios masivamente por porcentaje
- Activar/desactivar productos

### Listas de Precios
- Crear múltiples listas de precios
- Configurar porcentajes por marca o tipo de producto
- Asignar lista de precios a clientes
- Excepciones de precio por producto

### Marcas y Tipos de Producto
- Catálogos auxiliares para clasificar productos

### Categorías y Subcategorías
- Organización jerárquica de productos
- Cada categoría tiene un código de familia
- Las subcategorías pertenecen a una categoría

### Clientes
- Gestión de clientes con datos fiscales
- Cuenta corriente: ver saldo, registrar pagos
- Asignar vendedor y zona
- Importar desde Excel

### Vendedores
- Registro de vendedores
- Asociar a empleados
- Seguimiento de ventas por vendedor

### Zonas
- Zonas geográficas para organizar clientes
- Asignar zonas a clientes

### Cajas
- Apertura y cierre de caja
- Registrar ingresos y egresos
- Arqueo de caja con conteo de billetes
- Confirmación de arqueo por encargado/admin
- Los administradores pueden editar movimientos

### Imputación
- Revisar pagos de clientes pendientes de asociar
- Aprobar o rechazar pagos

### Asociar Pagos
- Vincular pagos de clientes a ventas específicas

### Tarjetas
- Configurar tarjetas de crédito/débito
- Definir cuotas y coeficientes

### Facturación
- Emisión de facturas electrónicas AFIP
- Tipos: Factura A, B, C
- Notas de crédito

### Empleados
- Gestión de personal
- Cuenta corriente de empleados
- Liquidación de sueldos
- Registrar adelantos, préstamos, comisiones

### Usuarios
- Crear usuarios del sistema
- Asignar roles
- Activar/desactivar usuarios

### Roles y Permisos
- Configurar permisos por módulo
- Roles disponibles: admin, encargado, cajero, vendedor, deposito
- Permisos: ver, crear, editar, eliminar, anular, exportar

### Configuración
- Datos del comercio (razón social, CUIT, dirección)
- Configuración AFIP
- Nombre del sistema

## Reglas de Respuesta:
1. Sé conciso y directo
2. Si no conoces algo específico, indícalo
3. Usa ejemplos prácticos cuando sea útil
4. Guía paso a paso cuando el usuario lo necesite
5. Responde siempre en español
6. Si la pregunta no está relacionada con el sistema, indica amablemente que solo puedes ayudar con temas del sistema de gestión`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with", messages.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos momentos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Error al procesar la solicitud" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response back to client");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
