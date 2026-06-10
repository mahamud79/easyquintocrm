import { cn } from "@/lib/utils";

const MARK_HEIGHTS: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-16",
};

const FULL_HEIGHTS: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "h-7",
  md: "h-9",
  lg: "h-12",
  xl: "h-16",
};

/**
 * LogoMark renders the full horizontal EasyQuinto logo at a compact height.
 */
export function LogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <img
      src="/easyquinto-logo.png"
      alt="EasyQuinto"
      className={cn("w-auto select-none object-contain mix-blend-multiply", MARK_HEIGHTS[size])}
      draggable={false}
    />
  );
}

/**
 * Wordmark renders the full horizontal EasyQuinto logo (icon + text).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src="/easyquinto-logo.png"
      alt="EasyQuinto"
      className={cn("w-auto select-none object-contain mix-blend-multiply", className ?? "h-9")}
      draggable={false}
    />
  );
}

export function Logo({
  size = "md",
  showText = true,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}) {
  if (!showText) {
    return <LogoMark size={size} />;
  }
  return (
    <img
      src="/easyquinto-logo.png"
      alt="EasyQuinto"
      className={cn("w-auto select-none object-contain mix-blend-multiply", FULL_HEIGHTS[size])}
      draggable={false}
    />
  );
}