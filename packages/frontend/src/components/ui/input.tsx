import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, FORM_FIELD_BASE } from "@/lib/utils";

const inputVariants = cva(
  cn(
    FORM_FIELD_BASE,
    "w-full min-w-0 disabled:pointer-events-none placeholder:text-muted-foreground file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground",
  ),
  {
    variants: {
      size: {
        // Form fields: 36px / 14px (design spec: text-sm)
        default: "h-9 px-3 text-sm file:h-7 file:text-sm",
        // Toolbar / inline searches
        sm: "h-7 px-2 text-xs file:h-6 file:text-xs",
        xs: "h-6 px-2 text-xs file:h-5 file:text-xs",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

function Input({ className, type, size, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
