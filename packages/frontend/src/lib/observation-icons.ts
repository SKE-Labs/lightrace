import { Bot, Settings2, CircleDot, Wrench, Link } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ObservationType } from "@prisma/client";

interface ObservationIconConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

export function getObservationIcon(type: ObservationType): ObservationIconConfig {
  switch (type) {
    case "GENERATION":
      return { icon: Bot, color: "text-chart-1", label: "Generation" };
    case "SPAN":
      return { icon: Settings2, color: "text-chart-3", label: "Span" };
    case "EVENT":
      return { icon: CircleDot, color: "text-chart-2", label: "Event" };
    case "TOOL":
      return { icon: Wrench, color: "text-chart-5", label: "Tool" };
    case "CHAIN":
      return { icon: Link, color: "text-chart-4", label: "Chain" };
  }
}
