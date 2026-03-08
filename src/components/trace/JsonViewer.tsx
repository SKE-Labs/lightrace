"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: unknown;
  defaultExpanded?: boolean;
  maxHeight?: string;
}

export function JsonViewer({ data, defaultExpanded = true, maxHeight = "400px" }: JsonViewerProps) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof data === "string") {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(data);
      return (
        <div className="overflow-auto font-mono text-xs" style={{ maxHeight }}>
          <JsonNode data={parsed} depth={0} defaultExpanded={defaultExpanded} />
        </div>
      );
    } catch {
      // Render as string with wrapping
      return (
        <div
          className="overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground"
          style={{ maxHeight }}
        >
          {data}
        </div>
      );
    }
  }

  return (
    <div className="overflow-auto font-mono text-xs" style={{ maxHeight }}>
      <JsonNode data={data} depth={0} defaultExpanded={defaultExpanded} />
    </div>
  );
}

function JsonNode({
  data,
  depth,
  defaultExpanded,
}: {
  data: unknown;
  depth: number;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 3);

  if (data === null) return <span className="text-orange-400">null</span>;
  if (data === undefined) return <span className="text-muted-foreground">undefined</span>;
  if (typeof data === "boolean") return <span className="text-amber-400">{data.toString()}</span>;
  if (typeof data === "number") return <span className="text-blue-400">{data}</span>;
  if (typeof data === "string") {
    if (data.length > 500) {
      return <TruncatedString value={data} />;
    }
    return <span className="text-green-400">&quot;{data}&quot;</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? "▾" : "▸"} [{data.length}]
        </button>
        {expanded && (
          <div className="ml-4 border-l border-border/50 pl-2">
            {data.map((item, i) => (
              <div key={i} className="py-0.5">
                <span className="text-muted-foreground mr-1">{i}:</span>
                <JsonNode data={item} depth={depth + 1} defaultExpanded={defaultExpanded} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;
    return (
      <span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? "▾" : "▸"} {"{"}
          {entries.length}
          {"}"}
        </button>
        {expanded && (
          <div className="ml-4 border-l border-border/50 pl-2">
            {entries.map(([key, value]) => (
              <div key={key} className="py-0.5">
                <span className="text-purple-400">{key}</span>
                <span className="text-muted-foreground">: </span>
                <JsonNode data={value} depth={depth + 1} defaultExpanded={defaultExpanded} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}

function TruncatedString({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? value : value.slice(0, 200);

  return (
    <span className="text-green-400">
      &quot;{display}
      {!expanded && value.length > 200 && (
        <button onClick={() => setExpanded(true)} className="ml-1 text-blue-400 hover:underline">
          ...({value.length} chars)
        </button>
      )}
      &quot;
    </span>
  );
}
