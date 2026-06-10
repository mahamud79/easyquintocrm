import { useSyncExternalStore } from "react";
import { BANCHE_NOMI } from "./banche-list";
import {
  cloudDelete,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type OptionListKey =
  | "stati_contatto"
  | "fonti_lead"
  | "tipi_attivita"
  | "priorita_attivita"
  | "stadi_lead"
  | "stadi_pratica"
  | "tipi_pratica"
  | "categorie_lavoratore"
  | "banche"
  | "prodotti"
  | "tipi_documento"
  | "esiti_chiamata";

export type OptionListDef = {
  key: OptionListKey;
  label: string;
  description: string;
  defaults: string[];
};

export const OPTION_LISTS: OptionListDef[] = [
  {
    key: "stati_contatto",
    label: "Stati Contatto",
    description: "Stati assegnabili ai contatti del CRM.",
    defaults: ["Nuovo", "Qualificato", "Cliente", "Perso"],
  },
  {
    key: "fonti_lead",
    label: "Fonti Lead",
    description: "Canali di provenienza dei lead.",
    defaults: ["Referral", "Sito web", "Social", "Meta Ads", "Google Ads", "Telefono", "Email", "Altro"],
  },
  {
    key: "tipi_attivita",
    label: "Tipi Attività",
    description: "Tipologie disponibili per le attività.",
    defaults: ["Chiamata", "Email", "Meeting", "Task", "WhatsApp"],
  },
  {
    key: "priorita_attivita",
    label: "Priorità",
    description: "Livelli di priorità per attività e pratiche.",
    defaults: ["Bassa", "Media", "Alta", "Urgente"],
  },
  {
    key: "stadi_lead",
    label: "Stadi Lead",
    description: "Step del funnel di qualificazione lead.",
    defaults: ["Nuovo", "Contattato", "Qualificato", "Offerta inviata", "Vinto", "Perso"],
  },
  {
    key: "stadi_pratica",
    label: "Stadi Pratica",
    description: "Stati di avanzamento delle pratiche.",
    defaults: [
      "Passate", "Attesa Doc cliente", "Richiesto CDS", "Da Caricare", "Caricata",
      "Sospesa", "Respinta", "Deliberata", "Richiesta Polizza", "Polizza emessa",
      "Erogato Anticipo", "Richiesto C.E.", "Effettuata Estinzione",
      "Notificato Attesa Ben", "Liquidata",
    ],
  },
  {
    key: "tipi_pratica",
    label: "Tipi Pratica",
    description: "Tipologie di prodotto/pratica gestite.",
    defaults: ["CQS", "Delega di Pagamento", "Prestito Personale"],
  },
  {
    key: "categorie_lavoratore",
    label: "Categorie Lavoratore",
    description: "Profili lavorativi per simulazioni e preventivi.",
    defaults: ["Privato", "Pubblico", "Autonomo", "Pensionato"],
  },
  {
    key: "banche",
    label: "Banche / Mandanti",
    description: "Elenco delle banche e finanziarie convenzionate.",
    defaults: [...BANCHE_NOMI],
  },
  {
    key: "prodotti",
    label: "Prodotti",
    description: "Prodotti commercializzati.",
    defaults: ["Cessione del Quinto", "Delega di Pagamento", "Prestito Personale", "Polizza CPI"],
  },
  {
    key: "tipi_documento",
    label: "Tipi Documento",
    description: "Tipologie di documenti caricabili in pratica.",
    defaults: [
      "Carta d'Identità", "Codice Fiscale", "Busta Paga", "CU", "Modello 730",
      "Estratto Conto", "Visura Camerale", "Certificato Stipendio", "Quietanza",
    ],
  },
  {
    key: "esiti_chiamata",
    label: "Esiti Chiamata",
    description: "Possibili esiti per le chiamate.",
    defaults: [
      "Risposta", "Non risponde", "Numero errato", "Richiamare", "Non interessato",
      "Appuntamento fissato", "Da qualificare",
    ],
  },
];

const STORAGE_KEY = "lv.option-lists.v1";

type Store = Partial<Record<OptionListKey, string[]>>;

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

let cache: Store = loadStore();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function notify() {
  for (const l of listeners) l();
}

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    cache = {};
    persist();
    notify();
    return;
  }
  const rows = await cloudFetchAll<{ items: string[] }>("impostazioni");
  if (rows.length === 0 && Object.keys(cache).length > 0) {
    for (const [k, items] of Object.entries(cache)) {
      if (items) void cloudUpsert("impostazioni", { id: k, items });
    }
  } else {
    const next: Store = {};
    for (const r of rows) {
      const items = (r.data as { items?: string[] })?.items;
      if (Array.isArray(items)) next[r.id as OptionListKey] = items;
    }
    cache = next;
    persist();
    notify();
  }
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): Store {
  return cache;
}

function getServerSnapshot(): Store {
  return {};
}

export function getOptionList(key: OptionListKey): string[] {
  const def = OPTION_LISTS.find((l) => l.key === key);
  return cache[key] ?? def?.defaults ?? [];
}

export function setOptionList(key: OptionListKey, items: string[]) {
  cache = { ...cache, [key]: items };
  persist();
  notify();
  void cloudUpsert("impostazioni", { id: key, items });
}

export function resetOptionList(key: OptionListKey) {
  const next = { ...cache };
  delete next[key];
  cache = next;
  persist();
  notify();
  void cloudDelete("impostazioni", key);
}

export function useOptionList(key: OptionListKey): string[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const def = OPTION_LISTS.find((l) => l.key === key);
  return snap[key] ?? def?.defaults ?? [];
}