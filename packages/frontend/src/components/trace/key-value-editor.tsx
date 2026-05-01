"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Borderless inline select for in-editor use — strips the form-input chrome
const INLINE_SELECT_TRIGGER =
  "border-transparent bg-transparent dark:bg-transparent rounded-none px-1.5 hover:bg-foreground/[0.04] focus-visible:ring-0 focus-visible:border-transparent";

export type ParamType = "string" | "number" | "boolean" | "json";

export interface ParamRow {
  key: string;
  value: string;
  type: ParamType;
}

/** Try to convert a Python repr string (single quotes, True/False/None) to parsed JSON. */
export function pythonReprToJson(s: string): unknown | null {
  const fixed = s
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/'/g, '"');
  try {
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}

export function detectType(value: unknown): ParamType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "object" && value !== null) return "json";
  return "string";
}

export function inputToRows(input: unknown): ParamRow[] {
  if (input == null) return [];
  // Try to parse Python repr strings into objects
  if (typeof input === "string") {
    const parsed = pythonReprToJson(input);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      input = parsed;
    }
  }
  if (typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return [];
    return entries.map(([key, value]) => {
      const type = detectType(value);
      const strValue =
        type === "json"
          ? JSON.stringify(value, null, 2)
          : type === "boolean"
            ? String(value)
            : String(value ?? "");
      return { key, value: strValue, type };
    });
  }
  // Non-object input: single row
  return [{ key: "", value: JSON.stringify(input, null, 2) ?? "", type: "json" as ParamType }];
}

export function rowsToInput(rows: ParamRow[]): unknown {
  if (rows.length === 0) return {};
  if (rows.length === 1 && rows[0].key === "" && rows[0].value.trim()) {
    return JSON.parse(rows[0].value);
  }
  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.key) continue;
    switch (row.type) {
      case "number":
        obj[row.key] = Number(row.value);
        break;
      case "boolean":
        obj[row.key] = row.value === "true";
        break;
      case "json":
        obj[row.key] = JSON.parse(row.value);
        break;
      default:
        obj[row.key] = row.value;
    }
  }
  return obj;
}

export function validateRow(row: ParamRow): string | null {
  if (row.type === "number" && isNaN(Number(row.value))) return "Invalid number";
  if (row.type === "json") {
    try {
      JSON.parse(row.value);
    } catch {
      return "Invalid JSON";
    }
  }
  return null;
}

export function KeyValueEditor({
  rows,
  onChange,
}: {
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
}) {
  const updateRow = (index: number, patch: Partial<ParamRow>) => {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, { key: "", value: "", type: "string" }]);
  };

  return (
    <div className="space-y-1.5">
      {rows.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1.5fr_80px_32px] gap-0 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="px-2.5 py-1.5">Key</div>
            <div className="px-2.5 py-1.5 border-l border-border">Value</div>
            <div className="px-2.5 py-1.5 border-l border-border">Type</div>
            <div className="px-2.5 py-1.5 border-l border-border" />
          </div>
          {/* Rows */}
          {rows.map((row, i) => {
            const error = validateRow(row);
            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[1fr_1.5fr_80px_32px] gap-0 border-b border-border last:border-0",
                  error && "bg-destructive/5",
                )}
              >
                <div className="px-1">
                  <input
                    value={row.key}
                    onChange={(e) => updateRow(i, { key: e.target.value })}
                    className="w-full px-1.5 py-1.5 bg-transparent font-mono text-xs focus:outline-none"
                    placeholder="key"
                    spellCheck={false}
                  />
                </div>
                <div className="border-l border-border px-1">
                  {row.type === "json" ? (
                    <textarea
                      value={row.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      className="w-full px-1.5 py-1.5 bg-transparent font-mono text-xs focus:outline-none resize-y min-h-7"
                      spellCheck={false}
                      rows={Math.min(row.value.split("\n").length, 4)}
                    />
                  ) : row.type === "boolean" ? (
                    <Select
                      value={row.value}
                      onValueChange={(v) => v && updateRow(i, { value: v })}
                    >
                      <SelectTrigger size="sm" className={cn(INLINE_SELECT_TRIGGER, "w-full")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      value={row.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      className={cn(
                        "w-full px-1.5 py-1.5 bg-transparent font-mono text-xs focus:outline-none",
                        error && "text-destructive",
                      )}
                      placeholder="value"
                      spellCheck={false}
                    />
                  )}
                </div>
                <div className="border-l border-border px-1">
                  <Select
                    value={row.type}
                    onValueChange={(v) => v && updateRow(i, { type: v as ParamType })}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn(INLINE_SELECT_TRIGGER, "w-full text-muted-foreground")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                      <SelectItem value="json">json</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-l border-border flex items-start justify-center pt-1.5">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button
        onClick={addRow}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-3" />
        Add parameter
      </button>
    </div>
  );
}
