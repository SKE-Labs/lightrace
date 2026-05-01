"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "transition-colors duration-150 shrink-0 text-muted-foreground hover:text-foreground",
        copied && "text-success",
        className,
      )}
      title={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={1.5} />
      ) : (
        <Copy className="size-3.5" strokeWidth={1.5} />
      )}
    </button>
  );
}
