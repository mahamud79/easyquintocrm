// Italian Euro formatter that does NOT depend on ICU locale data
// (some Worker / SSR runtimes lack `it-IT` data, falling back to
// "1234.56" without thousands separator).

function formatThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseItNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value
    .replace(/€/g, "")
    .trim()
    .replace(/\s/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/\.(?=\d{3}(\D|$))/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Format a number using Italian conventions: `1.234,56` (no currency symbol). */
export function formatItNumber(
  n: number | string | null | undefined,
  opts: { minDecimals?: number; maxDecimals?: number } = {},
): string {
  const value = parseItNumber(n);
  if (value == null) return "—";
  const minDecimals = opts.minDecimals ?? 2;
  const maxDecimals = opts.maxDecimals ?? 2;
  const neg = value < 0;
  const abs = Math.abs(value);
  const fixed = abs.toFixed(maxDecimals);
  let [intPart, decPart = ""] = fixed.split(".");
  // Trim trailing zeros down to minDecimals
  while (decPart.length > minDecimals && decPart.endsWith("0")) {
    decPart = decPart.slice(0, -1);
  }
  const intFmt = formatThousands(intPart);
  const out = decPart ? `${intFmt},${decPart}` : intFmt;
  return neg ? `-${out}` : out;
}

/** Format as Italian Euro: `€ 1.234,56`. */
export function formatEuroIT(
  n: number | string | null | undefined,
  opts: { minDecimals?: number; maxDecimals?: number } = {},
): string {
  if (parseItNumber(n) == null) return "—";
  return `€ ${formatItNumber(n, opts)}`;
}

/** Format a percentage value using Italian conventions, e.g. `4,25%`. */
export function formatPctIT(
  n: number | string | null | undefined,
  opts: { maxDecimals?: number } = {},
): string {
  if (parseItNumber(n) == null) return "—";
  const maxDecimals = opts.maxDecimals ?? 2;
  return `${formatItNumber(n, { minDecimals: 0, maxDecimals })}%`;
}