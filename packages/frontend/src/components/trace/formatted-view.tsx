"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, Shield, User, Bot, Wrench, MessageSquare } from "lucide-react";
import { MemoizedMarkdown } from "./memoized-markdown";
import { CopyButton } from "@/components/ui/copy-button";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";

// --- Role Normalization ---

const ROLE_ALIASES: Record<string, string> = {
  human: "user",
  ai: "assistant",
};

function normalizeRole(role: string): string {
  return ROLE_ALIASES[role] ?? role;
}

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

interface ImageBlock {
  url: string;
  alt?: string;
}

interface ExtractedContent {
  texts: string[];
  thinkings: string[];
  toolUses: NormalizedToolCall[];
  images: ImageBlock[];
}

function extractContent(content: ChatMessage["content"]): ExtractedContent {
  const result: ExtractedContent = { texts: [], thinkings: [], toolUses: [], images: [] };

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
          if (b.image_url?.url) {
            result.images.push({ url: b.image_url.url });
          }
          break;
        case "image":
          if (b.source?.type === "base64" && b.source.data && b.source.media_type) {
            result.images.push({ url: `data:${b.source.media_type};base64,${b.source.data}` });
          } else if (b.source?.url) {
            result.images.push({ url: b.source.url });
          }
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

// --- Role Icons & Colors ---

function getRoleIcon(role: string) {
  switch (normalizeRole(role)) {
    case "system":
      return Shield;
    case "user":
      return User;
    case "assistant":
      return Bot;
    case "tool":
      return Wrench;
    default:
      return MessageSquare;
  }
}

function getRoleDisplayName(role: string): string {
  const n = normalizeRole(role);
  switch (n) {
    case "assistant":
      return "AI";
    case "system":
      return "System";
    case "user":
      return "User";
    case "tool":
      return "Tool";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

function getRoleColor(role: string): string {
  switch (normalizeRole(role)) {
    case "system":
      return "text-chart-3";
    case "user":
      return "text-chart-1";
    case "assistant":
      return "text-chart-2";
    case "tool":
      return "text-chart-5";
    default:
      return "text-muted-foreground";
  }
}

// --- Preview text for collapsed messages ---

function getPreviewText(extracted: ExtractedContent, allToolCalls: NormalizedToolCall[]): string {
  const text = extracted.texts.join(" ").replace(/\n+/g, " ").trim();
  if (text.length > 0) {
    return text.length > 120 ? text.slice(0, 120) + "\u2026" : text;
  }
  if (extracted.thinkings.length > 0) {
    const t = extracted.thinkings[0].replace(/\n+/g, " ").trim();
    return `[thinking] ${t.length > 100 ? t.slice(0, 100) + "\u2026" : t}`;
  }
  if (allToolCalls.length > 0) {
    return `[${allToolCalls.map((tc) => tc.name).join(", ")}]`;
  }
  return "[empty]";
}

// --- Inline Copy Button ---

// --- Components ---

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

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const firstLine = text.split("\n")[0].trim();
  const preview = firstLine.length > 100 ? firstLine.slice(0, 100) + "\u2026" : firstLine;

  return (
    <div className="rounded-r-md border-l-2 border-warning/30 bg-warning/5 px-3 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 w-full text-left"
      >
        <span className="text-xs font-medium text-warning">Thinking</span>
        <ChevronIcon expanded={open} />
        {!open && <span className="text-xs text-muted-foreground truncate ml-1">{preview}</span>}
      </button>
      {open && (
        <div className="mt-2">
          <MemoizedMarkdown text={text} className="text-sm text-foreground" />
        </div>
      )}
    </div>
  );
}

function ChatMessageView({
  message,
  toolCallMap,
  toolResults,
  forceExpanded,
  renderMode,
}: {
  message: ChatMessage;
  toolCallMap: Map<string, string>;
  toolResults?: Map<string, ChatMessage>;
  forceExpanded?: boolean | null;
  renderMode: "markdown" | "plain";
}) {
  const extracted = extractContent(message.content);
  const nRole = normalizeRole(message.role);
  const allToolCalls = normalizeToolCalls(message.tool_calls, extracted.toolUses);
  const textContent = extracted.texts.join("\n");

  // Build label: for tool results, show the tool name from the mapping
  const displayName = getRoleDisplayName(message.role);
  let label = message.name ? `${displayName} (${message.name})` : displayName;
  if (message.role === "tool" && message.tool_call_id) {
    const toolName = toolCallMap.get(message.tool_call_id);
    if (toolName) label = `Tool (${toolName})`;
  }

  const preview = getPreviewText(extracted, allToolCalls);
  const [expanded, setExpanded] = useState(forceExpanded ?? false);

  const RoleIcon = getRoleIcon(message.role);
  const roleColor = getRoleColor(message.role);

  // Get raw content for copy
  const rawContent =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content, null, 2);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <RoleIcon className={cn("size-4 shrink-0", roleColor)} />
        <span className="text-xs font-medium shrink-0">{label}</span>
        {!expanded && (
          <span className="text-xs text-muted-foreground truncate min-w-0">{preview}</span>
        )}
        {!expanded && rawContent && (
          <CopyButton
            text={rawContent}
            className="ml-auto text-muted-foreground hover:text-foreground"
          />
        )}
      </button>
      {expanded && (
        <div className="px-4 pt-1 pb-4 space-y-2">
          {/* Thinking/reasoning */}
          {extracted.thinkings.length > 0 && (
            <ThinkingBlock text={extracted.thinkings.join("\n\n")} />
          )}

          {/* Text content */}
          {textContent.length > 0 &&
            (renderMode === "markdown" ? (
              <MemoizedMarkdown text={textContent} className="text-sm" />
            ) : (
              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed font-mono">
                {textContent}
              </div>
            ))}

          {/* Images */}
          {extracted.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extracted.images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.alt ?? "Image"}
                  className="max-w-[400px] max-h-[300px] rounded-md border border-border object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          )}

          {/* Tool calls (with grouped results) */}
          {allToolCalls.length > 0 && (
            <div className="space-y-1.5">
              {allToolCalls.map((tc, i) => {
                const resultMsg = tc.id ? toolResults?.get(tc.id) : undefined;
                return <ToolCallWithResult key={tc.id ?? i} tc={tc} resultMessage={resultMsg} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallWithResult({
  tc,
  resultMessage,
}: {
  tc: NormalizedToolCall;
  resultMessage?: ChatMessage;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasArgs =
    tc.args != null &&
    typeof tc.args === "object" &&
    Object.keys(tc.args as Record<string, unknown>).length > 0;
  const argsEntries = hasArgs ? Object.entries(tc.args as Record<string, unknown>) : [];
  const argsPreview = hasArgs
    ? argsEntries.map(([k]) => k).join(", ")
    : typeof tc.args === "string"
      ? (tc.args as string).slice(0, 80)
      : "";

  const resultContent = resultMessage
    ? typeof resultMessage.content === "string"
      ? resultMessage.content
      : JSON.stringify(resultMessage.content, null, 2)
    : null;

  return (
    <div className="rounded-md border border-border/60 px-3 py-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="inline-flex items-center gap-1.5 w-full text-left"
      >
        <Wrench className="size-3 text-chart-5 shrink-0" />
        <ChevronIcon expanded={expanded} />
        <span className="text-xs font-medium font-mono">{tc.name}</span>
        {!expanded && argsPreview && (
          <span className="text-xs text-muted-foreground truncate ml-1">({argsPreview})</span>
        )}
        {tc.id && (
          <span className="text-xs text-muted-foreground ml-auto font-mono shrink-0">
            {tc.id.slice(0, 8)}
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-2">
          {hasArgs && (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <tbody>
                  {argsEntries.map(([key, value]) => (
                    <TreeRow
                      key={key}
                      label={key}
                      value={value}
                      depth={0}
                      defaultExpanded={false}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!hasArgs && typeof tc.args === "string" && (
            <pre className="text-xs text-foreground overflow-auto whitespace-pre-wrap">
              {tc.args}
            </pre>
          )}
          {resultContent && (
            <div className="border-t border-border/50 pt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Result
                </span>
                <CopyButton
                  text={resultContent}
                  className="text-muted-foreground hover:text-foreground"
                />
              </div>
              <div className="mt-1 text-xs whitespace-pre-wrap break-words text-foreground max-h-[200px] overflow-auto">
                {resultContent}
              </div>
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

function ChatMLView({
  messages,
  calledToolNames,
}: {
  messages: ChatMessage[];
  calledToolNames?: Set<string>;
}) {
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);
  const [expandGen, setExpandGen] = useState(0);
  const [renderMode, setRenderMode] = useState<"markdown" | "plain">("markdown");

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

  // Group tool results with their tool calls and partition tool definitions
  const { displayMessages, toolResultMap, toolDefs } = useMemo(() => {
    const display: ChatMessage[] = [];
    const resultMap = new Map<string, ChatMessage>();
    const defs: ChatMessage[] = [];
    const consumed = new Set<number>();

    for (let i = 0; i < messages.length; i++) {
      if (consumed.has(i)) continue;
      const msg = messages[i];

      if (isToolDefinitionMessage(msg)) {
        defs.push(msg);
        continue;
      }

      // If this is an assistant/ai message with tool_calls, collect following tool results
      const nRole = normalizeRole(msg.role);
      const allCalls = normalizeToolCalls(msg.tool_calls, extractContent(msg.content).toolUses);
      if (nRole === "assistant" && allCalls.length > 0) {
        const callIds = new Set(allCalls.map((tc) => tc.id).filter(Boolean));
        // Look ahead for tool result messages
        let j = i + 1;
        while (j < messages.length && messages[j].role === "tool" && messages[j].tool_call_id) {
          const toolMsg = messages[j];
          if (toolMsg.tool_call_id && callIds.has(toolMsg.tool_call_id)) {
            resultMap.set(toolMsg.tool_call_id, toolMsg);
            consumed.add(j);
          } else {
            break;
          }
          j++;
        }
      }

      display.push(msg);
    }

    return { displayMessages: display, toolResultMap: resultMap, toolDefs: defs };
  }, [messages]);

  return (
    <div className="space-y-3">
      {/* Messages header: label + expand/collapse + render mode */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Messages
          </h3>
          {displayMessages.length > 2 && (
            <>
              <button
                onClick={() => {
                  setForceExpanded(true);
                  setExpandGen((g) => g + 1);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Expand all
              </button>
              <button
                onClick={() => {
                  setForceExpanded(false);
                  setExpandGen((g) => g + 1);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Collapse all
              </button>
            </>
          )}
        </div>
        <SegmentedToggle
          value={renderMode}
          onChange={setRenderMode}
          options={[
            { value: "markdown", label: "Markdown" },
            { value: "plain", label: "Plain" },
          ]}
        />
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {displayMessages.map((msg, i) => (
          <ChatMessageView
            key={`${expandGen}-${i}`}
            message={msg}
            toolCallMap={toolCallMap}
            toolResults={toolResultMap}
            forceExpanded={forceExpanded}
            renderMode={renderMode}
          />
        ))}
      </div>

      {/* Tool Definitions (separate section) */}
      {toolDefs.length > 0 && (
        <ToolsSection
          tools={toolDefs.map((msg) => msg.content as Record<string, unknown>)}
          calledToolNames={calledToolNames}
        />
      )}
    </div>
  );
}

function ToolsSection({
  tools,
  calledToolNames,
}: {
  tools: Record<string, unknown>[];
  calledToolNames?: Set<string>;
}) {
  const [showAll, setShowAll] = useState(false);
  const initialCount = 3;
  const hasMore = tools.length > initialCount;
  const visibleTools = showAll ? tools : tools.slice(0, initialCount);

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Tools
        </h3>
        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {tools.length}
        </span>
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {visibleTools.map((tool, i) => {
          const funcObj = tool.function as Record<string, unknown> | undefined;
          const name = (funcObj?.name as string) ?? "function";
          return <ToolCard key={i} toolDef={tool} isCalled={calledToolNames?.has(name)} />;
        })}
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full px-3 py-2 text-xs text-chart-1 hover:text-chart-1/80 text-left flex items-center gap-1"
          >
            {tools.length - initialCount} other tools
            <ChevronRight className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function ToolCard({ toolDef, isCalled }: { toolDef: Record<string, unknown>; isCalled?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const funcObj = toolDef.function as Record<string, unknown> | undefined;
  const name = (funcObj?.name as string) ?? "function";
  const desc = (funcObj?.description as string) ?? "";
  const params = funcObj?.parameters as Record<string, unknown> | undefined;
  const properties = (params?.properties as Record<string, Record<string, unknown>>) ?? {};
  const required = (params?.required as string[]) ?? [];
  const paramEntries = Object.entries(properties);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <Wrench className="size-3.5 text-chart-5 shrink-0" />
        <code className="text-xs font-medium">{name}</code>
        {isCalled && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-chart-2/15 text-chart-2">
            Called
          </span>
        )}
        <CopyButton
          text={JSON.stringify(toolDef, null, 2)}
          className="ml-auto text-muted-foreground hover:text-foreground"
        />
      </button>
      {expanded && (
        <div className="px-3 pt-1 pb-4 space-y-3">
          {desc && (
            <div className="space-y-1">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </h4>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{desc}</p>
            </div>
          )}
          {paramEntries.length > 0 ? (
            <div className="space-y-1">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Parameters
              </h4>
              <div className="overflow-auto rounded border border-border/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paramEntries.map(([pName, prop]) => {
                      const propType = resolveParamType(prop);
                      const propDesc = (prop.description as string) ?? "";
                      const isRequired = required.includes(pName);
                      const defaultVal = prop.default;
                      return (
                        <tr key={pName} className="border-b border-border/30 last:border-0">
                          <td className="py-1 px-2 whitespace-nowrap align-top">
                            <code className="text-foreground">{pName}</code>
                            {isRequired && (
                              <span className="text-red-400 ml-0.5" title="required">
                                *
                              </span>
                            )}
                          </td>
                          <td className="py-1 px-2 text-muted-foreground whitespace-nowrap align-top">
                            <span className="text-blue-400/80">{propType}</span>
                            {defaultVal !== undefined && defaultVal !== null && (
                              <span className="text-muted-foreground ml-1">
                                = {JSON.stringify(defaultVal)}
                              </span>
                            )}
                          </td>
                          <td className="py-1 px-2 text-muted-foreground align-top">{propDesc}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <code className="text-xs text-muted-foreground">{"{}"}</code>
          )}
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function tryParseJson(str: string): unknown | undefined {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

function hasMarkdownSyntax(str: string): boolean {
  return /^#{1,6}\s|\*\*|^- |\n#{1,6}\s|\n- |\n\|/m.test(str);
}

// --- Nested Path/Value Table ---

function isExpandable(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function ValueCell({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"formatted" | "plain">("formatted");

  if (value === null) return <span className="text-syntax-null">null</span>;
  if (value === undefined) return <span className="text-muted-foreground">undefined</span>;
  if (typeof value === "boolean")
    return <span className="text-syntax-boolean">{value.toString()}</span>;
  if (typeof value === "number") return <span className="text-syntax-number">{value}</span>;

  const str = typeof value === "string" ? value : JSON.stringify(value);
  const isMarkdown = str.length > 100 && hasMarkdownSyntax(str);

  if (str.length <= 200 && !isMarkdown) {
    return <span className="text-foreground break-all">{str}</span>;
  }

  if (isMarkdown) {
    return (
      <div className="space-y-1">
        <SegmentedToggle
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: "formatted", label: "Formatted" },
            { value: "plain", label: "Plain" },
          ]}
          size="xs"
        />
        {viewMode === "formatted" ? (
          <MemoizedMarkdown text={str} className="text-sm" />
        ) : (
          <div className="text-sm text-foreground whitespace-pre-wrap break-words">{str}</div>
        )}
      </div>
    );
  }

  return (
    <span className="text-foreground break-all">
      {expanded ? str : str.slice(0, 200)}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-xs text-syntax-number hover:underline"
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

  // Detect JSON encoded in string values
  const parsedFromString =
    !expandable && typeof value === "string" && value.length > 2 ? tryParseJson(value) : undefined;
  const parsedExpandable =
    parsedFromString !== undefined &&
    typeof parsedFromString === "object" &&
    parsedFromString !== null;

  const canExpand = expandable || parsedExpandable;
  const effectiveValue = parsedExpandable ? parsedFromString : value;

  const [expanded, setExpanded] = useState(defaultExpanded);

  const typeHint = canExpand
    ? Array.isArray(effectiveValue)
      ? `[${effectiveValue.length}]`
      : `{${Object.keys(effectiveValue as Record<string, unknown>).length}}`
    : null;

  const entries =
    canExpand && expanded
      ? Array.isArray(effectiveValue)
        ? effectiveValue.map((v, i) => [String(i), v] as const)
        : Object.entries(effectiveValue as Record<string, unknown>)
      : [];

  return (
    <>
      <tr className="border-b border-border/50 last:border-0">
        <td
          className="py-1.5 pr-3 font-mono text-muted-foreground align-top whitespace-nowrap"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <span className="inline-flex items-center gap-1">
            {canExpand ? (
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
          {canExpand ? (
            <span className="text-muted-foreground">
              {typeHint}
              {parsedExpandable && (
                <span className="text-xs text-muted-foreground ml-1 italic">json string</span>
              )}
            </span>
          ) : (
            <ValueCell value={value} />
          )}
        </td>
      </tr>
      {canExpand &&
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

// --- LLM Input/Output Detection ---

function detectLLMInput(data: unknown): {
  messages?: ChatMessage[];
  tools?: Record<string, unknown>[];
  remainder?: Record<string, unknown>;
} | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;

  // Unwrap double-nested messages: [[...msgs...]] → [...msgs...]
  // LangChain wraps messages in an extra array for GENERATION inputs
  let msgs = obj.messages;
  if (Array.isArray(msgs) && msgs.length === 1 && Array.isArray(msgs[0])) {
    msgs = msgs[0];
  }

  if (isChatML(msgs)) {
    const { messages: _messages, tools, functions, ...rest } = obj;
    // Normalize tools: accept both "tools" and "functions" keys
    const toolDefs = (tools ?? functions) as Record<string, unknown>[] | undefined;
    return {
      messages: msgs as ChatMessage[],
      tools: Array.isArray(toolDefs) && toolDefs.length > 0 ? toolDefs : undefined,
      remainder: Object.keys(rest).length > 0 ? rest : undefined,
    };
  }
  return null;
}

function detectLLMOutput(data: unknown): ChatMessage | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  // OpenAI ChatCompletion: { choices: [{ message: { role, content } }] }
  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const choice = obj.choices[0] as Record<string, unknown> | undefined;
    const msg = choice?.message;
    if (msg && typeof msg === "object" && "role" in (msg as Record<string, unknown>)) {
      return msg as ChatMessage;
    }
  }
  // Already a single message: { role, content }
  if ("role" in obj && ("content" in obj || "tool_calls" in obj)) {
    return obj as ChatMessage;
  }
  return null;
}

// --- Helper: extract called tool names from messages ---

function extractCalledToolNames(messages: ChatMessage[]): Set<string> {
  const names = new Set<string>();
  for (const msg of messages) {
    const calls = normalizeToolCalls(msg.tool_calls, extractContent(msg.content).toolUses);
    for (const tc of calls) names.add(tc.name);
  }
  return names;
}

// --- Main Component ---

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
  const detected = useMemo(() => {
    if (data === null || data === undefined) return { type: "null" as const };

    let normalized = normalizeData(data);

    if (typeof normalized === "string") return { type: "string" as const, value: normalized };

    // Unwrap single-element outer array: [[...messages...]] → [...messages...]
    if (Array.isArray(normalized) && normalized.length === 1 && Array.isArray(normalized[0])) {
      normalized = normalized[0];
    }

    if (isChatML(normalized)) {
      const calledNames = extractCalledToolNames(normalized);
      return { type: "chatml" as const, messages: normalized, calledNames };
    }

    if (
      typeof normalized === "object" &&
      normalized !== null &&
      !Array.isArray(normalized) &&
      "role" in normalized
    ) {
      return {
        type: "chatml" as const,
        messages: [normalized as ChatMessage],
        calledNames: new Set<string>(),
      };
    }

    const llmInput = detectLLMInput(normalized);
    if (llmInput?.messages) {
      const calledNames = extractCalledToolNames(llmInput.messages);
      return { type: "llm-input" as const, ...llmInput, calledNames };
    }

    const llmOutput = detectLLMOutput(normalized);
    if (llmOutput) return { type: "llm-output" as const, message: llmOutput };

    return { type: "generic" as const, value: normalized };
  }, [data]);

  switch (detected.type) {
    case "null":
      return <span className="text-muted-foreground italic text-sm">null</span>;
    case "string":
      return (
        <div className="overflow-auto text-sm whitespace-pre-wrap break-words">
          {detected.value}
        </div>
      );
    case "chatml":
      return <ChatMLView messages={detected.messages} calledToolNames={detected.calledNames} />;
    case "llm-input":
      return (
        <div className="space-y-3">
          <ChatMLView messages={detected.messages!} calledToolNames={detected.calledNames} />
          {detected.tools && (
            <ToolsSection tools={detected.tools} calledToolNames={detected.calledNames} />
          )}
          {detected.remainder && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                State
              </h3>
              <PathValueTable data={detected.remainder} />
            </div>
          )}
        </div>
      );
    case "llm-output":
      return <ChatMLView messages={[detected.message]} />;
    case "generic":
      return <PathValueTable data={detected.value} />;
  }
}
