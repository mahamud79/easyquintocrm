import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import {
  cloudBulkUpsert,
  cloudDeleteMany,
  cloudFetchAll,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type Prodotto = "Prestito Personale" | "Cessione del Quinto" | "Delega di Pagamento";
export type TipoCliente = "Dipendente Privato" | "Dipendente Pubblico" | "Pensionato";

export type Compagnia = {
  id: string;
  nome: string;
  codice: string;
  prodotti: Prodotto[];
  tipiCliente: TipoCliente[];
  note?: string;
};

const SEED: Compagnia[] = [
  { id: "1", nome: "ALLIANZ", codice: "ALLIANZ", prodotti: ["Cessione del Quinto"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"] },
  { id: "2", nome: "AXA", codice: "AXA", prodotti: ["Cessione del Quinto", "Delega di Pagamento"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"] },
  { id: "3", nome: "CARDIF", codice: "CARDIF", prodotti: ["Cessione del Quinto", "Delega di Pagamento"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"] },
  { id: "4", nome: "CF", codice: "CF", prodotti: ["Cessione del Quinto", "Delega di Pagamento"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"] },
  { id: "5", nome: "GAIIL", codice: "GAIIL", prodotti: ["Cessione del Quinto", "Delega di Pagamento"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"] },
  { id: "6", nome: "HDI", codice: "HDI", prodotti: ["Cessione del Quinto"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico"] },
  { id: "7", nome: "NET INSURANCE", codice: "NET", prodotti: ["Cessione del Quinto", "Delega di Pagamento"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"] },
  { id: "8", nome: "SOGECAP", codice: "SOGECAP", prodotti: ["Cessione del Quinto", "Delega di Pagamento"], tipiCliente: ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"] },
];

const PERSIST_KEY = "compagnie";
let state: { items: Compagnia[] } = { items: loadPersisted<Compagnia[]>(PERSIST_KEY, SEED) };
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
  const rows = await cloudFetchAll<Compagnia>("compagnie_assicurative");
  if (rows.length === 0) {
    // First time on cloud: push current items (local edits or SEED) up
    await cloudBulkUpsert("compagnie_assicurative", state.items);
  } else {
    state = { items: rows.map((r) => ({ ...(r.data as Compagnia), id: r.id })) };
    savePersisted(PERSIST_KEY, state.items);
    listeners.forEach((l) => l());
  }
});

export const compagnieStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return state.items;
  },
  set(items: Compagnia[]) {
    const removedIds = state.items
      .filter((prev) => !items.some((n) => n.id === prev.id))
      .map((p) => p.id);
    state = { items };
    emit();
    void cloudBulkUpsert("compagnie_assicurative", items);
    if (removedIds.length) void cloudDeleteMany("compagnie_assicurative", removedIds);
  },
};

export function useCompagnie() {
  const items = useSyncExternalStore(compagnieStore.subscribe, compagnieStore.get, compagnieStore.get);
  return [items, compagnieStore.set] as const;
}

export function getCompagnieNomi(): string[] {
  return state.items.map((c) => c.nome);
}