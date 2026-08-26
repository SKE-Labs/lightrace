import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

interface AuthLayoutProps {
  subtitle: string;
  children: ReactNode;
  footerText: string;
  footerLink: string;
  footerLinkText: string;
}

export function AuthLayout({
  subtitle,
  children,
  footerText,
  footerLink,
  footerLinkText,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-85 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" />
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {children}

        <p className="text-center text-xs text-muted-foreground">
          {footerText}{" "}
          <Link
            href={footerLink}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
