import { cn } from "@/lib/utils";

export function BrandLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const h = size === "sm" ? "h-6" : size === "lg" ? "h-11" : "h-8";
  return (
    <>
      <img
        src="/lr_primary.svg"
        alt="LightRace"
        className={cn(h, "w-auto dark:hidden", className)}
      />
      <img
        src="/lr_white.svg"
        alt="LightRace"
        className={cn(h, "w-auto hidden dark:block", className)}
      />
    </>
  );
}
