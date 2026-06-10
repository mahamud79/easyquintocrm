// Italian comuni list derived from `codice-fiscale-js`.
// Each tuple is [code, provincia, name, active]. We expose only currently
// active comuni (active === 1) and skip foreign-country entries (provincia "EE").
// @ts-expect-error - sub-path of codice-fiscale-js has no type declarations
import { COMUNI as RAW } from "codice-fiscale-js/src/lista-comuni.js";

export type Comune = { name: string; provincia: string };

type RawRow = [string, string, string, number];

const ROWS = (RAW as RawRow[]).filter((r) => r[3] === 1 && r[1] !== "EE");

export const COMUNI_LIST: Comune[] = ROWS
  .map((r) => ({ name: titleCase(r[2]), provincia: r[1] }))
  .sort((a, b) => a.name.localeCompare(b.name, "it"));

const BY_NORMALIZED = new Map<string, Comune>();
for (const c of COMUNI_LIST) BY_NORMALIZED.set(normalize(c.name), c);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Look up a comune by name (case/accent-insensitive). */
export function findComune(name: string | null | undefined): Comune | null {
  if (!name) return null;
  return BY_NORMALIZED.get(normalize(name)) ?? null;
}