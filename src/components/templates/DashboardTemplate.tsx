export function DashboardTemplate({
  topBar,
  banner,
  header,
  filters,
  kpis,
  charts,
  issues,
  overlay,
}: Record<"topBar" | "header", React.ReactNode> &
  Partial<
    Record<"banner" | "filters" | "kpis" | "charts" | "issues" | "overlay", React.ReactNode>
  >) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1440px] px-4 pb-16 sm:px-6">
      {topBar}
      {banner}
      {header}
      {filters}
      <div className="relative">
        {kpis}
        {charts}
        {issues}
        {overlay}
      </div>
    </div>
  );
}
