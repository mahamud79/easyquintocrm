import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import {
  cloudBulkUpsert,
  cloudDelete,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type BancaTipologia = "BANCA" | "FINANZIARIA" | "";
export type BancaConvenzione = "ATTIVA" | "SOSPESA" | "CHIUSA";

export type Banca = {
  id: string;
  nome: string;
  tipologia: BancaTipologia;
  convenzione: BancaConvenzione;
  telefono?: string;
  email?: string;
  referente?: string;
  sitoWeb?: string;
  mailPec?: string;
  citta?: string;
  cap?: string;
  note?: string;
};

const SEED: Banca[] = [
  { id: "1", nome: "ADV FINANCE S.P.A.", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "2", nome: "AGOS", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "3", nome: "ALTRA BANCA", tipologia: "", convenzione: "ATTIVA" },
  { id: "4", nome: "AVVERA", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "5", nome: "BANCA CENTRO EMILIA SPA", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "6", nome: "BANCA DI BOLOGNA", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "7", nome: "BANCA ETICA", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "8", nome: "BANCA GENERALI", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "9", nome: "BANCA POPOLARE PUGLIESE", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "10", nome: "BANCA PROGETTO", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "11", nome: "BANCA SELLA", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "12", nome: "BANCA SISTEMA", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "13", nome: "BANCO DESIO", tipologia: "", convenzione: "ATTIVA" },
  { id: "14", nome: "BCC", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "15", nome: "BCP", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "16", nome: "BIBANCA", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "17", nome: "BNL", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "18", nome: "BNT", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "19", nome: "BPER Banca", tipologia: "BANCA", convenzione: "ATTIVA", mailPec: "bper@pec.gruppobper.it" },
  { id: "20", nome: "BPM", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "21", nome: "CAPITALFIN", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "22", nome: "COFIDIS", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "23", nome: "COMPASS", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "24", nome: "CREDITIS", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "25", nome: "DEUTSCHE BANK S.P.A.", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "26", nome: "DYNAMICA RETAIL", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "27", nome: "FIDES", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "28", nome: "FIDITALIA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", mailPec: "servizioclienticqs@fiditalia.it" },
  { id: "29", nome: "FIGENPA S.P.A.", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "30", nome: "FINCONTINUO", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "31", nome: "FINDOMESTIC", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "32", nome: "FINECO", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "33", nome: "FINGENPA", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "34", nome: "FUCINO", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "35", nome: "IBL BANCA", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "36", nome: "ING DIRECT", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "37", nome: "INTESA SAN PAOLO", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "38", nome: "ITALCREDI", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "39", nome: "MEDIOLANUM", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "40", nome: "MPS", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "41", nome: "PITAGORA", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "42", nome: "PRESTITALIA", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "43", nome: "PREXTA", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "44", nome: "SANTANDER", tipologia: "BANCA", convenzione: "ATTIVA" },
  { id: "45", nome: "SIGLA CREDIT", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "46", nome: "SPEFIN", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "47", nome: "TIM FIN", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "48", nome: "UNICREDIT", tipologia: "", convenzione: "ATTIVA" },
  { id: "49", nome: "VIVIBANCA", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
  { id: "50", nome: "YOUNITED", tipologia: "FINANZIARIA", convenzione: "ATTIVA" },
];

const PERSIST_KEY = "banche";
let state: { items: Banca[] } = { items: loadPersisted<Banca[]>(PERSIST_KEY, SEED) };
savePersisted(PERSIST_KEY, state.items);
const listeners = new Set<() => void>();
const emit = () => {
  savePersisted(PERSIST_KEY, state.items);
  listeners.forEach((l) => l());
};

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    state = { items: SEED };
    savePersisted(PERSIST_KEY, state.items);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<Banca>("banche");
  if (rows.length === 0) {
    // First time per user: seed cloud with current local list (or SEED)
    await cloudBulkUpsert("banche", state.items);
  } else {
    state = { items: rows.map((r) => ({ ...(r.data as Banca), id: r.id })) };
    savePersisted(PERSIST_KEY, state.items);
    listeners.forEach((l) => l());
  }
});

export const bancheStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return state.items;
  },
  upsert(b: Banca) {
    const exists = state.items.some((p) => p.id === b.id);
    state = {
      items: exists
        ? state.items.map((p) => (p.id === b.id ? b : p))
        : [...state.items, b],
    };
    emit();
    void cloudUpsert("banche", b);
  },
  remove(id: string) {
    const before = state.items.length;
    state = { items: state.items.filter((p) => p.id !== id) };
    if (state.items.length !== before) {
      emit();
      void cloudDelete("banche", id);
    }
  },
};

export function useBanche() {
  return useSyncExternalStore(bancheStore.subscribe, bancheStore.get, bancheStore.get);
}
