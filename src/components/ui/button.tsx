import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition-[opacity,transform] duration-150 ease-out disabled:pointer-events-none disabled:border-line disabled:bg-line disabled:text-muted disabled:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "sticker-shadow border-2 border-ink bg-accent font-extrabold text-accent-fg",
        ghost: "border-2 border-ink bg-surface font-bold text-fg hover:bg-cream",
        quiet: "bg-surface font-bold text-fg",
      },
      size: {
        md: "h-12 rounded-md px-4 text-base",
        lg: "h-14 rounded-lg px-5 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : type} {...props} />;
}
