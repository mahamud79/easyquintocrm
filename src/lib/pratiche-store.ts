import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import { liquidatoActions, type LiquidataRow } from "./liquidato-store";
import { parseItNumber } from "./format-eur";
import {
  cloudBulkUpsert,
  cloudDelete,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type PraticaStageKey =
  | "passate"
  | "attesa_doc"
  | "richiesto_cds"
  | "da_caricare"
  | "caricata"
  | "sospesa"
  | "respinta"
  | "deliberata"
  | "richiesta_polizza"
  | "polizza_emessa"
  | "erogato_anticipo"
  | "richiesto_ce"
  | "effettuata_estinzione"
  | "notificato_attesa_ben"
  | "liquidata";

export type PraticaStageDef = {
  key: PraticaStageKey;
  label: string;
  border: string;
};

export const PRATICA_STAGES: PraticaStageDef[] = [
  { key: "passate", label: "Passate", border: "border-t-slate-300" },
  { key: "attesa_doc", label: "Attesa Doc cliente", border: "border-t-amber-400" },
  { key: "richiesto_cds", label: "Richiesto CDS", border: "border-t-indigo-400" },
  { key: "da_caricare", label: "Da Caricare", border: "border-t-cyan-400" },
  { key: "caricata", label: "Caricata", border: "border-t-teal-400" },
  { key: "sospesa", label: "Sospesa", border: "border-t-yellow-400" },
  { key: "respinta", label: "Respinta", border: "border-t-red-500" },
  { key: "deliberata", label: "Deliberata", border: "border-t-emerald-500" },
  { key: "richiesta_polizza", label: "Richiesta Polizza", border: "border-t-violet-500" },
  { key: "polizza_emessa", label: "Polizza emessa", border: "border-t-teal-300" },
  { key: "erogato_anticipo", label: "Erogato Anticipo", border: "border-t-green-500" },
  { key: "richiesto_ce", label: "Richiesto C.E.", border: "border-t-orange-400" },
  { key: "effettuata_estinzione", label: "Effettuata Estinzione", border: "border-t-pink-400" },
  { key: "notificato_attesa_ben", label: "Notificato Attesa Ben", border: "border-t-blue-400" },
  { key: "liquidata", label: "Liquidata", border: "border-t-teal-500" },
];

export type PraticaTipo =
  | "CQS"
  | "DELEGA_PAGAMENTO"
  | "PRESTITO_PERSONALE"
  | "MUTUO";

export type PraticaPriorita = "bassa" | "media" | "alta" | null;

export type Pratica = {
  id: string;
  nomePratica: string;
  cliente: string;
  clienteId?: string | null;
  telefono: string | null;
  azienda: string | null;
  tipo: PraticaTipo;
  numeroPratica: string | null;
  importo: number;
  provvigione: number;
  stage: PraticaStageKey;
  priorita: PraticaPriorita;
  note: string;
  numeroPraticaBanca: string | null;
  compagniaAssicurativa: string | null;
  prodotto: string; // es: "Cessione del Quinto"
  banca?: string | null;
  durata?: number | null;
  rata?: number | null;
};

export const praticaMontanteLordo = (pratica: Pick<Pratica, "rata" | "durata">) => {
  const rata = parseItNumber(pratica.rata) ?? 0;
  const durata = parseItNumber(pratica.durata) ?? 0;
  return Number.isFinite(rata) && Number.isFinite(durata) ? rata * durata : 0;
};

const DEMO_PRATICA_IDS = new Set<string>([
  "p-001",
  "p-002",
  "p-003",
  "p-004",
  "p-005",
  "p-006",
  "p-007",
  "p-008",
  "p-009"
]);

const PERSIST_KEY = "pratiche";
const cleanPratiche = (items: Pratica[]) => items.filter((pratica) => !DEMO_PRATICA_IDS.has(pratica.id));
let state: { pratiche: Pratica[] } = { pratiche: cleanPratiche(loadPersisted<Pratica[]>(PERSIST_KEY, [])) };
savePersisted(PERSIST_KEY, state.pratiche);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;
const emit = () => {
  savePersisted(PERSIST_KEY, state.pratiche);
  listeners.forEach((l) => l());
};

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    state = { pratiche: [] };
    savePersisted(PERSIST_KEY, state.pratiche);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<Pratica>("pratiche");
  if (rows.length === 0 && state.pratiche.length > 0) {
    await cloudBulkUpsert("pratiche", state.pratiche);
  } else {
    state = { pratiche: rows.map((r) => ({ ...(r.data as Pratica), id: r.id })) };
    savePersisted(PERSIST_KEY, state.pratiche);
    listeners.forEach((l) => l());
  }
});

const tipoToProdotto: Record<PraticaTipo, LiquidataRow["prodotto"]> = {
  CQS: "CQS",
  PRESTITO_PERSONALE: "Prestito",
  DELEGA_PAGAMENTO: "delega_pagamento",
  MUTUO: "Mutuo",
};

const splitCliente = (cliente: string) => {
  const parts = (cliente || "").trim().split(/\s+/);
  if (parts.length === 0) return { nome: "—", cognome: "—" };
  if (parts.length === 1) return { nome: parts[0], cognome: "—" };
  const cognome = parts[parts.length - 1];
  const nome = parts.slice(0, -1).join(" ");
  return { nome, cognome };
};

const movePratica = (id: string, stage: PraticaStageKey, dataLiq?: string) => {
  const prev = state.pratiche.find((p) => p.id === id);
  state = { pratiche: state.pratiche.map((p) => (p.id === id ? { ...p, stage } : p)) };
  emit();
  const moved = state.pratiche.find((p) => p.id === id);
  if (moved) void cloudUpsert("pratiche", moved);
  if (prev && stage === "liquidata" && prev.stage !== "liquidata") {
    const { nome, cognome } = splitCliente(prev.cliente);
    const dataFinale = dataLiq && /^\d{4}-\d{2}-\d{2}$/.test(dataLiq)
      ? dataLiq
      : new Date().toISOString().slice(0, 10);
    liquidatoActions.addRow({
      id: `liq-${prev.id}`,
      cognome,
      nome,
      prodotto: tipoToProdotto[prev.tipo],
      banca: prev.banca ?? null,
      dataLiq: dataFinale,
      rata: prev.rata ?? null,
      durata: prev.durata ?? null,
      netto: praticaMontanteLordo(prev) || prev.importo || null,
      provvigione: prev.provvigione || 0,
    });
  } else if (prev && prev.stage === "liquidata" && stage !== "liquidata") {
    liquidatoActions.removeByPraticaId(prev.id);
  }
};
const deletePratica = (id: string) => {
  liquidatoActions.removeByPraticaId(id);
  state = { pratiche: state.pratiche.filter((p) => p.id !== id) };
  emit();
  void cloudDelete("pratiche", id);
};
const updatePratica = (id: string, patch: Partial<Pratica>) => {
  state = { pratiche: state.pratiche.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
  emit();
  const updated = state.pratiche.find((p) => p.id === id);
  if (updated) void cloudUpsert("pratiche", updated);
};
const addPratica = (p: Omit<Pratica, "id">) => {
  const id = `p-${Math.random().toString(36).slice(2, 9)}`;
  const created = { ...p, id };
  state = { pratiche: [...state.pratiche, created] };
  emit();
  void cloudUpsert("pratiche", created);
};

const syncClienteForCliente = (
  input: { id?: string | null; name?: string | null },
  azienda: string | null,
) => {
  const tokenize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  const nextName = (input.name ?? "").trim();
  const nameKey = tokenize(nextName);
  const newAz = (azienda ?? "").trim() || null;
  let changed = false;
  const updated: Pratica[] = [];
  state = {
    pratiche: state.pratiche.map((p) => {
      const matchId = input.id && p.clienteId === input.id;
      const matchName = nameKey && tokenize(p.cliente ?? "") === nameKey;
      if (matchId || matchName) {
        const prevCliente = p.cliente;
        const prevAz = (p.azienda ?? "").trim() || null;
        const shouldUpdateCliente = Boolean(nextName && p.cliente !== nextName);
        const shouldUpdateAzienda = (prevAz ?? "") !== (newAz ?? "");
        if (shouldUpdateCliente || shouldUpdateAzienda) {
          changed = true;
          const next = {
            ...p,
            cliente: shouldUpdateCliente ? nextName : p.cliente,
            nomePratica: shouldUpdateCliente && prevCliente
              ? p.nomePratica.replace(prevCliente, nextName)
              : p.nomePratica,
            azienda: newAz,
          };
          updated.push(next);
          return next;
        }
      }
      return p;
    }),
  };
  if (changed) {
    emit();
    updated.forEach((p) => void cloudUpsert("pratiche", p));
  }
};

export const praticheActions = { syncClienteForCliente };

export function usePraticheStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    pratiche: snap.pratiche,
    movePratica,
    deletePratica,
    updatePratica,
    addPratica,
  };
}