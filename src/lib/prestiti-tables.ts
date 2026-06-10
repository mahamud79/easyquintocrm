// Tabelle TAN / provvigione per banca + categoria lavoratore.
// Le percentuali sono indicative (replica visiva delle tabelle CREDITIS/PREXTA mostrate nella clip).

export type CategoriaLavoratore =
  | "Dipendente Privato"
  | "Statale / Pubblico / Pensionato"
  | "Lavoratore Autonomo";

export type TabellaTAN = {
  codice: string;
  tanMin: number;
  tanMax: number;
  provvPct: number;
};

export type Polizza = { codice: string; nome: string; costoPct: number };

export type BancaPrestito = {
  id: string;
  nome: string;
  durataMin: number;
  durataMax: number;
  polizze: Polizza[];
  tabelle: Record<CategoriaLavoratore, TabellaTAN[]>;
};

const CREDITIS_DP: TabellaTAN[] = [
  { codice: "FA", tanMin: 8.5, tanMax: 8.9, provvPct: 1.5 },
  { codice: "FB", tanMin: 8.7, tanMax: 9.1, provvPct: 2.2 },
  { codice: "FC", tanMin: 8.9, tanMax: 9.3, provvPct: 2.9 },
  { codice: "FD", tanMin: 9.1, tanMax: 9.5, provvPct: 3.6 },
  { codice: "FE", tanMin: 9.3, tanMax: 9.7, provvPct: 4.1 },
  { codice: "FF", tanMin: 9.5, tanMax: 9.9, provvPct: 4.5 },
  { codice: "FG", tanMin: 9.7, tanMax: 10.1, provvPct: 5.2 },
  { codice: "FH", tanMin: 9.9, tanMax: 10.3, provvPct: 5.7 },
  { codice: "FI", tanMin: 10.1, tanMax: 10.5, provvPct: 6.3 },
  { codice: "FJ", tanMin: 10.3, tanMax: 10.7, provvPct: 6.7 },
  { codice: "FK", tanMin: 10.5, tanMax: 10.9, provvPct: 7.2 },
  { codice: "FL", tanMin: 10.7, tanMax: 11.1, provvPct: 7.8 },
  { codice: "FM", tanMin: 10.9, tanMax: 11.3, provvPct: 8.4 },
  { codice: "FN", tanMin: 11.1, tanMax: 11.5, provvPct: 9.0 },
  { codice: "FO", tanMin: 11.5, tanMax: 11.9, provvPct: 10.3 },
  { codice: "FP", tanMin: 11.9, tanMax: 12.3, provvPct: 11.2 },
];

const CREDITIS_PUB: TabellaTAN[] = CREDITIS_DP.map((t) => ({
  ...t,
  tanMin: +(t.tanMin - 0.6).toFixed(2),
  tanMax: +(t.tanMax - 0.6).toFixed(2),
}));

const CREDITIS_AUT: TabellaTAN[] = CREDITIS_DP.map((t) => ({
  ...t,
  tanMin: +(t.tanMin + 1.2).toFixed(2),
  tanMax: +(t.tanMax + 1.2).toFixed(2),
  provvPct: +(t.provvPct * 0.7).toFixed(2),
}));

const PREXTA_DP: TabellaTAN[] = [
  { codice: "T1", tanMin: 9.2, tanMax: 9.6, provvPct: 2.5 },
  { codice: "T2", tanMin: 9.8, tanMax: 10.2, provvPct: 4.0 },
  { codice: "T3", tanMin: 10.4, tanMax: 10.9, provvPct: 5.5 },
  { codice: "T4", tanMin: 11.0, tanMax: 11.6, provvPct: 7.0 },
];
const PREXTA_PUB: TabellaTAN[] = PREXTA_DP.map((t) => ({ ...t, tanMin: +(t.tanMin - 0.5).toFixed(2), tanMax: +(t.tanMax - 0.5).toFixed(2) }));
const PREXTA_AUT: TabellaTAN[] = PREXTA_DP.map((t) => ({ ...t, tanMin: +(t.tanMin + 1).toFixed(2), tanMax: +(t.tanMax + 1).toFixed(2) }));

export const BANCHE_PRESTITI: BancaPrestito[] = [
  {
    id: "creditis",
    nome: "CREDITIS",
    durataMin: 24,
    durataMax: 120,
    polizze: [{ codice: "AXA", nome: "AXA", costoPct: 4.5 }],
    tabelle: {
      "Dipendente Privato": CREDITIS_DP,
      "Statale / Pubblico / Pensionato": CREDITIS_PUB,
      "Lavoratore Autonomo": CREDITIS_AUT,
    },
  },
  {
    id: "prexta",
    nome: "PREXTA",
    durataMin: 24,
    durataMax: 120,
    polizze: [],
    tabelle: {
      "Dipendente Privato": PREXTA_DP,
      "Statale / Pubblico / Pensionato": PREXTA_PUB,
      "Lavoratore Autonomo": PREXTA_AUT,
    },
  },
];

export const CATEGORIE_LAVORATORE: CategoriaLavoratore[] = [
  "Dipendente Privato",
  "Statale / Pubblico / Pensionato",
  "Lavoratore Autonomo",
];

// Rata francese (PMT)
export function calcRata(importo: number, tanAnnuo: number, mesi: number): number {
  if (importo <= 0 || mesi <= 0) return 0;
  const i = tanAnnuo / 100 / 12;
  if (i === 0) return importo / mesi;
  return (importo * i) / (1 - Math.pow(1 + i, -mesi));
}