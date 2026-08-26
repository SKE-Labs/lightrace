"use client";

import { useState, useMemo, useEffect } from "react";
import {
  inputToRows,
  rowsToInput,
  validateRow,
  pythonReprToJson,
  stringifyInput,
  type ParamRow,
} from "./tool-params";

export function useToolInputEditor(originalInput: unknown, resetKey?: string) {
  const [rows, setRows] = useState<ParamRow[]>(() => inputToRows(originalInput));
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(() => stringifyInput(originalInput));

  useEffect(() => {
    setRows(inputToRows(originalInput));
    setRawMode(false);
    setRawText(stringifyInput(originalInput));
    // Reset only when resetKey changes (e.g., observationId) — originalInput changes
    // alone would otherwise cause stale closure; callers should include stable resetKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const rowErrors = useMemo(() => rows.map(validateRow), [rows]);
  const hasRowErrors = useMemo(() => rowErrors.some((e) => e !== null), [rowErrors]);

  const rawJsonValid = useMemo(() => {
    if (!rawMode) return true;
    try {
      JSON.parse(rawText);
      return true;
    } catch {
      return false;
    }
  }, [rawMode, rawText]);

  const switchToTable = () => {
    if (!rawMode) return;
    try {
      const parsed = JSON.parse(rawText);
      setRows(inputToRows(parsed));
    } catch {
      return;
    }
    setRawMode(false);
  };

  const switchToRaw = () => {
    if (rawMode) return;
    try {
      setRawText(JSON.stringify(rowsToInput(rows), null, 2));
    } catch {
      setRawText("{}");
    }
    setRawMode(true);
  };

  const getParsedInput = (): unknown => {
    if (rawMode) return JSON.parse(rawText);
    return rowsToInput(rows);
  };

  return {
    rows,
    setRows,
    rawMode,
    setRawMode,
    rawText,
    setRawText,
    switchToTable,
    switchToRaw,
    rowErrors,
    hasRowErrors,
    rawJsonValid,
    getParsedInput,
  } as const;
}
