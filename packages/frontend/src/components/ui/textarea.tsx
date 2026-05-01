import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, FORM_FIELD_BASE } from "@/lib/utils";

const textareaVariants = cva(
  cn(FORM_FIELD_BASE, "flex field-sizing-content w-full placeholder:text-muted-foreground"),
  {
    variants: {
      size: {
        default: "min-h-16 px-3 py-2 text-[13px]",
        sm: "min-h-12 px-2 py-1.5 text-xs",
        xs: "min-h-9 px-2 py-1 text-[11px]",
      },
      resize: {
        none: "resize-none",
        vertical: "resize-y",
      },
    },
    defaultVariants: {
      size: "default",
      resize: "none",
    },
  },
);

type TextareaProps = Omit<React.ComponentProps<"textarea">, "size"> &
  VariantProps<typeof textareaVariants>;

function Textarea({ className, size, resize, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ size, resize }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
