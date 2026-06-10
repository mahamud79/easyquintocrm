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

export type NoteEntry = {
  id: string;
  body: string;
  files: { name: string; type: string; size: number; url: string }[];
  createdAt: string; // ISO
};

export type Cliente = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  city: string;
  phone: string;
  email: string;
  prodotto: string; // "Cessione del Quinto", "Prestito Personale", "N/D"
  stato: "liquidato" | "in_lavorazione" | "perso";
  banca: string | null; // "IBL BANCA", "AVVERA", "FIDES", null
  bancaTone: "amber" | "violet" | "rose" | "emerald" | null;
  dataRinnovo: string | null;
  notes: string;
  // editable scheda-cliente fields
  surname?: string;
  phone2?: string;
  engagement?: string;
  birthDate?: string;
  fiscalCode?: string;
  sex?: string;
  birthPlace?: string;
  citizenship?: string;
  residenceCity?: string;
  province?: string;
  address?: string;
  tipoLavoro?: string;
  azienda?: string;
  partitaIva?: string;
  settoreAtc?: string;
  dataAssunzione?: string;
  stipendioNetto?: string;
  redditoAggiuntivo?: string;
  tfrAzienda?: string;
  tfrFondo?: string;
  crif?: string;
  impegniMensili?: string;
  provenienzaLead?: string;
  tipoContatto?: string;
  priorita?: string;
  recallDate?: string;
  tipologiaAbitazione?: string;
  familiariCarico?: string;
  relazione?: string;
  prodottiInteresse?: string[];
  privacyTrattamento?: boolean;
  privacyMarketing?: boolean;
  noteEntries?: NoteEntry[];
};

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
];

function initials(name: string) {
  const parts = name.split(" ");
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const normalizeName = (value?: string | null) => (value ?? "").trim().toLowerCase();
const normalizePhone = (value?: string | null) => (value ?? "").replace(/\D/g, "");

function matchesContact(
  cliente: Cliente,
  input: { id?: string | null; name?: string | null; phone?: string | null; email?: string | null },
) {
  const nameKey = normalizeName(input.name);
  const phoneKey = normalizePhone(input.phone);
  const emailKey = normalizeName(input.email);
  return Boolean(
    (input.id && cliente.id === input.id) ||
      (nameKey && normalizeName(cliente.name) === nameKey) ||
      (phoneKey && normalizePhone(cliente.phone) === phoneKey) ||
      (emailKey && normalizeName(cliente.email) === emailKey),
  );
}

const PERSIST_KEY = "clienti";
const cleanClienti = (items: Cliente[]) =>
  items.filter((c) => !c.email.endsWith("@demo-cliente.local"));
let _clienti: Cliente[] = cleanClienti(loadPersisted<Cliente[]>(PERSIST_KEY, []));
savePersisted(PERSIST_KEY, _clienti);

const listeners = new Set<() => void>();
function emit() {
  savePersisted(PERSIST_KEY, _clienti);
  listeners.forEach((l) => l());
}

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    _clienti = [];
    savePersisted(PERSIST_KEY, _clienti);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<Cliente>("clienti");
  if (rows.length === 0 && _clienti.length > 0) {
    await cloudBulkUpsert("clienti", _clienti);
  } else {
    _clienti = rows.map((r) => ({ ...(r.data as Cliente), id: r.id }));
    savePersisted(PERSIST_KEY, _clienti);
    listeners.forEach((l) => l());
  }
});

export const clientiStore = {
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  get() { return _clienti; },
  update(id: string, patch: Partial<Cliente>) {
    _clienti = _clienti.map((c) => (c.id === id ? { ...c, ...patch } : c));
    emit();
    const updated = _clienti.find((c) => c.id === id);
    if (updated) void cloudUpsert("clienti", updated);
  },
  remove(id: string) {
    _clienti = _clienti.filter((c) => c.id !== id);
    emit();
    void cloudDelete("clienti", id);
  },
  removeByContact(input: { id?: string | null; name?: string | null; phone?: string | null; email?: string | null }) {
    const before = _clienti.length;
    const removed = _clienti.filter((c) => matchesContact(c, input));
    _clienti = _clienti.filter((c) => !matchesContact(c, input));
    if (_clienti.length !== before) {
      emit();
      void cloudDeleteMany("clienti", removed.map((c) => c.id));
    }
  },
  ensure(input: { id: string; name: string; phone?: string | null; email?: string | null }) {
    const existing = _clienti.find((c) => c.id === input.id);
    if (existing) return existing;
    const created: Cliente = {
      id: input.id,
      name: input.name,
      initials: initials(input.name),
      avatarColor: AVATAR_COLORS[Math.abs(hashStr(input.id)) % AVATAR_COLORS.length],
      city: "—",
      phone: input.phone ?? "",
      email: input.email ?? "",
      prodotto: "N/D",
      stato: "in_lavorazione",
      banca: null,
      bancaTone: null,
      dataRinnovo: null,
      notes: "",
    };
    _clienti = [..._clienti, created];
    emit();
    void cloudUpsert("clienti", created);
    return created;
  },
};

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function useClientiStore() {
  const clienti = useSyncExternalStore(
    clientiStore.subscribe,
    clientiStore.get,
    clientiStore.get,
  );
  return {
    clienti,
    updateCliente: clientiStore.update,
    deleteCliente: clientiStore.remove,
    deleteClienteByContact: clientiStore.removeByContact,
  };
}