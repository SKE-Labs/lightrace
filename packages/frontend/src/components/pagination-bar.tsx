import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPageNumbers } from "@/lib/pagination";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label: string;
}

export function PaginationBar({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  label,
}: PaginationBarProps) {
  if (totalCount === 0) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-3">
      <span className="text-xs text-muted-foreground">
        Showing {rangeStart}–{rangeEnd} of {totalCount} {label}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  "size-7 rounded-md text-xs font-medium transition-colors",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {p}
              </button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
