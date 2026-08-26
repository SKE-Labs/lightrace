"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatRelativeTime } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { PriorityBadge, StatusBadge } from "@/lib/error-config";
import { getObservationIcon } from "@/lib/observation-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Search, ChevronRight } from "lucide-react";

export default function ErrorsPage() {
  const router = useRouter();
  const projectId = useProjectStore((s) => s.projectId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("lastSeen");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.errors.list.useQuery(
    {
      projectId: projectId!,
      limit: PAGE_SIZE.ERRORS,
      page,
      search: search || undefined,
      status:
        status !== "all"
          ? (status as
              | "UNRESOLVED"
              | "RESOLVED"
              | "ARCHIVED"
              | "ESCALATING"
              | "REGRESSED"
              | "FOR_REVIEW")
          : undefined,
      type:
        type !== "all" ? (type as "TOOL" | "GENERATION" | "SPAN" | "CHAIN" | "EVENT") : undefined,
      sortBy: sortBy as "lastSeen" | "firstSeen" | "count" | "traceCount",
      sortOrder: "desc",
    },
    { enabled: !!projectId, refetchInterval: 10000 },
  );

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Sentry-like filter bar — search + status/type + sort, calm density */}
      <div className="flex flex-wrap items-center gap-2.5 px-6 py-3 border-b border-border bg-card/40">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            size="sm"
            placeholder="Search issues — title, culprit, tool"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-72 pl-8"
          />
        </div>

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        <Select
          value={status}
          onValueChange={(v: string | null) => {
            if (v) {
              setStatus(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
            <SelectItem value="ESCALATING">Escalating</SelectItem>
            <SelectItem value="REGRESSED">Regressed</SelectItem>
            <SelectItem value="FOR_REVIEW">For Review</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={(v: string | null) => {
            if (v) {
              setType(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="TOOL">TOOL</SelectItem>
            <SelectItem value="GENERATION">GENERATION</SelectItem>
            <SelectItem value="SPAN">SPAN</SelectItem>
            <SelectItem value="CHAIN">CHAIN</SelectItem>
            <SelectItem value="EVENT">EVENT</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(v: string | null) => {
            if (v) setSortBy(v);
          }}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastSeen">Last Seen</SelectItem>
            <SelectItem value="firstSeen">First Seen</SelectItem>
            <SelectItem value="count">Count</SelectItem>
            <SelectItem value="traceCount">Traces</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">
          {totalCount} {totalCount === 1 ? "issue" : "issues"} · {items.length} shown
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <Table density="tight">
          <TableHeader sticky>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="w-[48%]">Issue</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="hidden lg:table-cell">Culprit</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right hidden md:table-cell">Traces</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-right">Last Seen</TableHead>
              <TableHead className="w-6 p-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={9}>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-2 rounded-full" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                      <AlertTriangle className="size-5 opacity-60" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No issues found</p>
                    <p className="text-xs max-w-sm">
                      Errors from any observation with{" "}
                      <span className="font-mono">level=ERROR</span> will appear here. Adjust
                      filters or check back after traces arrive.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {items.map((issue) => (
              <TableRow
                key={issue.id}
                className="group/row cursor-pointer hover:bg-accent/40 transition-colors"
                onClick={() => router.push(`/project/${projectId}/errors/${issue.id}`)}
              >
                <TableCell className="py-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="mt-1.5 size-1.5 rounded-full bg-error shrink-0"
                      title={issue.level}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-sm font-medium leading-tight group-hover/row:text-foreground">
                          {issue.title}
                        </span>
                        <ChevronRight className="size-3 text-muted-foreground/0 group-hover/row:text-muted-foreground transition-colors shrink-0 hidden sm:inline" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border">
                          {issue.shortId}
                        </span>
                        {issue.toolName && (
                          <span className="font-mono text-xs truncate max-w-[160px]">
                            {issue.toolName}
                          </span>
                        )}
                        {issue.culprit && issue.culprit !== issue.toolName && (
                          <span className="truncate max-w-[180px] hidden md:inline">
                            · {issue.culprit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {(() => {
                    const { icon: Icon } = getObservationIcon(
                      issue.type as import("@prisma/client").ObservationType,
                    );
                    return (
                      <Badge variant="secondary" className="gap-1 font-mono">
                        <Icon className="size-3.5" />
                        {issue.type}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell className="font-mono text-xs hidden lg:table-cell max-w-[160px] truncate">
                  {issue.culprit ?? issue.toolName ?? "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">
                  {issue.count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs hidden md:table-cell">
                  {issue.traceCount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={issue.priority} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={issue.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground text-right whitespace-nowrap">
                  {formatRelativeTime(new Date(issue.lastSeen))}
                </TableCell>
                <TableCell className="p-0 pr-2">
                  <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover/row:text-muted-foreground transition-colors" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE.ERRORS}
        onPageChange={setPage}
        label="issues"
      />
    </div>
  );
}
