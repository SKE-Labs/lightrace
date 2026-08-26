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
import { AlertTriangle, Wrench, Cpu, Braces, Layers } from "lucide-react";

const PAGE_SIZE = 20;

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "TOOL":
      return <Wrench className="size-3.5" />;
    case "GENERATION":
      return <Cpu className="size-3.5" />;
    case "SPAN":
      return <Braces className="size-3.5" />;
    case "CHAIN":
      return <Layers className="size-3.5" />;
    default:
      return <AlertTriangle className="size-3.5" />;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const variant = priority === "HIGH" ? "error" : priority === "LOW" ? "secondary" : "warning";
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Badge variant={variant as any} className="text-[10px]">
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "UNRESOLVED"
      ? "error"
      : status === "RESOLVED"
        ? "success"
        : status === "ARCHIVED"
          ? "secondary"
          : status === "ESCALATING"
            ? "warning"
            : "outline";
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}

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
      limit: PAGE_SIZE,
      page,
      search: search || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: status !== "all" ? (status as any) : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type !== "all" ? (type as any) : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sortBy: sortBy as any,
      sortOrder: "desc",
    },
    { enabled: !!projectId, refetchInterval: 10000 },
  );

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <Input
          size="sm"
          placeholder="Search errors..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
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
        <span className="ml-auto text-xs text-muted-foreground">{totalCount} errors</span>
      </div>

      <div className="flex-1 overflow-auto">
        <Table density="tight">
          <TableHeader sticky>
            <TableRow className="hover:bg-transparent">
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tool/Model</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Traces</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={8}>
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <AlertTriangle className="size-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    No errors yet. Errors from any observation with level=ERROR will appear here.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {items.map((issue) => (
              <TableRow
                key={issue.id}
                className="cursor-pointer"
                onClick={() => router.push(`/project/${projectId}/errors/${issue.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2 max-w-md">
                    <span className="size-1.5 rounded-full bg-error shrink-0" title={issue.level} />
                    <span className="truncate text-sm font-medium">{issue.title}</span>
                    <span className="text-xs text-muted-foreground truncate hidden md:inline">
                      · {issue.shortId}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                    <TypeIcon type={issue.type} />
                    {issue.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {issue.toolName ?? issue.culprit ?? "-"}
                </TableCell>
                <TableCell className="text-right font-mono">{issue.count}</TableCell>
                <TableCell className="text-right font-mono">{issue.traceCount}</TableCell>
                <TableCell>
                  <PriorityBadge priority={issue.priority} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={issue.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelativeTime(new Date(issue.lastSeen))}
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
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        label="errors"
      />
    </div>
  );
}
