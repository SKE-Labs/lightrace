import { Bot, Cog, CircleDot, Wrench, Link } from "lucide-react";
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
      return { icon: Bot, color: "text-blue-600 dark:text-blue-500", label: "Generation" };
    case "SPAN":
      return { icon: Cog, color: "text-amber-600 dark:text-amber-500", label: "Span" };
    case "EVENT":
      return { icon: CircleDot, color: "text-green-600 dark:text-green-500", label: "Event" };
    case "TOOL":
      return { icon: Wrench, color: "text-orange-600 dark:text-orange-500", label: "Tool" };
    case "CHAIN":
      return { icon: Link, color: "text-pink-600 dark:text-pink-500", label: "Chain" };
  }
}
