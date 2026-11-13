"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { Group } from "@/lib/groups/store";
import { Avatar } from "../atoms";

gsap.registerPlugin(useGSAP);

interface Props {
  groups: Group[];
  active: Group;
  period: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  sample?: boolean;
}

/** Big team title, member avatars, and the team tabs. Plays a GSAP intro on load and team switch. */
export function TeamHeader({ groups, active, period, onSelect, onNew, sample }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const linkedCount = active.members.filter((member) => member.person).length;

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        // fromTo with explicit end states + clearProps: if the intro is interrupted or replayed
        // (dev double-render, team switch), nothing can be left stuck mid-animation.
        const cleanUp = { clearProps: "transform,opacity,visibility" };
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .fromTo(
            "[data-anim=title] > span",
            { yPercent: 110 },
            { yPercent: 0, duration: 0.8, stagger: 0.06, ...cleanUp },
          )
          .fromTo(
            "[data-anim=meta]",
            { y: 8, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.5, ...cleanUp },
            "-=0.5",
          )
          .fromTo(
            "[data-anim=face]",
            { scale: 0.4, autoAlpha: 0 },
            {
              scale: 1,
              autoAlpha: 1,
              duration: 0.45,
              stagger: 0.035,
              ease: "back.out(2)",
              ...cleanUp,
            },
            "-=0.4",
          )
          .fromTo(
            "[data-anim=tab]",
            { y: 8, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.05, ...cleanUp },
            "-=0.5",
          );
      });
    },
    { scope: root, dependencies: [active.id], revertOnUpdate: true },
  );

  return (
    <div ref={root} className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            data-anim="title"
            className="overflow-hidden text-[clamp(30px,4.4vw,56px)] leading-[1.02] font-bold tracking-[-0.035em] text-ink"
          >
            {active.name.split(" ").map((word, index) => (
              <span key={index} className="mr-[0.22em] inline-block">
                {word}
              </span>
            ))}
          </h1>
          <p data-anim="meta" className="mt-2 text-sm text-muted">
            {sample ? (
              <>
                <span className="font-medium text-ink-2 tabular-nums">{active.members.length}</span>{" "}
                members · sample data
              </>
            ) : (
              <>
                <span className="font-medium text-ink-2 tabular-nums">
                  {linkedCount}/{active.members.length}
                </span>{" "}
                members linked to Jira
              </>
            )}{" "}
            · {period}
          </p>
        </div>
        <div className="flex -space-x-1.5" aria-label="Team members">
          {active.members.map((member) => (
            <span
              key={member.name}
              data-anim="face"
              title={member.name}
              className="rounded-full ring-2 ring-bg"
            >
              <Avatar
                name={member.person?.displayName ?? member.name}
                src={member.person?.avatarUrl}
                size="md"
                className={cn(!member.person && "opacity-40 grayscale")}
              />
            </span>
          ))}
        </div>
      </div>

      <nav
        aria-label="Teams"
        className="-mx-1 mt-4 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-1 py-1.5"
      >
        {groups.map((group) => {
          const isActive = group.id === active.id;
          return (
            <button
              key={group.id}
              data-anim="tab"
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(group.id)}
              className={cn(
                "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-pill border pr-2 pl-3.5 text-[13.5px] font-medium transition-[color,border-color,transform] active:scale-[0.97]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                isActive
                  ? "border-transparent text-ink"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="team-pill"
                  className="absolute inset-0 rounded-pill border border-accent/40 bg-accent/12"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{group.name}</span>
              <span
                className={cn(
                  "relative grid h-5 min-w-5 place-items-center rounded-pill px-1.5 text-[11px] font-medium tabular-nums",
                  isActive ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
                )}
              >
                {group.members.length}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          data-anim="tab"
          onClick={onNew}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border border-dashed border-line-strong px-3.5 text-[13.5px] font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-3.5" /> New team
        </button>
      </nav>
    </div>
  );
}
