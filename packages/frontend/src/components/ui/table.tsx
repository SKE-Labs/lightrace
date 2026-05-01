"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Density = "default" | "tight";

function Table({
  className,
  density = "default",
  ...props
}: React.ComponentProps<"table"> & { density?: Density }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        data-density={density}
        className={cn("group/table w-full caption-bottom text-xs", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className,
  sticky = false,
  ...props
}: React.ComponentProps<"thead"> & { sticky?: boolean }) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", sticky && "sticky top-0 z-10 bg-card", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/50 transition-colors duration-100 hover:bg-foreground/[0.03] has-aria-expanded:bg-foreground/[0.05] data-[state=selected]:bg-foreground/[0.05]",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-left align-middle whitespace-nowrap font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        // default density
        "h-10 px-3 text-xs",
        // tight density (group-data-[density=tight]/table)
        "group-data-[density=tight]/table:h-8 group-data-[density=tight]/table:px-3 group-data-[density=tight]/table:text-[11px] group-data-[density=tight]/table:uppercase group-data-[density=tight]/table:tracking-wider",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "align-middle whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        // default density
        "p-3",
        // tight density
        "group-data-[density=tight]/table:px-3 group-data-[density=tight]/table:py-2",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
