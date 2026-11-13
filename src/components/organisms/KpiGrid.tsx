"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Metrics } from "@/lib/metrics";
import { KpiCard } from "../molecules";

gsap.registerPlugin(useGSAP);

type KpiTone = "ink" | "accent" | "done" | "overdue";

interface Kpi {
  label: string;
  value: number;
  format: (value: number) => string;
  foot?: string;
  tone?: KpiTone;
  progress?: number;
  key: keyof Pick<Metrics, "total" | "open" | "done" | "overdue"> | null;
}

const wholeNumber = (value: number) => `${Math.round(value)}`;

function buildKpis(metrics: Metrics): Kpi[] {
  return [
    {
      key: "total",
      label: "Total issues",
      value: metrics.total,
      format: wholeNumber,
      foot: "in current scope",
    },
    {
      key: "open",
      label: "Open",
      value: metrics.open,
      format: wholeNumber,
      foot: "to do + in progress",
      tone: "accent",
    },
    {
      key: "done",
      label: "Done",
      value: metrics.done,
      format: wholeNumber,
      foot: "resolved",
      tone: "done",
    },
    {
      key: "overdue",
      label: "Overdue",
      value: metrics.overdue,
      format: wholeNumber,
      foot: "past due, not done",
      tone: metrics.overdue ? "overdue" : "ink",
    },
    {
      key: null,
      label: "Completion",
      value: metrics.completionRate * 100,
      format: (value) => `${Math.round(value)}%`,
      progress: metrics.completionRate,
    },
    {
      key: null,
      label: "Avg. cycle",
      value: metrics.avgCycleDays ?? 0,
      format: (value) => (metrics.avgCycleDays == null ? "—" : `${value.toFixed(1)}d`),
      foot: "created → resolved",
    },
  ];
}

export function KpiGrid({ metrics, deltaFrom }: { metrics: Metrics; deltaFrom?: Metrics | null }) {
  const root = useRef<HTMLDivElement>(null);
  const previousValues = useRef<number[]>([]);
  const kpis = buildKpis(metrics);

  useGSAP(
    () => {
      gsap.set("[data-kpi-bar]", { scaleX: 0 });
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-anim=kpi]",
          { y: 16, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.6,
            stagger: 0.05,
            ease: "power3.out",
            delay: 0.2,
            clearProps: "transform,opacity,visibility",
          },
        );
      });
    },
    { scope: root },
  );

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>("[data-kpi-value]").forEach((element, index) => {
        const kpi = kpis[index];
        const counter = { value: previousValues.current[index] ?? 0 };
        gsap.to(counter, {
          value: kpi.value,
          duration: 0.9,
          ease: "power3.out",
          onUpdate: () => {
            element.textContent = kpi.format(counter.value);
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-kpi-bar]").forEach((bar) => {
        gsap.to(bar, { scaleX: Number(bar.dataset.kpiBar), duration: 1, ease: "power3.out" });
      });

      previousValues.current = kpis.map((kpi) => kpi.value);
    },
    { scope: root, dependencies: [metrics] },
  );

  return (
    <div ref={root} className="mb-3 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          display={kpi.format(0)}
          foot={kpi.foot}
          tone={kpi.tone}
          progress={kpi.progress}
          delta={deltaFrom && kpi.key ? metrics[kpi.key] - deltaFrom[kpi.key] : null}
        />
      ))}
    </div>
  );
}
