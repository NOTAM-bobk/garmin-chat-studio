import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The connect action: an ink pill sitting on a blurred rainbow glow, so the one
 * button that opens Garmin reads as the primary action in a muted sidebar.
 */
export function GlowButton({
  children,
  onClick,
  fullWidth = false,
  className,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  fullWidth?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span className={cn("relative inline-flex", fullWidth && "w-full", className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 -bottom-1.5 h-4 rounded-full bg-[linear-gradient(90deg,#ff5c4d,#ffd66b,#8bff7a,#5cd0ff,#c98bff)] opacity-90 blur-[10px]"
      />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-[18px] bg-[#0d0d0f] font-medium text-white shadow-sm transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]",
          size === "sm" ? "px-4 py-2 text-[12.5px]" : "px-5 py-2.5 text-[13.5px]",
          fullWidth && "w-full",
        )}
      >
        {children}
      </button>
    </span>
  );
}
