import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  description?: string;
  className?: string;
}

export function KPICard({ title, value, icon, trend, description, className }: KPICardProps) {
  const trendIcon = trend ? (
    trend.value > 0 ? (
      <TrendingUp className="h-4 w-4 text-success" />
    ) : trend.value < 0 ? (
      <TrendingDown className="h-4 w-4 text-destructive" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    )
  ) : null;

  const trendColor = trend
    ? trend.value > 0
      ? 'text-success'
      : trend.value < 0
      ? 'text-destructive'
      : 'text-muted-foreground'
    : '';

  return (
    <div className={cn("kpi-card", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trendIcon}
              <span className={cn("text-sm font-medium", trendColor)}>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-sm text-muted-foreground">{trend.label}</span>
            </div>
          )}
          {description && !trend && (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}