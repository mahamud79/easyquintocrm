import { cn } from "@/lib/utils";
import logoAsset from "@/assets/easyquinto-logo.png.asset.json";

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
 * Kept as a separate export for API compatibility with existing call sites.
 */
export function LogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <img
      src={logoAsset.url}
      alt="EasyQuinto"
      className={cn("w-auto select-none object-contain mix-blend-multiply", MARK_HEIGHTS[size])}
      draggable={false}
    />
  );
}

/**
 * Wordmark renders the full horizontal EasyQuinto logo (icon + text).
 * The `className` is forwarded so callers can control the rendered height
 * via text-size utilities (e.g. text-2xl, text-4xl) which we translate
 * into image heights below.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
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
      src={logoAsset.url}
      alt="EasyQuinto"
      className={cn("w-auto select-none object-contain mix-blend-multiply", FULL_HEIGHTS[size])}
      draggable={false}
    />
  );
}
