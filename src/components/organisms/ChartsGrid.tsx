"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Metrics } from "@/lib/metrics";
import { trendOption, typeOption, workloadOption } from "@/lib/charts";
import { EChart } from "../atoms";
import { Panel } from "../molecules";
import { useTheme } from "../providers/ThemeProvider";
import { StatusPanel } from "./StatusPanel";

gsap.registerPlugin(useGSAP);

/** A filter set by clicking a chart (person = accountId). */
export interface ChartFilter {
  person?: string;
  status?: string;
  type?: string;
}

/** Height class for the workload chart, by number of people (Tailwind needs literal class names). */
function workloadHeight(peopleCount: number) {
  if (peopleCount <= 4) return "h-64";
  if (peopleCount <= 7) return "h-80";
  if (peopleCount <= 10) return "h-96";
  if (peopleCount <= 13) return "h-[28rem]";
  return "h-[34rem]";
}

interface Props {
  metrics: Metrics;
  onFilter: (filter: ChartFilter) => void;
  /** Status currently used as a filter, highlighted in the status list. */
  activeStatus?: string;
}

/** The four chart panels: workload, status, created-vs-resolved trend, and issue types. */
export function ChartsGrid({ metrics, onFilter, activeStatus }: Props) {
  const { palette } = useTheme();
  const root = useRef<HTMLDivElement>(null);

  const workloadChart = useMemo(() => workloadOption(metrics, palette), [metrics, palette]);
  const trendChart = useMemo(() => trendOption(metrics, palette), [metrics, palette]);
  const typeChart = useMemo(() => typeOption(metrics, palette), [metrics, palette]);
  // The workload chart draws people bottom-up, so its bar index maps to the reversed list.
  const peopleInChartOrder = useMemo(() => [...metrics.byPerson].reverse(), [metrics]);
  const workloadHeightClass = workloadHeight(metrics.byPerson.length);

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-anim=panel]",
          { y: 28, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.75,
            stagger: 0.08,
            ease: "power3.out",
            delay: 0.3,
            clearProps: "transform,opacity,visibility",
          },
        );
      });
    },
    { scope: root },
  );

  const focusPersonAtBar = ({ dataIndex }: { dataIndex: number }) => {
    const person = peopleInChartOrder[dataIndex];
    if (person) onFilter({ person: person.accountId });
  };

  return (
    <div ref={root} className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
      <Panel title="Workload per person" hint="Click a bar to focus" className="lg:col-span-7">
        <EChart
          option={workloadChart}
          className={workloadHeightClass}
          ariaLabel="Stacked bars: issues per person by status"
          onClick={focusPersonAtBar}
        />
      </Panel>

      <StatusPanel
        metrics={metrics}
        active={activeStatus}
        onPick={(status) => onFilter({ status })}
        className="lg:col-span-5"
      />

      <Panel title="Created vs resolved" hint="Last 12 weeks" className="lg:col-span-8">
        <EChart
          option={trendChart}
          className="h-64"
          ariaLabel="Lines: issues created and resolved per week"
        />
      </Panel>

      <Panel title="Issue types" hint="Click a bar" className="lg:col-span-4">
        <EChart
          option={typeChart}
          className="h-64"
          ariaLabel="Bars: issues by type"
          onClick={(bar) => onFilter({ type: bar.name })}
        />
      </Panel>
    </div>
  );
}
