"use client";

import { cn } from "@/lib/utils";
import { KeyValueEditor } from "./key-value-editor";
import type { ParamRow } from "@/lib/tool-params";
import { XCircle } from "lucide-react";

interface ToolInputEditorProps {
  rows: ParamRow[];
  onChangeRows: (rows: ParamRow[]) => void;
  rawMode: boolean;
  rawText: string;
  onChangeRawText: (text: string) => void;
  onSwitchToTable: () => void;
  onSwitchToRaw: () => void;
  rawJsonValid: boolean;
  label?: string;
}

export function ToolInputEditor({
  rows,
  onChangeRows,
  rawMode,
  rawText,
  onChangeRawText,
  onSwitchToTable,
  onSwitchToRaw,
  rawJsonValid,
  label = "Input",
}: ToolInputEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        <div className="flex rounded-md border border-border text-xs overflow-hidden">
          <button
            type="button"
            onClick={onSwitchToTable}
            className={cn(
              "px-2 py-0.5 transition-colors",
              !rawMode ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Table
          </button>
          <button
            type="button"
            onClick={onSwitchToRaw}
            className={cn(
              "px-2 py-0.5 transition-colors border-l border-border",
              rawMode ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Raw JSON
          </button>
        </div>
      </div>

      {rawMode ? (
        <div className="space-y-1">
          <textarea
            value={rawText}
            onChange={(e) => onChangeRawText(e.target.value)}
            className="w-full min-h-[120px] rounded-md border border-border bg-muted/50 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            spellCheck={false}
          />
          {!rawJsonValid && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <XCircle className="size-3" />
              Invalid JSON
            </p>
          )}
        </div>
      ) : (
        <KeyValueEditor rows={rows} onChange={onChangeRows} />
      )}
    </div>
  );
}
