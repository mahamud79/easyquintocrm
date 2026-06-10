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

export type LeadStageKey =
  | "nuovo_da_chiamare"
  | "appuntamento_telefonico"
  | "tentativo_1"
  | "tentativo_2"
  | "tentativo_3"
  | "non_reperibili"
  | "non_fattibili"
  | "appuntamento_futuro"
  | "richiesta_documenti"
  | "documenti_non_inviati"
  | "preventivo_da_inviare"
  | "preventivo_inviato"
  | "sollecito_risposta"
  | "in_trattativa"
  | "persa"
  | "accettato";

export type LeadStageDef = {
  key: LeadStageKey;
  label: string;
  border: string; // tailwind border-t-* color
  pill: string;
};

export const LEAD_STAGES: LeadStageDef[] = [
  { key: "nuovo_da_chiamare", label: "Nuovo da Chiamare", border: "border-t-teal-400", pill: "bg-teal-100 text-teal-700" },
  { key: "appuntamento_telefonico", label: "Appuntamento Telefonico", border: "border-t-amber-400", pill: "bg-amber-100 text-amber-700" },
  { key: "tentativo_1", label: "1° Tentativo non risposto", border: "border-t-slate-300", pill: "bg-slate-100 text-slate-700" },
  { key: "tentativo_2", label: "2° Tentativo non Risposto", border: "border-t-slate-400", pill: "bg-slate-100 text-slate-700" },
  { key: "tentativo_3", label: "3° Tentativo non Risposto", border: "border-t-slate-500", pill: "bg-slate-200 text-slate-700" },
  { key: "non_reperibili", label: "Non Reperibili", border: "border-t-zinc-400", pill: "bg-zinc-100 text-zinc-700" },
  { key: "non_fattibili", label: "Non Fattibili", border: "border-t-rose-400", pill: "bg-rose-100 text-rose-700" },
  { key: "appuntamento_futuro", label: "Appuntamento Futuro", border: "border-t-sky-400", pill: "bg-sky-100 text-sky-700" },
  { key: "richiesta_documenti", label: "Richiesta Documenti", border: "border-t-violet-400", pill: "bg-violet-100 text-violet-700" },
  { key: "documenti_non_inviati", label: "Documenti non Inviati", border: "border-t-fuchsia-400", pill: "bg-fuchsia-100 text-fuchsia-700" },
  { key: "preventivo_da_inviare", label: "Preventivo da Inviare", border: "border-t-indigo-400", pill: "bg-indigo-100 text-indigo-700" },
  { key: "preventivo_inviato", label: "Preventivo Inviato", border: "border-t-blue-400", pill: "bg-blue-100 text-blue-700" },
  { key: "sollecito_risposta", label: "Sollecito Risposta", border: "border-t-orange-400", pill: "bg-orange-100 text-orange-700" },
  { key: "in_trattativa", label: "In Trattativa", border: "border-t-cyan-400", pill: "bg-cyan-100 text-cyan-700" },
  { key: "persa", label: "Persa", border: "border-t-red-500", pill: "bg-red-100 text-red-700" },
  { key: "accettato", label: "Accettato", border: "border-t-emerald-500", pill: "bg-emerald-100 text-emerald-700" },
];

export type Lead = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  stage: LeadStageKey;
  value: number;
  provvigione?: number;
  createdLabel: string;
  dueLabel: string | null;
  overdueLabel: string | null;
  dueDate: Date | null;
  temperature: "freddo" | "tiepido" | "caldo";
  potential: "potenziale" | "qualificato" | "vip";
  // detail-page mock fields
  notes: string;
  ltc: number;
  // editable scheda-cliente fields
  surname?: string;
  engagement?: string;
  phone2?: string;
  birthDate?: string;
  fiscalCode?: string;
  sex?: string;
  citizenship?: string;
  address?: string;
  dataPersonali?: string;
  situazioneEconomica?: string;
  tipoLavoro?: string;
  azienda?: string;
  partitaIva?: string;
  dataAssunzione?: string;
  stipendioNetto?: string;
  redditoAggiuntivo?: string;
  tfrAzienda?: string;
  tfrFondo?: string;
  tfr?: string;
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
  // Rubrica privati
  motivoPersa?: string;
  rivalutaIl?: string; // ISO yyyy-mm-dd — quando ricontattare (es. raggiungimento TFR)
};

const AVATAR = [
  "bg-gradient-to-br from-orange-500 to-red-500",
  "bg-gradient-to-br from-blue-500 to-indigo-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-pink-500 to-rose-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const mk = (id: string, name: string, stage: LeadStageKey, opts: Partial<Lead> = {}): Lead => ({
  id,
  name,
  initials: initials(name),
  avatarColor: AVATAR[Math.abs(hash(id)) % AVATAR.length],
  company: opts.company ?? "Privato",
  phone: opts.phone ?? null,
  email: opts.email ?? null,
  source: opts.source ?? "manuale",
  stage,
  value: opts.value ?? 0,
  provvigione: opts.provvigione ?? ((opts.value ?? 0) > 0 ? Math.round((opts.value ?? 0) * 0.04 * 100) / 100 : 0),
  createdLabel: opts.createdLabel ?? "01 giu 26 17:00",
  dueLabel: opts.dueLabel ?? "Oggi",
  overdueLabel: opts.overdueLabel ?? null,
  dueDate: opts.dueDate ?? null,
  temperature: opts.temperature ?? "freddo",
  potential: opts.potential ?? "potenziale",
  notes: opts.notes ?? "",
  ltc: opts.ltc ?? 0,
});

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

const DEMO_LEAD_IDS = new Set<string>([
  "emanuele-marino",
  "monica-funari",
  "massimo-ferrari",
  "luca-bianchi",
  "sara-rossi",
  "paolo-greco",
  "anna-villa",
  "matteo-conti",
  "giulia-romano",
  "davide-sala",
  "fabio-negri",
  "monica-ferri",
  "cristiano-mari",
  "massimo-mancini",
  "matteo-fontana-t",
  "federico-rinaldi",
  "martina-bruno",
  "roberta-battaglia",
  "cristian-negri",
  "emanuele-leone",
]);

const PERSIST_KEY = "leads";
const cleanLeads = (items: Lead[]) =>
  items.filter((lead) => lead.source !== "seed_demo_2026" && !DEMO_LEAD_IDS.has(lead.id));
const normalizeName = (value?: string | null) => (value ?? "").trim().toLowerCase();
const normalizePhone = (value?: string | null) => (value ?? "").replace(/\D/g, "");
let state: { leads: Lead[] } = { leads: cleanLeads(loadPersisted<Lead[]>(PERSIST_KEY, [])) };
savePersisted(PERSIST_KEY, state.leads);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;
const emit = () => {
  savePersisted(PERSIST_KEY, state.leads);
  listeners.forEach((l) => l());
};

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    state = { leads: [] };
    savePersisted(PERSIST_KEY, state.leads);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<Lead>("lead");
  if (rows.length === 0 && state.leads.length > 0) {
    await cloudBulkUpsert("lead", state.leads);
  } else {
    state = { leads: rows.map((r) => ({ ...(r.data as Lead), id: r.id })) };
    savePersisted(PERSIST_KEY, state.leads);
    listeners.forEach((l) => l());
  }
});

const moveLead = (id: string, stage: LeadStageKey) => {
  state = { leads: state.leads.map((l) => (l.id === id ? { ...l, stage } : l)) };
  emit();
  const moved = state.leads.find((l) => l.id === id);
  if (moved) void cloudUpsert("lead", moved);
};
const deleteLead = (id: string) => {
  state = { leads: state.leads.filter((l) => l.id !== id) };
  emit();
  void cloudDelete("lead", id);
};
const updateLead = (id: string, patch: Partial<Lead>) => {
  state = { leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
  emit();
  const updated = state.leads.find((l) => l.id === id);
  if (updated) void cloudUpsert("lead", updated);
};
const addLead = (input: {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  source?: string;
  value?: number;
  stage?: LeadStageKey;
  notes?: string;
  motivoPersa?: string;
}) => {
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date();
  const createdLabel = `${String(today.getDate()).padStart(2, "0")} ${today
    .toLocaleString("it-IT", { month: "short" })
    .replace(".", "")} ${String(today.getFullYear()).slice(2)} ${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
  const lead = mk(id, input.name, input.stage ?? "nuovo_da_chiamare", {
    phone: input.phone || null,
    email: input.email || undefined,
    company: input.company || "Privato",
    source: input.source || "manuale",
    value: input.value ?? 0,
    createdLabel,
    dueLabel: "Oggi",
    notes: input.notes ?? "",
  });
  if (input.motivoPersa) lead.motivoPersa = input.motivoPersa;
  state = { leads: [lead, ...state.leads] };
  emit();
  void cloudUpsert("lead", lead);
  return lead;
};

const findOrCreateLeadByContact = (input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  source?: string;
  stage?: LeadStageKey;
}): string => {
  const nameKey = input.name.trim().toLowerCase();
  const phoneKey = (input.phone ?? "").replace(/\s+/g, "");
  const existing = state.leads.find((l) => {
    const sameName = l.name.trim().toLowerCase() === nameKey;
    const samePhone = phoneKey && (l.phone ?? "").replace(/\s+/g, "") === phoneKey;
    return sameName || samePhone;
  });
  if (existing) return existing.id;
  const created = addLead({
    name: input.name,
    phone: input.phone ?? undefined,
    email: input.email ?? undefined,
    company: input.company ?? undefined,
    source: input.source ?? "scheda-cliente",
    stage: input.stage ?? "accettato",
  });
  return created.id;
};

export function useLeadsStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    leads: snap.leads,
    moveLead,
    deleteLead,
    updateLead,
    addLead,
    findOrCreateLeadByContact,
    getLead: (id: string) => snap.leads.find((l) => l.id === id),
  };
}

export const leadsStore = {
  get: () => state.leads,
  deleteLead,
  deleteByContact: (input: { id?: string; name?: string; phone?: string | null; email?: string | null }) => {
    const nameKey = normalizeName(input.name);
    const phoneKey = normalizePhone(input.phone);
    const emailKey = normalizeName(input.email);
    const before = state.leads.length;
    const toDelete: string[] = [];
    state = {
      leads: state.leads.filter((l) => {
        const match =
          (input.id && l.id === input.id) ||
          (nameKey && normalizeName(l.name) === nameKey) ||
          (phoneKey && normalizePhone(l.phone) === phoneKey) ||
          (emailKey && normalizeName(l.email) === emailKey);
        if (match) {
          toDelete.push(l.id);
          return false;
        }
        return true;
      }),
    };
    if (state.leads.length !== before) {
      emit();
      void cloudDeleteMany("lead", toDelete);
    }
  },
};