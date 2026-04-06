"use client";

import { cn } from "@/lib/utils";
import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto -mx-1 px-1">
      <table {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th {...props} className="whitespace-nowrap">
      {children}
    </th>
  ),
  pre: ({ children, ...props }) => (
    <pre {...props} className="overflow-x-auto">
      {children}
    </pre>
  ),
};

export const MemoizedMarkdown = React.memo(
  ({ text, className }: { text: string; className?: string }) => (
    <div
      className={cn(
        "prose prose-sm prose-zinc dark:prose-invert max-w-none",
        "prose-h1:text-lg prose-h1:font-medium",
        "prose-h2:text-base prose-h2:font-medium",
        "prose-h3:text-sm prose-h3:font-medium",
        "prose-h4:text-sm prose-h4:font-medium",
        "prose-hr:my-4",
        "prose-table:w-full prose-table:rounded-lg prose-table:overflow-hidden prose-table:border prose-table:border-border prose-table:border-separate prose-table:border-spacing-0 prose-table:bg-background prose-table:my-2",
        "prose-thead:bg-accent",
        "prose-th:border-b prose-th:border-r prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-medium last:prose-th:border-r-0",
        "prose-td:border-b prose-td:border-r prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-xs last:prose-td:border-r-0",
        "prose-tr:last:prose-td:border-b-0",
        "prose-tr:even:bg-accent/40",
        "[&_td:first-child]:pl-4 [&_td:first-child]:font-medium",
        "[&_th:first-child]:pl-4",
        "prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground prose-blockquote:rounded-r-md prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-muted-foreground",
        "prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1",
        "prose-p:my-1.5",
        "prose-a:underline-offset-2",
        "prose-code:text-xs",
        "prose-pre:overflow-x-auto",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => {
    return prevProps.text === nextProps.text;
  },
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
