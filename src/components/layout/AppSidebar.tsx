import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  CreditCard,
  Archive,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Tags,
  Layers,
  UserCog,
  Shield,
  UserCheck,
  MapPin,
  Lightbulb,
  ClipboardList,
  Truck,
  Calendar,
  Smartphone,
  FileCheck,
  Building2,
  PackageX,
  Route as RouteIcon,
  Wallet,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { title: 'Punto de Venta', href: '/pos', icon: ShoppingCart, module: 'ventas' },
  { title: 'Pedidos', href: '/pedidos', icon: ClipboardList, module: 'pedidos' },
  { title: 'Ventas', href: '/ventas', icon: DollarSign, module: 'ventas' },
];

const catalogNavItems: NavItem[] = [
  { title: 'Productos', href: '/productos', icon: Package, module: 'productos' },
  { title: 'Listas de Precios', href: '/listas-precios', icon: DollarSign, module: 'precios' },
  { title: 'Marcas', href: '/marcas', icon: Tags, module: 'productos' },
  { title: 'Tipos de Producto', href: '/tipos-producto', icon: Layers, module: 'productos' },
  { title: 'Categorías', href: '/categorias', icon: Tags, module: 'categorias' },
  { title: 'Subcategorías', href: '/subcategorias', icon: Layers, module: 'subcategorias' },
  { title: 'Clientes', href: '/clientes', icon: Users, module: 'clientes' },
  { title: 'Vendedores', href: '/vendedores', icon: UserCheck, module: 'clientes' },
  { title: 'Zonas', href: '/zonas', icon: MapPin, module: 'clientes' },
];

const operationsNavItems: NavItem[] = [
  { title: 'Cajas', href: '/cajas', icon: CreditCard, module: 'cajas' },
  { title: 'Logística', href: '/logistica', icon: Truck, module: 'logistica' },
  { title: 'Detalle Entregas', href: '/detalle-entregas', icon: RouteIcon, module: 'logistica' },
  { title: 'Devoluciones', href: '/devoluciones', icon: PackageX, module: 'clientes' },
  { title: 'Horarios Zona', href: '/horarios-zona', icon: Calendar, module: 'logistica' },
  { title: 'Proveedores', href: '/proveedores', icon: Building2, module: 'proveedores' },
  { title: 'Agenda Visitas', href: '/agenda-visitas', icon: Calendar, module: 'ventas' },
  { title: 'Imputación', href: '/imputacion', icon: CreditCard, module: 'clientes' },
  { title: 'Asociar Pagos', href: '/asociacion-pagos', icon: CreditCard, module: 'clientes' },
  { title: 'Tarjetas', href: '/tarjetas', icon: CreditCard, module: 'tarjetas' },
  { title: 'Clover', href: '/clover', icon: Smartphone, module: 'clientes' },
  { title: 'Cheques', href: '/cheques', icon: FileCheck, module: 'cheques' },
  { title: 'Facturación', href: '/facturacion', icon: DollarSign, module: 'facturacion' },
  { title: 'Reporte Pagos', href: '/reporte-pagos', icon: BarChart3, module: 'clientes' },
  { title: 'Pendientes de Chofer', href: '/pendientes-chofer', icon: Wallet, module: 'empleados' },
  { title: 'Inventario', href: '/inventario', icon: Archive, module: 'inventario' },
  { title: 'Reportes', href: '/reportes', icon: BarChart3, module: 'reportes' },
];

const adminNavItems: NavItem[] = [
  { title: 'Empleados', href: '/empleados', icon: Users, module: 'empleados' },
  { title: 'Usuarios', href: '/usuarios', icon: UserCog, module: 'usuarios' },
  { title: 'Roles y Permisos', href: '/roles', icon: Shield, module: 'roles' },
  { title: 'Sugerencias', href: '/sugerencias', icon: Lightbulb },
  { title: 'Configuración', href: '/configuracion', icon: Settings },
  { title: 'Ayuda', href: '/ayuda', icon: HelpCircle },
];

export function AppSidebar() {
  const { collapsed, toggleCollapsed } = useSidebarContext();
  const [modulePermissions, setModulePermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const location = useLocation();
  const { profile, signOut, hasRole, hasPermission } = useAuth();
  const { config } = useConfiguracionComercio();

  const isAdmin = hasRole('admin');
  const isEncargado = hasRole('encargado');
  
  const nombreSistema = config?.nombre_sistema || 'GestiónPro';

  // Load permissions for all modules on mount
  useEffect(() => {
    const loadPermissions = async () => {
      // Admins have all permissions
      if (isAdmin) {
        setPermissionsLoaded(true);
        return;
      }

      const allItems = [...mainNavItems, ...catalogNavItems, ...operationsNavItems, ...adminNavItems];
      const modules = [...new Set(allItems.filter(item => item.module).map(item => item.module!))];
      
      const permissions: Record<string, boolean> = {};
      
      await Promise.all(
        modules.map(async (module) => {
          const canView = await hasPermission(module, 'ver');
          permissions[module] = canView;
        })
      );
      
      setModulePermissions(permissions);
      setPermissionsLoaded(true);
    };

    loadPermissions();
  }, [isAdmin, hasPermission]);

  const canAccessItem = (item: NavItem): boolean => {
    // Admins can access everything
    if (isAdmin) return true;
    // Items without module restriction are accessible to all
    if (!item.module) return true;
    // Check permission
    return modulePermissions[item.module] ?? false;
  };

  const filterItems = (items: NavItem[]): NavItem[] => {
    return items.filter(canAccessItem);
  };

  const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => {
    const filteredItems = filterItems(items);
    
    // Don't render section if no items are visible
    if (filteredItems.length === 0) return null;
    
    return (
      <div className="mb-6">
        {!collapsed && (
          <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
            {title}
          </h3>
        )}
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  "sidebar-item",
                  isActive ? "sidebar-item-active" : "sidebar-item-inactive"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white p-0.5 border border-sidebar-border flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo-empresa.jpg" alt="Logo" className="h-full w-full object-contain" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-sidebar-foreground truncate">{nombreSistema}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <NavSection title="Principal" items={mainNavItems} />
          <NavSection title="Catálogo" items={catalogNavItems} />
          <NavSection title="Operaciones" items={operationsNavItems} />
          {(isAdmin || isEncargado) && (
            <NavSection title="Administración" items={adminNavItems} />
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          {!collapsed && profile && (
            <div className="mb-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.nombre}
              </p>
              <p className="text-xs text-sidebar-muted truncate">
                {profile.email}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={signOut}
            className={cn(
              "text-sidebar-foreground hover:bg-sidebar-accent",
              !collapsed && "w-full justify-start"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Cerrar sesión</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}