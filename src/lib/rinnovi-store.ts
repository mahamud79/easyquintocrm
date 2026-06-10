import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import {
  cloudBulkUpsert,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type RinnovoStato = "da_contattare" | "contattato" | "interessato" | "non_interessato" | "rinnovato";
export type RinnovoTipo = "Delega" | "CQS";

export type Rinnovo = {
  id: string;
  clienteId?: string;
  nome: string;
  cognome: string;
  initials: string;
  avatarColor: string;
  telefono: string;
  email: string;
  tipo: RinnovoTipo;
  stato: RinnovoStato;
  rata: number;
  durataMesi: number;
  banca: string;
  decorrenza: string; // dd/mm/yyyy
  dataRinnovabilita: string; // dd/mm/yyyy
  rinnovabile: boolean;
  hidden?: boolean;
};

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-indigo-500",
];

const initialsOf = (n: string, c: string) =>
  ((n[0] ?? "") + (c[0] ?? "")).toUpperCase() || "?";

const colorFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const DEMO_RINNOVI = new Set<string>([
  "Chiara|Fabbri|+393335656241",
  "Isabella|Moretti|+393335656242",
  "Davide|Rinaldi|+393335656243",
  "Marco|Greco|+393335656244",
  "Elena|Conti|+393335656245"
]);

const PERSIST_KEY = "rinnovi";
let data: Rinnovo[] = loadPersisted<Rinnovo[]>(PERSIST_KEY, []).filter(
  (r) => !DEMO_RINNOVI.has(`${r.nome}|${r.cognome}|${r.telefono}`),
);
savePersisted(PERSIST_KEY, data);

const listeners = new Set<() => void>();
const emit = () => {
  savePersisted(PERSIST_KEY, data);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => data;

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    data = [];
    savePersisted(PERSIST_KEY, data);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<Rinnovo>("rinnovi");
  if (rows.length === 0 && data.length > 0) {
    await cloudBulkUpsert("rinnovi", data);
  } else {
    data = rows.map((r) => ({ ...(r.data as Rinnovo), id: r.id }));
    savePersisted(PERSIST_KEY, data);
    listeners.forEach((l) => l());
  }
});

export function useRinnoviStore() {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const rinnovi = all.filter((r) => !r.hidden);
  return {
    rinnovi,
    setStato: (id: string, stato: RinnovoStato) => {
      data = data.map((r) => (r.id === id ? { ...r, stato } : r));
      emit();
      const r = data.find((x) => x.id === id);
      if (r) void cloudUpsert("rinnovi", r);
    },
    hide: (id: string) => {
      data = data.map((r) => (r.id === id ? { ...r, hidden: true } : r));
      emit();
      const r = data.find((x) => x.id === id);
      if (r) void cloudUpsert("rinnovi", r);
    },
  };
}
