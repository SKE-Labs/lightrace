"use client";

import { cn } from "@/lib/utils";

export function SectionNav({
  items,
  activeId,
  onSelect,
}: {
  items: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-0 mx-4 mt-1 border-b border-border">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            "text-xs px-3 py-2 -mb-px border-b-2 transition-colors duration-150",
            activeId === item.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
