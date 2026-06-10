import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import { parseItNumber } from "./format-eur";
import {
  cloudBulkUpsert,
  cloudDelete,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type LiquidataRow = {
  id: string;
  cognome: string;
  nome: string;
  prodotto: "CQS" | "Prestito" | "delega_pagamento" | "Mutuo";
  banca: string | null;
  dataLiq: string; // ISO yyyy-mm-dd
  rata: number | null;
  durata: number | null;
  netto: number | null;
  provvigione: number;
};

export const liquidataMontanteLordo = (row: Pick<LiquidataRow, "rata" | "durata" | "netto">) => {
  const rata = parseItNumber(row.rata) ?? 0;
  const durata = parseItNumber(row.durata) ?? 0;
  const montante = Number.isFinite(rata) && Number.isFinite(durata) ? rata * durata : 0;
  return montante || parseItNumber(row.netto) || 0;
};

const DEMO_LIQUIDATO_IDS = new Set<string>([
  "l1",
  "l2",
  "l3",
  "l4",
  "l5",
  "l6",
  "l7",
  "l8",
  "l9",
  "l10",
  "l11",
  "l12"
]);

const PERSIST_KEY = "liquidato";
const cleanLiquidato = (rows: LiquidataRow[]) => rows.filter((row) => !DEMO_LIQUIDATO_IDS.has(row.id));
let state: { rows: LiquidataRow[] } = { rows: cleanLiquidato(loadPersisted<LiquidataRow[]>(PERSIST_KEY, [])) };
savePersisted(PERSIST_KEY, state.rows);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;
const emit = () => {
  savePersisted(PERSIST_KEY, state.rows);
  listeners.forEach((l) => l());
};

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    state = { rows: [] };
    savePersisted(PERSIST_KEY, state.rows);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<LiquidataRow>("liquidato");
  if (rows.length === 0 && state.rows.length > 0) {
    await cloudBulkUpsert("liquidato", state.rows);
  } else {
    state = { rows: rows.map((r) => ({ ...(r.data as LiquidataRow), id: r.id })) };
    savePersisted(PERSIST_KEY, state.rows);
    listeners.forEach((l) => l());
  }
});

const syncRow = (id: string) => {
  const r = state.rows.find((x) => x.id === id);
  if (r) void cloudUpsert("liquidato", r);
};

const setBanca = (id: string, banca: string) => {
  state = { rows: state.rows.map((r) => (r.id === id ? { ...r, banca: banca || null } : r)) };
  emit();
  syncRow(id);
};
const setDataLiq = (id: string, dataLiq: string) => {
  if (!dataLiq) return;
  state = { rows: state.rows.map((r) => (r.id === id ? { ...r, dataLiq } : r)) };
  emit();
  syncRow(id);
};
const setRata = (id: string, rata: number | null) => {
  state = { rows: state.rows.map((r) => (r.id === id ? { ...r, rata } : r)) };
  emit();
  syncRow(id);
};
const setDurata = (id: string, durata: number | null) => {
  state = { rows: state.rows.map((r) => (r.id === id ? { ...r, durata } : r)) };
  emit();
  syncRow(id);
};
const setNetto = (id: string, netto: number | null) => {
  state = { rows: state.rows.map((r) => (r.id === id ? { ...r, netto } : r)) };
  emit();
  syncRow(id);
};
const removeRow = (id: string) => {
  state = { rows: state.rows.filter((r) => r.id !== id) };
  emit();
  void cloudDelete("liquidato", id);
};
const addRow = (row: Omit<LiquidataRow, "id"> & { id?: string }) => {
  const id = row.id ?? `l-${Math.random().toString(36).slice(2, 9)}`;
  if (state.rows.some((r) => r.id === id)) return;
  const created = { ...row, id } as LiquidataRow;
  state = { rows: [created, ...state.rows] };
  emit();
  void cloudUpsert("liquidato", created);
};
const removeByPraticaId = (praticaId: string) => {
  const id = `liq-${praticaId}`;
  state = { rows: state.rows.filter((r) => r.id !== id) };
  emit();
  void cloudDelete("liquidato", id);
};

export const liquidatoActions = { addRow, removeRow, setBanca, setDataLiq, setRata, setDurata, setNetto, removeByPraticaId };

export function useLiquidatoStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { rows: snap.rows, setBanca, setDataLiq, setRata, setDurata, setNetto, removeRow };
}