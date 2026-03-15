"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { MemoizedMarkdown } from "./MemoizedMarkdown";

interface FormattedViewProps {
  data: unknown;
}

// --- Types ---

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  reasoning?: string;
  id?: string;
  name?: string;
  input?: unknown;
  image_url?: { url: string };
  source?: { type: string; data?: string; url?: string; media_type?: string };
  [key: string]: unknown;
}

interface ToolCall {
  id?: string;
  name?: string;
  type?: string;
  args?: Record<string, unknown>;
  function?: { name?: string; arguments?: string };
}

interface ChatMessage {
  role: string;
  content?: string | ContentBlock[] | Record<string, unknown> | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  additional_kwargs?: Record<string, unknown>;
  [key: string]: unknown;
}

// --- Content Extraction ---

interface NormalizedToolCall {
  name: string;
  id?: string;
  args: unknown;
}

interface ExtractedContent {
  texts: string[];
  thinkings: string[];
  toolUses: NormalizedToolCall[];
}

function extractContent(content: ChatMessage["content"]): ExtractedContent {
  const result: ExtractedContent = { texts: [], thinkings: [], toolUses: [] };

  if (content == null) return result;

  if (typeof content === "string") {
    if (content.length > 0) result.texts.push(content);
    return result;
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "string") {
        result.texts.push(block);
        continue;
      }
      if (typeof block !== "object" || block === null) continue;

      const b = block as ContentBlock;
      switch (b.type) {
        case "text":
          if (b.text) result.texts.push(b.text);
          break;
        case "thinking":
          if (b.thinking) result.thinkings.push(b.thinking);
          break;
        case "reasoning":
          if (b.reasoning) result.thinkings.push(b.reasoning);
          break;
        case "tool_use":
          result.toolUses.push({
            name: b.name ?? "tool",
            id: b.id,
            args: b.input ?? {},
          });
          break;
        case "image_url":
          result.texts.push(`[Image: ${b.image_url?.url ?? "unknown"}]`);
          break;
        case "image":
          result.texts.push(`[Image: ${b.source?.url ?? b.source?.media_type ?? "base64"}]`);
          break;
        default:
          if (b.type) {
            // Strip noisy metadata fields from fallback display
            const { extras, index, ...rest } = b;
            result.texts.push(JSON.stringify(rest, null, 2));
          }
          break;
      }
    }
    return result;
  }

  // Non-array object (e.g., tool definition in tool role)
  result.texts.push(JSON.stringify(content, null, 2));
  return result;
}

function normalizeToolCalls(
  toolCalls?: ToolCall[],
  contentToolUses?: NormalizedToolCall[],
): NormalizedToolCall[] {
  const calls: NormalizedToolCall[] = [];

  if (toolCalls) {
    for (const tc of toolCalls) {
      if (tc.function) {
        let parsedArgs: unknown = {};
        if (tc.function.arguments) {
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = tc.function.arguments;
          }
        }
        calls.push({
          name: tc.function.name ?? "unknown",
          id: tc.id,
          args: parsedArgs,
        });
      } else if (tc.name) {
        calls.push({
          name: tc.name,
          id: tc.id,
          args: tc.args ?? {},
        });
      }
    }
  }

  if (contentToolUses) {
    calls.push(...contentToolUses);
  }

  return calls;
}

// --- ChatML Detection ---

function isChatML(data: unknown): data is ChatMessage[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((m) => typeof m === "object" && m !== null && "role" in m)
  );
}

// --- Preview text for collapsed messages ---

function getPreviewText(extracted: ExtractedContent, allToolCalls: NormalizedToolCall[]): string {
  const text = extracted.texts.join(" ").replace(/\n+/g, " ").trim();
  if (text.length > 0) {
    return text.length > 120 ? text.slice(0, 120) + "…" : text;
  }
  if (extracted.thinkings.length > 0) {
    const t = extracted.thinkings[0].replace(/\n+/g, " ").trim();
    return `[thinking] ${t.length > 100 ? t.slice(0, 100) + "…" : t}`;
  }
  if (allToolCalls.length > 0) {
    return `[${allToolCalls.map((tc) => tc.name).join(", ")}]`;
  }
  return "[empty]";
}

// --- Components ---

function ToolCallBlock({ tc }: { tc: NormalizedToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const hasArgs =
    tc.args != null &&
    typeof tc.args === "object" &&
    Object.keys(tc.args as Record<string, unknown>).length > 0;
  const argsEntries = hasArgs ? Object.entries(tc.args as Record<string, unknown>) : [];

  // Preview: show key names for collapsed view
  const argsPreview = hasArgs
    ? argsEntries.map(([k]) => k).join(", ")
    : typeof tc.args === "string"
      ? (tc.args as string).slice(0, 80)
      : "";

  return (
    <div className="rounded border border-border px-2.5 py-1.5">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="inline-flex items-center gap-1 w-full text-left"
      >
        <ChevronIcon expanded={expanded} />
        <span className="text-xs font-medium text-muted-foreground">{tc.name}</span>
        {!expanded && argsPreview && (
          <span className="text-[10px] text-muted-foreground/50 truncate ml-1">
            ({argsPreview})
          </span>
        )}
        {tc.id && (
          <span className="text-[10px] text-muted-foreground/50 ml-auto font-mono shrink-0">
            {tc.id.slice(0, 8)}
          </span>
        )}
      </button>
      {expanded && hasArgs && (
        <div className="mt-1.5 overflow-auto">
          <table className="w-full text-xs">
            <tbody>
              {argsEntries.map(([key, value]) => (
                <TreeRow key={key} label={key} value={value} depth={0} defaultExpanded={false} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {expanded && !hasArgs && typeof tc.args === "string" && (
        <pre className="mt-1.5 text-xs text-muted-foreground overflow-auto whitespace-pre-wrap">
          {tc.args}
        </pre>
      )}
    </div>
  );
}

function ToolDefinitionBlock({ content }: { content: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const funcObj = content.function as Record<string, unknown> | undefined;
  const funcName = (funcObj?.name as string) ?? "function";
  const funcDesc = (funcObj?.description as string) ?? "";
  const params = funcObj?.parameters as Record<string, unknown> | undefined;
  const properties = (params?.properties as Record<string, Record<string, unknown>>) ?? {};
  const required = (params?.required as string[]) ?? [];
  const paramEntries = Object.entries(properties);

  // Show first line of description as preview
  const descPreview = funcDesc.split("\n")[0];

  return (
    <div className="px-3 py-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="inline-flex items-center gap-1 text-left"
      >
        <ChevronIcon expanded={expanded} />
        <span className="text-xs font-medium text-muted-foreground">{funcName}</span>
        {!expanded && descPreview && (
          <span className="text-[10px] text-muted-foreground/50 ml-1 truncate max-w-[300px]">
            {descPreview}
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-2">
          {/* Description */}
          {funcDesc && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {funcDesc}
            </p>
          )}

          {/* Parameters table */}
          {paramEntries.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 pr-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="py-1 pr-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="py-1 pr-3 text-center font-medium text-muted-foreground">Req</th>
                    <th className="py-1 text-left font-medium text-muted-foreground">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paramEntries.map(([name, prop]) => {
                    const propType = resolveParamType(prop);
                    const propDesc = (prop.description as string) ?? "";
                    const isRequired = required.includes(name);
                    return (
                      <tr key={name} className="border-b border-border/50 last:border-0">
                        <td className="py-1 pr-3 font-mono text-foreground whitespace-nowrap">
                          {name}
                        </td>
                        <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">
                          {propType}
                        </td>
                        <td className="py-1 pr-3 text-center">
                          {isRequired && <span className="text-foreground">*</span>}
                        </td>
                        <td className="py-1 text-muted-foreground">{propDesc}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function resolveParamType(prop: Record<string, unknown>): string {
  if (prop.type) return prop.type as string;
  // Handle anyOf patterns (e.g., {anyOf: [{type: "string"}, {type: "null"}]})
  if (Array.isArray(prop.anyOf)) {
    const types = prop.anyOf.map((v: Record<string, unknown>) => v.type as string).filter(Boolean);
    return types.join(" | ");
  }
  if (Array.isArray(prop.enum)) {
    return prop.enum.map((v: unknown) => JSON.stringify(v)).join(" | ");
  }
  return "unknown";
}

function ChatMessageView({
  message,
  toolCallMap,
}: {
  message: ChatMessage;
  toolCallMap: Map<string, string>;
}) {
  const extracted = extractContent(message.content);
  const allToolCalls = normalizeToolCalls(message.tool_calls, extracted.toolUses);
  const textContent = extracted.texts.join("\n");

  // Build label: for tool results, show the tool name from the mapping
  let label = message.name ? `${message.role} (${message.name})` : message.role;
  if (message.role === "tool" && message.tool_call_id) {
    const toolName = toolCallMap.get(message.tool_call_id);
    if (toolName) label = `tool (${toolName})`;
  }

  const preview = getPreviewText(extracted, allToolCalls);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-3 py-2">
      {/* Collapsed: role badge + preview */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2 w-full text-left"
      >
        <ChevronIcon expanded={expanded} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          {label}
        </span>
        {!expanded && (
          <span className="text-xs text-muted-foreground/70 truncate min-w-0">{preview}</span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-2">
          {/* Thinking/reasoning */}
          {extracted.thinkings.length > 0 && (
            <div className="text-sm italic text-muted-foreground whitespace-pre-wrap break-words leading-relaxed pl-2 border-l-2 border-border">
              {extracted.thinkings.join("\n\n")}
            </div>
          )}

          {/* Text content */}
          {textContent.length > 0 &&
            (message.role === "assistant" || message.role === "system" ? (
              <MemoizedMarkdown text={textContent} className="text-sm" />
            ) : (
              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {textContent}
              </div>
            ))}

          {/* Tool calls */}
          {allToolCalls.length > 0 && (
            <div className="space-y-1.5">
              {allToolCalls.map((tc, i) => (
                <ToolCallBlock key={tc.id ?? i} tc={tc} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isToolDefinitionMessage(msg: ChatMessage): boolean {
  return (
    msg.role === "tool" &&
    msg.content != null &&
    typeof msg.content === "object" &&
    !Array.isArray(msg.content) &&
    "function" in (msg.content as Record<string, unknown>)
  );
}

function ChatMLView({ messages }: { messages: ChatMessage[] }) {
  // Build tool_call_id → tool_name mapping
  const toolCallMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          const name = tc.function?.name ?? tc.name;
          if (tc.id && name) map.set(tc.id, name);
        }
      }
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (typeof block === "object" && block !== null) {
            const b = block as ContentBlock;
            if (b.type === "tool_use" && b.id && b.name) {
              map.set(b.id, b.name);
            }
          }
        }
      }
    }
    return map;
  }, [messages]);

  // Partition: regular messages vs tool definitions
  const { regularMessages, toolDefs } = useMemo(() => {
    const regular: ChatMessage[] = [];
    const defs: ChatMessage[] = [];
    for (const m of messages) {
      (isToolDefinitionMessage(m) ? defs : regular).push(m);
    }
    return { regularMessages: regular, toolDefs: defs };
  }, [messages]);

  return (
    <div className="space-y-3">
      {/* Messages */}
      <div className="divide-y divide-border rounded-md border border-border">
        {regularMessages.map((msg, i) => (
          <ChatMessageView key={i} message={msg} toolCallMap={toolCallMap} />
        ))}
      </div>

      {/* Tool Definitions (separate section) */}
      {toolDefs.length > 0 && <ToolDefinitionsSection toolDefs={toolDefs} />}
    </div>
  );
}

function ToolDefinitionsSection({ toolDefs }: { toolDefs: ChatMessage[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1">
        <ChevronIcon expanded={open} />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tool Definitions ({toolDefs.length})
        </h3>
      </button>
      {open && (
        <div className="divide-y divide-border rounded-md border border-border">
          {toolDefs.map((msg, i) => {
            const content = msg.content as Record<string, unknown>;
            return <ToolDefinitionBlock key={i} content={content} />;
          })}
        </div>
      )}
    </div>
  );
}

// --- Nested Path/Value Table ---

function isExpandable(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function ValueCell({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);

  if (value === null) return <span className="text-orange-600 dark:text-orange-400">null</span>;
  if (value === undefined) return <span className="text-muted-foreground">undefined</span>;
  if (typeof value === "boolean")
    return <span className="text-amber-600 dark:text-amber-400">{value.toString()}</span>;
  if (typeof value === "number")
    return <span className="text-blue-600 dark:text-blue-400">{value}</span>;

  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str.length <= 200) {
    return <span className="text-foreground break-all">{str}</span>;
  }

  return (
    <span className="text-foreground break-all">
      {expanded ? str : str.slice(0, 200)}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {expanded ? "show less" : `...${str.length - 200} more`}
      </button>
    </span>
  );
}

function TreeRow({
  label,
  value,
  depth,
  defaultExpanded,
}: {
  label: string;
  value: unknown;
  depth: number;
  defaultExpanded: boolean;
}) {
  const expandable = isExpandable(value);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const typeHint = expandable
    ? Array.isArray(value)
      ? `[${value.length}]`
      : `{${Object.keys(value as Record<string, unknown>).length}}`
    : null;

  const entries =
    expandable && expanded
      ? Array.isArray(value)
        ? value.map((v, i) => [String(i), v] as const)
        : Object.entries(value as Record<string, unknown>)
      : [];

  return (
    <>
      <tr className="border-b border-border/50 last:border-0">
        <td
          className="py-1.5 pr-3 font-mono text-muted-foreground align-top whitespace-nowrap"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <span className="inline-flex items-center gap-1">
            {expandable ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronIcon expanded={expanded} />
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            {label}
          </span>
        </td>
        <td className="px-3 py-1.5 align-top">
          {expandable ? (
            <span className="text-muted-foreground">{typeHint}</span>
          ) : (
            <ValueCell value={value} />
          )}
        </td>
      </tr>
      {expandable &&
        expanded &&
        entries.map(([key, val]) => (
          <TreeRow key={key} label={key} value={val} depth={depth + 1} defaultExpanded={false} />
        ))}
    </>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <ChevronRight
      className={cn(
        "size-3.5 transition-transform text-muted-foreground shrink-0",
        expanded && "rotate-90",
      )}
    />
  );
}

function PathValueTable({ data }: { data: unknown }) {
  const entries = isExpandable(data)
    ? Array.isArray(data)
      ? data.map((v, i) => [String(i), v] as const)
      : Object.entries(data as Record<string, unknown>)
    : [["value", data] as const];

  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground w-[40%]">
              Path
            </th>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <TreeRow key={key} label={key} value={value} depth={0} defaultExpanded={false} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main Component ---

function tryParseJson(str: string): unknown | undefined {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

function normalizeData(data: unknown, depth = 0): unknown {
  if (typeof data !== "string" || depth > 3) return data;

  // Try standard JSON parse
  let parsed = tryParseJson(data);

  // Try Python-style dict: replace single-quoted keys/values at boundaries
  // Only attempt if it looks like a dict/list (starts with { or [)
  if (parsed === undefined && /^\s*[{\[]/.test(data)) {
    parsed = tryParseJson(data.replace(/'/g, '"'));
  }

  if (parsed === undefined) return data;

  // Handle double-encoded JSON strings
  if (typeof parsed === "string") {
    return normalizeData(parsed, depth + 1);
  }
  return parsed;
}

export function FormattedView({ data }: FormattedViewProps) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic text-sm">null</span>;
  }

  const normalized = normalizeData(data);

  // Plain string that isn't JSON
  if (typeof normalized === "string") {
    return (
      <div className="overflow-auto text-sm whitespace-pre-wrap break-words">{normalized}</div>
    );
  }

  // ChatML array
  if (isChatML(normalized)) {
    return <ChatMLView messages={normalized} />;
  }

  // Single ChatML message (not wrapped in array)
  if (
    typeof normalized === "object" &&
    normalized !== null &&
    !Array.isArray(normalized) &&
    "role" in normalized
  ) {
    return <ChatMLView messages={[normalized as ChatMessage]} />;
  }

  // Everything else: path/value table
  return <PathValueTable data={normalized} />;
}
