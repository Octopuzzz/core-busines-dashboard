import { cn } from "@/lib/ui/cn";

interface Props {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function FormatOption({ selected, onSelect, icon, title, description }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start justify-start rounded-lg border p-3.5 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected ? "border-accent bg-accent/8" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <span className="flex">{icon}</span>
      <span className="mt-2 block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span>
    </button>
  );
}
