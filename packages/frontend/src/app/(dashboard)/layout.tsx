"use client";

import { TopNav } from "@/components/layout/top-nav";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Project pages have their own layout with TopNav + Sidebar
  const isProjectPage = pathname.startsWith("/project/");

  if (isProjectPage) {
    return <>{children}</>;
  }

  // Non-project pages (e.g. /projects, /projects/new) get TopNav only
  const breadcrumbs =
    pathname === "/projects/new"
      ? [{ label: "Projects", href: "/projects" }, { label: "New Project" }]
      : [{ label: "Projects" }];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav breadcrumbs={breadcrumbs} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
