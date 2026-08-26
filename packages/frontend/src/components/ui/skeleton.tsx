"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} {...props} />;
}

export function SkeletonText({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { width?: string }) {
  return <Skeleton className={cn("h-4", className)} {...props} />;
}

export function SkeletonCircle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("rounded-full", className)} {...props} />;
}
