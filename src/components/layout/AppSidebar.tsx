import { useState } from 'react';
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
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Punto de Venta', href: '/pos', icon: ShoppingCart, module: 'ventas' },
  { title: 'Ventas', href: '/ventas', icon: DollarSign, module: 'ventas' },
];

const catalogNavItems: NavItem[] = [
  { title: 'Productos', href: '/productos', icon: Package, module: 'productos' },
  { title: 'Listas de Precios', href: '/listas-precios', icon: DollarSign, module: 'precios' },
  { title: 'Categorías', href: '/categorias', icon: Tags, module: 'categorias' },
  { title: 'Subcategorías', href: '/subcategorias', icon: Layers, module: 'subcategorias' },
  { title: 'Clientes', href: '/clientes', icon: Users, module: 'clientes' },
];

const operationsNavItems: NavItem[] = [
  { title: 'Cajas', href: '/cajas', icon: CreditCard, module: 'cajas' },
  { title: 'Inventario', href: '/inventario', icon: Archive, module: 'inventario' },
  { title: 'Reportes', href: '/reportes', icon: BarChart3, module: 'reportes' },
];

const adminNavItems: NavItem[] = [
  { title: 'Usuarios', href: '/usuarios', icon: UserCog, module: 'usuarios' },
  { title: 'Roles y Permisos', href: '/roles', icon: Shield, module: 'roles' },
  { title: 'Configuración', href: '/configuracion', icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile, signOut, hasRole } = useAuth();

  const isAdmin = hasRole('admin');
  const isEncargado = hasRole('encargado');

  const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => (
    <div className="mb-6">
      {!collapsed && (
        <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) => {
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
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Package className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground">GestiónPro</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
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