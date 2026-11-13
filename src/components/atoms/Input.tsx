"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/ui/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, trailing, className, mono, ...rest },
  ref,
) {
  return (
    <label
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm",
        "transition-colors duration-150 hover:border-line-strong",
        "focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15",
        className,
      )}
    >
      {leading && <span className="flex shrink-0 text-muted">{leading}</span>}
      <input
        ref={ref}
        className={cn(
          "h-full w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-muted",
          mono && "font-mono text-[13px]",
        )}
        {...rest}
      />
      {trailing}
    </label>
  );
});
