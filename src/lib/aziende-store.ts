import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import {
  cloudBulkUpsert,
  cloudDelete,
  cloudDeleteMany,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type Azienda = {
  id: string;
  nome: string;
  partitaIva?: string;
  cf?: string;
};

const PERSIST_KEY = "aziende-condivise";
let state: { items: Azienda[] } = { items: loadPersisted<Azienda[]>(PERSIST_KEY, []) };
savePersisted(PERSIST_KEY, state.items);
const listeners = new Set<() => void>();
const emit = () => {
  savePersisted(PERSIST_KEY, state.items);
  listeners.forEach((l) => l());
};

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    state = { items: [] };
    savePersisted(PERSIST_KEY, state.items);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<Azienda>("aziende");
  if (rows.length === 0 && state.items.length > 0) {
    await cloudBulkUpsert("aziende", state.items);
  } else {
    state = { items: rows.map((r) => ({ ...(r.data as Azienda), id: r.id })) };
    savePersisted(PERSIST_KEY, state.items);
    listeners.forEach((l) => l());
  }
});

export const aziendeStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return state.items;
  },
  add(a: Omit<Azienda, "id"> & { id?: string }) {
    const id = a.id ?? `az-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const created: Azienda = { id, nome: a.nome, partitaIva: a.partitaIva, cf: a.cf };
    state = { items: [created, ...state.items] };
    emit();
    void cloudUpsert("aziende", created);
    return created;
  },
  findByName(name: string) {
    const key = name.trim().toLowerCase();
    return state.items.find((a) => a.nome.trim().toLowerCase() === key);
  },
  remove(id: string) {
    const before = state.items.length;
    state = { items: state.items.filter((a) => a.id !== id) };
    if (state.items.length !== before) {
      emit();
      void cloudDelete("aziende", id);
    }
  },
  removeByName(name: string) {
    const key = name.trim().toLowerCase();
    const before = state.items.length;
    const removed = state.items.filter((a) => a.nome.trim().toLowerCase() === key);
    state = { items: state.items.filter((a) => a.nome.trim().toLowerCase() !== key) };
    if (state.items.length !== before) {
      emit();
      void cloudDeleteMany("aziende", removed.map((r) => r.id));
    }
  },
};

export function useAziende() {
  return useSyncExternalStore(aziendeStore.subscribe, aziendeStore.get, aziendeStore.get);
}