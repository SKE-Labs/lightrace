"use client";

import { useState, useRef, useCallback } from "react";

export function useScrollSections(sectionIds: string[]) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");
  // Stable refs map without calling hooks in a loop — use a single ref container
  const refsContainer = useRef<Record<string, React.RefObject<HTMLDivElement | null>> | null>(null);
  if (!refsContainer.current) {
    refsContainer.current = Object.fromEntries(
      sectionIds.map((id) => [id, { current: null } as React.RefObject<HTMLDivElement | null>]),
    );
  }
  const refs = refsContainer.current;

  const scrollTo = useCallback(
    (id: string) => {
      setActiveId(id);
      refs[id]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [refs],
  );

  return { activeId, refs, scrollTo, setActiveId } as const;
}
