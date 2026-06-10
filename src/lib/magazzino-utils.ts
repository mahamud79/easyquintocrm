// Pure helpers for Magazzino: decorrenza, rate pagate/residue, capitale residuo,
// data di rinnovabilità, giorni mancanti.
//
// Regole concordate:
//   - decorrenza = dataLiq + 1 mese (mese successivo alla liquidazione)
//   - rate pagate = mesi trascorsi da decorrenza a oggi (cap a durata)
//   - rate residue = durata - rate pagate
//   - capitale residuo = rata × rate residue (approssimazione lineare)
//   - mesi di rinnovabilità = durata × 0.40 − 3
//   - data rinnovabilità = decorrenza + mesiRinnovabilita (in mesi)
//   - flag "passa in Rinnovi": giorni mancanti ≤ 90 (≈ 3 mesi)

export function addMonths(iso: string, months: number): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const targetMonth = date.getMonth() + months;
  const target = new Date(date.getFullYear(), targetMonth, 1);
  // mantieni il giorno se valido, altrimenti ultimo giorno del mese
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return target;
}

export function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  let total = years * 12 + months;
  if (to.getDate() < from.getDate()) total -= 1;
  return total;
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

const MESI_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function fmtDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MESI_IT[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtMonthYear(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "—";
  return `${MESI_IT[d.getMonth()]} ${d.getFullYear()}`;
}

// Formatta una stringa "yyyy-MM" o "yyyy-MM-dd" come "mes yyyy" (es. "mar 2025")
export function fmtMonthYearString(s?: string | null): string {
  if (!s) return "—";
  const [y, m] = s.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return "—";
  return `${MESI_IT[m - 1]} ${y}`;
}

export type MagazzinoRow = {
  id: string;
  cognome: string;
  nome: string;
  telefono: string | null;
  prodotto: "CQS" | "Prestito" | "delega_pagamento" | "Mutuo";
  banca: string | null;
  rata: number;
  durata: number;
  decorrenza: Date | null;
  ratePagate: number;
  rateResidue: number;
  capitaleResiduo: number;
  dataRinnovabilita: Date | null;
  giorniAllaRinnovabilita: number;
  passaInRinnovi: boolean;
};

export type LiquidataLike = {
  id: string;
  cognome: string;
  nome: string;
  prodotto: "CQS" | "Prestito" | "delega_pagamento" | "Mutuo";
  banca: string | null;
  dataLiq: string;
  rata: number | null;
  durata: number | null;
};

export function computeMagazzinoRow(
  row: LiquidataLike,
  telefono: string | null = null,
  today: Date = new Date(),
): MagazzinoRow {
  const rata = row.rata ?? 0;
  const durata = row.durata ?? 0;
  const decorrenza = addMonths(row.dataLiq, 1);
  const mesiPassati = decorrenza ? Math.max(0, monthsBetween(decorrenza, today)) : 0;
  const ratePagate = Math.min(durata, mesiPassati);
  const rateResidue = Math.max(0, durata - ratePagate);
  const capitaleResiduo = rata * rateResidue;
  const mesiRinnovabilita = Math.floor(durata * 0.4 - 3);
  const dataRinnovabilita = decorrenza
    ? addMonths(decorrenza.toISOString().slice(0, 10), mesiRinnovabilita)
    : null;
  const giorniAllaRinnovabilita = dataRinnovabilita ? daysBetween(today, dataRinnovabilita) : 0;
  const passaInRinnovi = giorniAllaRinnovabilita <= 90;
  return {
    id: row.id,
    cognome: row.cognome,
    nome: row.nome,
    telefono,
    prodotto: row.prodotto,
    banca: row.banca,
    rata,
    durata,
    decorrenza,
    ratePagate,
    rateResidue,
    capitaleResiduo,
    dataRinnovabilita,
    giorniAllaRinnovabilita,
    passaInRinnovi,
  };
}