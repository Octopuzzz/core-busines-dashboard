"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsOption } from "echarts";
import { cn } from "@/lib/ui/cn";

interface Props {
  option: EChartsOption;
  /** Tailwind height class, e.g. "h-64". */
  className: string;
  ariaLabel: string;
  onClick?: (p: { name: string; seriesName?: string; dataIndex: number }) => void;
}

/**
 * Thin React wrapper around an ECharts instance.
 * Lazy-loads ECharts, resizes with its container, and forwards clicks.
 */
export function EChart({ option, className, ariaLabel, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  const optionRef = useRef(option);

  useEffect(() => {
    clickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    import("echarts").then((echarts) => {
      if (disposed || !ref.current) return;
      chart.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
      chart.current.setOption(optionRef.current);
      chart.current.on("click", (event) =>
        clickRef.current?.({
          name: String(event.name),
          seriesName: event.seriesName,
          dataIndex: event.dataIndex,
        }),
      );
      resizeObserver = new ResizeObserver(() => chart.current?.resize());
      resizeObserver.observe(ref.current);
    });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} role="img" aria-label={ariaLabel} className={cn("w-full", className)} />;
}
