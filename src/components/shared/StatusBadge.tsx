import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusType = 'success' | 'warning' | 'destructive' | 'default';

interface StatusBadgeProps {
  status: boolean | string;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}

export function StatusBadge({
  status,
  activeLabel = 'Activo',
  inactiveLabel = 'Inactivo',
  className,
}: StatusBadgeProps) {
  const isActive = typeof status === 'boolean' ? status : status === 'activo';
  
  return (
    <Badge
      variant="outline"
      className={cn(
        isActive ? 'badge-success' : 'badge-destructive',
        className
      )}
    >
      {isActive ? activeLabel : inactiveLabel}
    </Badge>
  );
}