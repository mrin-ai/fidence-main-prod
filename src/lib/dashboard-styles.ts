export const dashboardCardClassName =
  "border border-border/50 shadow-none ring-0"

export const dashboardPanelHeaderClassName = "gap-1 pb-1"

export const dashboardPanelTitleClassName = "text-sm font-medium"

/** Shared body height — matches Monthly Revenue chart area */
export const dashboardPanelBodyHeightClassName = "h-60"

export const dashboardPanelScrollClassName =
  "flex flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

export const dashboardPanelFadeClassName =
  "pointer-events-none absolute inset-x-0 bottom-0 flex h-10 flex-col items-center justify-end rounded-b-xl bg-gradient-to-t from-card from-30% via-card/80 to-transparent pb-1 backdrop-blur-[1px] transition-opacity duration-200"

/** Top metric cards — light blue surface, blue border, primary fill on hover */
export const metricCardSurfaceClassName =
  "group/metric border border-primary/30 bg-secondary shadow-none ring-0 transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground"

export const metricCardLabelClassName =
  "text-muted-foreground transition-colors group-hover/metric:text-primary-foreground/80"

export const metricCardValueClassName =
  "text-foreground transition-colors group-hover/metric:text-primary-foreground"
