import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import type { PraticaTipo } from "@/lib/pratiche-store";
import {
  cloudBulkUpsert,
  cloudDelete,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type PreventivoCategoria = "cessioni" | "prestiti" | "mutui";

export type PreventivoImpegnoSnap = {
  id: string;
  tipo: "CQS" | "PRESTITO_PERSONALE" | "DELEGAZIONE";
  banca: string;
  rata: number;
  dataDecorrenza: string;
  dataScadenza: string;
  daEstinguere: boolean;
};

export type PreventivoDettagli = {
  clienteId?: string;
  telefonoCliente?: string;
  aziendaCliente?: string;
  sesso?: string;
  dataNascita?: string;
  dataAssunzione?: string;
  tipologia?: string;
  regione?: string;
  comune?: string;
  settoreAtc?: string;
  mensilita?: number;
  lordoMensile?: number;
  nettoMensile?: number;
  quotaCedibile?: number;
  sogliaIndebitamento?: number;
  rata?: number;
  durata?: number;
  tan?: number;
  taeg?: number;
  montante?: number;
  netto?: number;
  bancaMandante?: string;
  provvigionePct?: number;
  emailCliente?: string;
  impegni?: PreventivoImpegnoSnap[];
  archived?: boolean;
  mostraProvvigioni?: boolean;
  // override editabili della situazione reddituale
  lordoMensileEdit?: number;
  nettoMensileEdit?: number;
  quotaCedibileEdit?: number;
  // PDF generato salvato come data URL (per consultarlo anche dopo la trasformazione in pratica)
  pdfDataUrl?: string;
  pdfGeneratedAt?: string;
  assicurazione?: string;
};

export type Preventivo = {
  id: string;
  nome: string;
  tipoLead: "Lead" | "Cliente";
  prodotto: string;
  data: string; // ISO yyyy-mm-dd
  categoria: PreventivoCategoria;
  tipoPratica: PraticaTipo;
  importo: number;
  provvigione: number;
  dettagli?: PreventivoDettagli;
};

const PERSIST_KEY = "preventivi";
const DEMO_PREVENTIVO_IDS = new Set<string>(Array.from({ length: 32 }, (_, i) => `prev-${i + 1}`));
const cleanPreventivi = (items: Preventivo[]) => items.filter((p) => !DEMO_PREVENTIVO_IDS.has(p.id));
let state: { preventivi: Preventivo[] } = {
  preventivi: cleanPreventivi(loadPersisted<Preventivo[]>(PERSIST_KEY, [])),
};
savePersisted(PERSIST_KEY, state.preventivi);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;
const emit = () => {
  savePersisted(PERSIST_KEY, state.preventivi);
  listeners.forEach((l) => l());
};

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    state = { preventivi: [] };
    savePersisted(PERSIST_KEY, state.preventivi);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<Preventivo>("preventivi");
  if (rows.length === 0 && state.preventivi.length > 0) {
    await cloudBulkUpsert("preventivi", state.preventivi);
  } else {
    state = { preventivi: rows.map((r) => ({ ...(r.data as Preventivo), id: r.id })) };
    savePersisted(PERSIST_KEY, state.preventivi);
    listeners.forEach((l) => l());
  }
});

const removePreventivo = (id: string) => {
  state = { preventivi: state.preventivi.filter((p) => p.id !== id) };
  emit();
  void cloudDelete("preventivi", id);
};
const addPreventivo = (p: Omit<Preventivo, "id">) => {
  const id = `prev-${Math.random().toString(36).slice(2, 9)}`;
  const created: Preventivo = { ...p, id };
  state = { preventivi: [created, ...state.preventivi] };
  emit();
  void cloudUpsert("preventivi", created);
};
const updatePreventivo = (id: string, patch: Partial<Omit<Preventivo, "id">>) => {
  state = {
    preventivi: state.preventivi.map((p) =>
      p.id === id
        ? { ...p, ...patch, dettagli: { ...(p.dettagli ?? {}), ...(patch.dettagli ?? {}) } }
        : p,
    ),
  };
  emit();
  const updated = state.preventivi.find((p) => p.id === id);
  if (updated) void cloudUpsert("preventivi", updated);
};

export function usePreventiviStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { preventivi: snap.preventivi, removePreventivo, addPreventivo, updatePreventivo };
}