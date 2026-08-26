"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatRelativeTime, SECTION_LABEL } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { PriorityBadge, StatusBadge, priorityVariant, statusVariant } from "@/lib/error-config";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { PageLoader } from "@/components/ui/spinner";

export default function ErrorDetailPage() {
  const params = useParams<{ projectId: string; issueId: string }>();
  const projectIdParam = params.projectId;
  const issueId = params.issueId;
  const router = useRouter();
  const projectId = useProjectStore((s) => s.projectId) ?? projectIdParam;
  const [eventsPage, setEventsPage] = useState(1);
  const eventsPageSize = PAGE_SIZE.ERROR_EVENTS;

  const {
    data: issue,
    isLoading,
    refetch,
  } = trpc.errors.byId.useQuery(
    { projectId: projectId!, id: issueId },
    { enabled: !!projectId && !!issueId },
  );

  const { data: eventsData } = trpc.errors.events.useQuery(
    { projectId: projectId!, issueId, limit: eventsPageSize, page: eventsPage },
    { enabled: !!projectId && !!issueId },
  );

  const updateMutation = trpc.errors.update.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return <PageLoader message="Loading issue..." />;
  }

  if (!issue) {
    return <div className="p-6 text-sm text-muted-foreground">Error not found.</div>;
  }

  const events = eventsData?.items ?? [];
  const totalPages = eventsData?.totalPages ?? 1;
  const totalCount = eventsData?.totalCount ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 -ml-2"
          onClick={() => router.push(`/project/${projectId}/errors`)}
        >
          <ArrowLeft className="size-3.5" /> Back to Errors
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
              <span className="size-2 rounded-full bg-error shrink-0" />
              <span className="break-words">{issue.title}</span>
              <Badge variant="outline" className="font-mono">
                {issue.shortId}
              </Badge>
            </h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="font-mono">
                {issue.type}
              </Badge>
              {issue.toolName && (
                <Badge variant="outline" className="font-mono">
                  {issue.toolName}
                </Badge>
              )}
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
              <span className="text-muted-foreground">
                {issue.count} events · {issue.traceCount} traces · {issue.userCount} users
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              First seen {formatRelativeTime(new Date(issue.firstSeen))} · Last seen{" "}
              {formatRelativeTime(new Date(issue.lastSeen))}
              {issue.culprit && (
                <>
                  {" "}
                  · Culprit: <span className="font-mono text-foreground">{issue.culprit}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Select
              value={issue.status}
              onValueChange={(v) =>
                v &&
                updateMutation.mutate({
                  projectId: projectId!,
                  id: issue.id,
                  status: v as typeof issue.status,
                })
              }
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
                <SelectItem value="ESCALATING">Escalating</SelectItem>
                <SelectItem value="REGRESSED">Regressed</SelectItem>
                <SelectItem value="FOR_REVIEW">For Review</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={issue.priority}
              onValueChange={(v) =>
                v &&
                updateMutation.mutate({
                  projectId: projectId!,
                  id: issue.id,
                  priority: v as typeof issue.priority,
                })
              }
            >
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Fingerprint:</span>{" "}
            <span className="font-mono">{issue.fingerprint.slice(0, 12)}…</span>{" "}
            <CopyButton text={issue.fingerprint} />
          </div>
          <div>
            <span className="text-muted-foreground">Level:</span> {issue.level}
          </div>
          <div>
            <span className="text-muted-foreground">Traces:</span> {issue.traceCount}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main: events */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table density="tight">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Trace</TableHead>
                    <TableHead>Error Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Observation</TableHead>
                    <TableHead className="w-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8 text-sm"
                      >
                        No events
                      </TableCell>
                    </TableRow>
                  )}
                  {events.map((ev: Record<string, unknown>) => {
                    const e = ev as unknown as {
                      id: string;
                      traceId: string;
                      timestamp: string | Date;
                      errorType: string | null;
                      errorValue: string | null;
                      observationId: string;
                      observation?: { statusMessage?: string | null };
                    };
                    return (
                      <TableRow
                        key={e.id}
                        className="cursor-pointer group/row hover:bg-accent/50"
                        onClick={() =>
                          router.push(
                            `/project/${projectId}/traces/${e.traceId}?observationId=${encodeURIComponent(e.observationId)}`,
                          )
                        }
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatRelativeTime(new Date(e.timestamp))}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.traceId.slice(0, 8)}</TableCell>
                        <TableCell className="font-mono text-xs">{e.errorType ?? "-"}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs">
                          {e.errorValue ?? e.observation?.statusMessage ?? "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {e.observationId.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="size-3 text-muted-foreground/0 group-hover/row:text-muted-foreground transition-colors" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="border-t border-border">
                  <PaginationBar
                    page={eventsPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={eventsPageSize}
                    onPageChange={setEventsPage}
                    label="events"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {issue.recentEvents && issue.recentEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Context — Recent Observations in Last Trace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {issue.recentEvents.slice(0, 3).map((ev: Record<string, unknown>) => {
                  const e = ev as unknown as {
                    id: string;
                    observationId: string;
                    timestamp: string | Date;
                    traceId: string;
                    stacktrace: string | null;
                    tags: unknown;
                  };
                  return (
                    <div
                      key={e.id}
                      className="rounded-md border border-border bg-muted/20 p-3 text-xs"
                    >
                      <div className="font-mono flex justify-between gap-2">
                        <span>{e.observationId.slice(0, 8)}</span>
                        <span className="text-muted-foreground">
                          {new Date(e.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        Trace: <span className="font-mono">{e.traceId.slice(0, 8)}</span> →{" "}
                        <a
                          className="text-primary hover:underline"
                          href={`/project/${projectId}/traces/${e.traceId}?observationId=${encodeURIComponent(e.observationId)}`}
                          onClick={(ev) => {
                            ev.preventDefault();
                            router.push(
                              `/project/${projectId}/traces/${e.traceId}?observationId=${encodeURIComponent(e.observationId)}`,
                            );
                          }}
                        >
                          view trace
                        </a>
                      </div>
                      {e.stacktrace && (
                        <pre className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono bg-card p-2 rounded border border-border max-h-32 overflow-auto max-w-full">
                          {e.stacktrace}
                        </pre>
                      )}
                      {e.tags != null && (
                        <div className="mt-1 text-muted-foreground break-words [overflow-wrap:anywhere]">
                          Tags:{" "}
                          <span className="font-mono">{JSON.stringify(e.tags as unknown)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 shrink-0 border-l border-border bg-card p-4 space-y-4 overflow-auto hidden md:block">
          <div className="space-y-2">
            <h3 className={SECTION_LABEL}>DETAILS</h3>
            <div className="text-xs space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">First Seen</span>
                <span>{new Date(issue.firstSeen).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Last Seen</span>
                <span>{new Date(issue.lastSeen).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">First Trace</span>
                <a
                  className="font-mono text-primary hover:underline"
                  href={`/project/${projectId}/traces/${issue.firstTraceId}`}
                >
                  {issue.firstTraceId?.slice(0, 8) ?? "-"}
                </a>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Last Trace</span>
                <a
                  className="font-mono text-primary hover:underline"
                  href={`/project/${projectId}/traces/${issue.lastTraceId}`}
                >
                  {issue.lastTraceId?.slice(0, 8) ?? "-"}
                </a>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Events</span>
                <span>{issue.count}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Traces</span>
                <span>{issue.traceCount}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className={SECTION_LABEL}>STACKTRACE / ERROR</h3>
            {(() => {
              const first = events[0] as unknown as
                | {
                    stacktrace?: string | null;
                    observation?: { errorStacktrace?: string | null };
                  }
                | undefined;
              const fallbackStacktrace =
                (issue.recentEvents?.[0] as unknown as { stacktrace?: string | null })
                  ?.stacktrace ?? null;
              const displayStacktrace =
                first?.stacktrace ?? first?.observation?.errorStacktrace ?? fallbackStacktrace;
              return displayStacktrace ? (
                <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono text-xs bg-muted p-2.5 rounded-md border border-border max-h-64 overflow-auto leading-relaxed">
                  {displayStacktrace}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No stacktrace. SDK will send stacktrace after instrumentation (phase 1b).
                </p>
              );
            })()}
          </div>
          <div className="space-y-2">
            <h3 className={SECTION_LABEL}>TAGS</h3>
            <div className="text-xs space-y-1">
              <div>
                Type:{" "}
                <Badge variant="secondary" className="font-mono">
                  {issue.type}
                </Badge>
              </div>
              {issue.toolName && (
                <div className="break-words [overflow-wrap:anywhere]">
                  Tool: <span className="font-mono">{issue.toolName}</span>
                </div>
              )}
              <div>Level: {issue.level}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
