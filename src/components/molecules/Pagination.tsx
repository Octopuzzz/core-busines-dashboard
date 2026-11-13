import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Mono } from "../atoms";

/** Previous / next page buttons with “page / total”. Hidden when there is only one page. */
export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        aria-label="Previous page"
        icon={<ChevronLeft className="size-4" />}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      />
      <Mono className="text-xs text-muted">
        {page} / {pages}
      </Mono>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        aria-label="Next page"
        icon={<ChevronRight className="size-4" />}
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      />
    </nav>
  );
}
