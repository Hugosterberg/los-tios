// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function DashboardPanel({
  title,
  description,
  action,
  sourceBadge,
  className,
  contentClassName,
  children,
  ...props
}) {
  return (
    <Card
      className={cn("border-yellow-500/20 bg-[#242424] text-white shadow-none", className)}
      {...props}
    >
      {(title || description || action) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-yellow-500/10 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {title ? <CardTitle className="text-sm font-semibold text-yellow-400">{title}</CardTitle> : null}
              {sourceBadge ? <div className="shrink-0">{sourceBadge}</div> : null}
            </div>
            {description ? <CardDescription className="text-xs text-gray-400">{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      )}
      <CardContent className={cn("p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
