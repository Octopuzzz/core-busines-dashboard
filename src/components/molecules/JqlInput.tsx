"use client";

import { useRef } from "react";
import { cn } from "@/lib/ui/cn";
import { JqlHighlight } from "../atoms";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onFormat?: () => void;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
}

const shared =
  "m-0 px-3.5 py-3 [scrollbar-gutter:stable] font-mono text-[13px] leading-6 whitespace-pre-wrap break-words";

export function JqlInput({
  value,
  onChange,
  onSubmit,
  onFormat,
  invalid,
  placeholder,
  className,
}: Props) {
  const mirror = useRef<HTMLPreElement>(null);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-surface-2 transition-colors focus-within:border-accent",
        invalid ? "border-overdue/60" : "border-line",
        className,
      )}
    >
      <pre
        ref={mirror}
        aria-hidden
        className={cn(shared, "pointer-events-none absolute inset-0 overflow-hidden")}
      >
        <JqlHighlight jql={value} />
        {"\n"}
      </pre>
      <textarea
        autoFocus
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="JQL query"
        aria-invalid={invalid || undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (mirror.current) mirror.current.scrollTop = event.currentTarget.scrollTop;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmit?.();
          }
          if (event.key.toLowerCase() === "f" && event.shiftKey && event.altKey) {
            event.preventDefault();
            onFormat?.();
          }
        }}
        className={cn(
          shared,
          "relative block h-44 w-full resize-y bg-transparent text-transparent caret-ink outline-none selection:bg-accent/25 placeholder:text-muted",
        )}
      />
    </div>
  );
}
