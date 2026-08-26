"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SEARCH_DEBOUNCE_MS } from "./constants";

export function useDebouncedSearch(defaultValue = "", debounceMs = SEARCH_DEBOUNCE_MS) {
  const [search, setSearch] = useState(defaultValue);
  const [debouncedSearch, setDebouncedSearch] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSearchDebounced = useCallback(
    (value: string) => {
      setSearch(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDebouncedSearch(value), debounceMs);
    },
    [debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    search,
    debouncedSearch,
    setSearch: setSearchDebounced,
    setSearchImmediate: setSearch,
  } as const;
}
