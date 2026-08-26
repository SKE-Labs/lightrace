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

export function stringifyInput(input: unknown): string {
  if (typeof input === "string") {
    const parsed = pythonReprToJson(input);
    if (parsed !== null) return JSON.stringify(parsed, null, 2);
  }
  return JSON.stringify(input, null, 2) ?? "{}";
}
