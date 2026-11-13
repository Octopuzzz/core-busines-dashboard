"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui/cn";

const tints = [
  "bg-accent/15 text-accent",
  "bg-done/15 text-done",
  "bg-warn/15 text-warn",
  "bg-overdue/12 text-overdue",
  "bg-ink/10 text-ink-2",
];
const hashName = (text: string) =>
  [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

const sizes = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

function usable(src?: string) {
  if (!src) return undefined;
  if (/\/initials\//i.test(src.split("?")[0])) return undefined;
  if (/gravatar\.com/.test(src) && /[?&]d=[^&]*initials/i.test(src))
    return src.replace(/([?&]d=)[^&]*/, "$1404");
  return src;
}

export function Avatar({
  name,
  src,
  size = "sm",
  className,
}: {
  name: string;
  src?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const url = usable(src);
  const [failed, setFailed] = useState<string | null>(null);
  const showImg = url && failed !== url;
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = image.current;
    if (url && img?.complete && img.naturalWidth === 0) setFailed(url);
  }, [url]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold",
        sizes[size],
        !showImg && tints[hashName(name) % tints.length],
        className,
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Jira/Gravatar avatars, already sized
        <img
          ref={image}
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(url)}
          className="size-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}
