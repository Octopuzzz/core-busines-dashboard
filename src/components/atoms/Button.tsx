"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/ui/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 shadow-e1",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "text-overdue hover:bg-overdue/10",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};
const iconSizes: Record<Size, string> = { sm: "size-8", md: "size-9", lg: "size-11" };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Square, icon-only button. Requires aria-label. */
  iconOnly?: boolean;
}

/** The app's button: primary / secondary / ghost / danger, three sizes, optional icon and loading spinner. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading,
    icon,
    iconOnly,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color,transform,filter] duration-150 ease-out active:scale-[0.97]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        iconOnly ? cn(iconSizes[size], "p-0") : sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});
