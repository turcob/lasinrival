import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Categorias from "./pages/Categorias";
import Subcategorias from "./pages/Subcategorias";
import Clientes from "./pages/Clientes";
import Usuarios from "./pages/Usuarios";
import Roles from "./pages/Roles";
import Cajas from "./pages/Cajas";
import POS from "./pages/POS";
import Ventas from "./pages/Ventas";
import ListasPrecios from "./pages/ListasPrecios";
import Marcas from "./pages/Marcas";
import TiposProducto from "./pages/TiposProducto";
import Facturacion from "./pages/Facturacion";
import Configuracion from "./pages/Configuracion";
import Tarjetas from "./pages/Tarjetas";
import AdminDescuentos from "./pages/AdminDescuentos";
import Empleados from "./pages/Empleados";
import Vendedores from "./pages/Vendedores";
import Zonas from "./pages/Zonas";
import Imputacion from "./pages/Imputacion";
import AsociacionPagos from "./pages/AsociacionPagos";
import Sugerencias from "./pages/Sugerencias";
import Pedidos from "./pages/Pedidos";
import Logistica from "./pages/Logistica";
import AgendaVisitas from "./pages/AgendaVisitas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, redirectPath }: { children: React.ReactNode; redirectPath?: string }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (!user) {
    const authPath = redirectPath ? `/auth?redirect=${encodeURIComponent(redirectPath)}` : '/auth';
    return <Navigate to={authPath} replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/productos" element={<ProtectedRoute><Productos /></ProtectedRoute>} />
      <Route path="/listas-precios" element={<ProtectedRoute><ListasPrecios /></ProtectedRoute>} />
      <Route path="/marcas" element={<ProtectedRoute><Marcas /></ProtectedRoute>} />
      <Route path="/tipos-producto" element={<ProtectedRoute><TiposProducto /></ProtectedRoute>} />
      <Route path="/categorias" element={<ProtectedRoute><Categorias /></ProtectedRoute>} />
      <Route path="/subcategorias" element={<ProtectedRoute><Subcategorias /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
      <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
      <Route path="/ventas" element={<ProtectedRoute><Ventas /></ProtectedRoute>} />
      <Route path="/cajas" element={<ProtectedRoute><Cajas /></ProtectedRoute>} />
      <Route path="/facturacion" element={<ProtectedRoute><Facturacion /></ProtectedRoute>} />
      <Route path="/tarjetas" element={<ProtectedRoute><Tarjetas /></ProtectedRoute>} />
      <Route path="/inventario" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/reportes" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
      <Route path="/admin-descuentos" element={<ProtectedRoute redirectPath="/admin-descuentos"><AdminDescuentos /></ProtectedRoute>} />
      <Route path="/empleados" element={<ProtectedRoute><Empleados /></ProtectedRoute>} />
      <Route path="/vendedores" element={<ProtectedRoute><Vendedores /></ProtectedRoute>} />
      <Route path="/zonas" element={<ProtectedRoute><Zonas /></ProtectedRoute>} />
      <Route path="/imputacion" element={<ProtectedRoute><Imputacion /></ProtectedRoute>} />
      <Route path="/asociacion-pagos" element={<ProtectedRoute><AsociacionPagos /></ProtectedRoute>} />
      <Route path="/sugerencias" element={<ProtectedRoute><Sugerencias /></ProtectedRoute>} />
      <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
      <Route path="/logistica" element={<ProtectedRoute><Logistica /></ProtectedRoute>} />
      <Route path="/agenda-visitas" element={<ProtectedRoute><AgendaVisitas /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;