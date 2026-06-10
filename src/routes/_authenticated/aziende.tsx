import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Pencil,
  Trash2,
  Upload,
  Plus,
  Search,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { aziendeStore, useAziende as useAziendeShared } from "@/lib/aziende-store";
import { useClientiStore } from "@/lib/clienti-store";
import { loadPersisted, savePersisted } from "@/lib/persist";

export const Route = createFileRoute("/_authenticated/aziende")({
  head: () => ({ meta: [{ title: "Aziende · LeadValue" }] }),
  component: AziendePage,
});

type Tipologia =
  | "PRIVATA"
  | "PUBBLICA"
  | "PARAPUBBLICA"
  | "COOPERATIVA"
  | "SMALL BUSINESS"
  | "CESSATA"
  | "";
type SiNo = "SI" | "NO" | "";

const COMPAGNIE = [
  "ALLIANZ",
  "AXA",
  "CARDIF",
  "CF",
  "GAIIL",
  "GENERALI",
  "NET",
  "POSTE",
  "ZURICH",
] as const;
type Compagnia = (typeof COMPAGNIE)[number];

type Azienda = {
  id: string;
  nome: string;
  clienti: number;
  cf?: string;
  descrizione?: string;
  delegaPagamento?: SiNo;
  cds?: SiNo;
  tipologia: Tipologia;
  ratingMax?: number;
  aggiornato: string;
  telefono?: string;
  email?: string;
  sitoWeb?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  paese?: string;
  indirizzo?: string;
  rating?: Partial<Record<Compagnia, number>>;
  note?: string;
};

const SEED: Azienda[] = [
  { id: "1", nome: "VERDI SPA", clienti: 1, tipologia: "PRIVATA", aggiornato: "2026-06-02" },
  { id: "2", nome: "SERVIZIO SANITARIO REGIONALE EMILIA-ROMAGNA", clienti: 1, cf: "02406911202", tipologia: "", aggiornato: "2026-04-27" },
  { id: "3", nome: "PROSAPIO PATRICK SERVICE SRL", clienti: 1, cf: "02995001209", tipologia: "", ratingMax: 3, aggiornato: "2026-04-24" },
  { id: "4", nome: "EMACAR S.R.L.", clienti: 0, cf: "02678920816", tipologia: "SMALL BUSINESS", aggiornato: "2026-04-20" },
  { id: "5", nome: "R.E.A. Tech Srl.", clienti: 0, cf: "03892840368", tipologia: "SMALL BUSINESS", ratingMax: 2, aggiornato: "2026-04-20" },
  { id: "6", nome: "MAGNETO SOCIETA' COOPERATIVA PER AZIONI", clienti: 0, cf: "10270300964", tipologia: "COOPERATIVA", aggiornato: "2026-04-20" },
  { id: "7", nome: "ARGOTRACTOR SPA", clienti: 0, cf: "03876290374", tipologia: "PRIVATA", ratingMax: 8, aggiornato: "2026-04-16" },
  { id: "8", nome: "VENETO TRASPORTI GROUP SRL", clienti: 0, cf: "02480330816", tipologia: "PRIVATA", ratingMax: 8, aggiornato: "2026-04-15" },
  { id: "9", nome: "SYSTEM CERAMICS SPA", clienti: 0, cf: "03718840360", delegaPagamento: "SI", cds: "SI", tipologia: "PRIVATA", ratingMax: 5, aggiornato: "2026-04-15" },
  { id: "10", nome: "SICURTRANSPOSPORT SPA", clienti: 0, cf: "00119850824", tipologia: "PRIVATA", ratingMax: 4, aggiornato: "2026-04-14" },
  { id: "11", nome: "T.ERRE S.R.L.", clienti: 0, cf: "00376550364", tipologia: "PRIVATA", aggiornato: "2026-04-14" },
  { id: "12", nome: "LAMPO77 SRL", clienti: 0, cf: "01849340359", descrizione: "SMALL BUSINESS 9 DIPENDENTI", delegaPagamento: "NO", tipologia: "SMALL BUSINESS", aggiornato: "2026-04-14" },
  { id: "13", nome: "TRASCOOP E SERVIZI S.C.R.L.", clienti: 0, cf: "00512281205", cds: "SI", tipologia: "PRIVATA", aggiornato: "2026-04-14" },
  { id: "14", nome: "SKILL LOGISTICS SOCIETA' COOPERATIVA", clienti: 0, cf: "10626970965", tipologia: "PRIVATA", ratingMax: 5, aggiornato: "2026-04-12" },
  { id: "15", nome: "DANA MOTION SYSTEMS ITALIA S.R.L.", clienti: 0, cf: "00262750359", tipologia: "PRIVATA", ratingMax: 5, aggiornato: "2026-04-11" },
  { id: "16", nome: "SIMI srl", clienti: 0, cf: "02884260171", tipologia: "PRIVATA", ratingMax: 4, aggiornato: "2026-04-15" },
  { id: "17", nome: "COMUNE DI FERRARA", clienti: 0, descrizione: "comune.ferrara@cert.comune...", delegaPagamento: "SI", tipologia: "PUBBLICA", aggiornato: "2026-04-09" },
  { id: "18", nome: "GENERAL FACILITY SRL", clienti: 0, cf: "11275130968", tipologia: "PRIVATA", ratingMax: 3, aggiornato: "2026-04-09" },
  { id: "19", nome: "ITALCAB SPA", clienti: 0, cf: "01123510263", tipologia: "PRIVATA", ratingMax: 5, aggiornato: "2026-04-08" },
  { id: "20", nome: "MAGLI INTERMODAL SERVICE S.r.l.", clienti: 0, cf: "02869320172", tipologia: "PRIVATA", ratingMax: 4, aggiornato: "2026-04-07" },
  { id: "21", nome: "C.I.P.I. S.R.L.", clienti: 0, cf: "02663840185", tipologia: "PRIVATA", ratingMax: 5, aggiornato: "2026-04-07" },
  { id: "22", nome: "ANDREANA SRL", clienti: 0, cf: "02611750189", tipologia: "", ratingMax: 4, aggiornato: "2026-04-01" },
  { id: "23", nome: "COCIF SOC COOP", clienti: 0, cf: "00124220401", tipologia: "COOPERATIVA", ratingMax: 5, aggiornato: "2026-03-31" },
  { id: "24", nome: "Lavanderia L.S.G. SRL", clienti: 0, cf: "03160710277", descrizione: "PRIME", tipologia: "PRIVATA", ratingMax: 6, aggiornato: "2026-03-20" },
  { id: "25", nome: "TECNEL TECNOLOGIE ELETTRONICHE SRL", clienti: 0, cf: "02227310246", tipologia: "SMALL BUSINESS", ratingMax: 4, aggiornato: "2026-03-26" },
  { id: "26", nome: "MICROPLAN ITALIA SRL", clienti: 0, cf: "01635850025", tipologia: "PRIVATA", ratingMax: 8, aggiornato: "2026-03-25" },
  { id: "27", nome: "OLD SAX SRL", clienti: 0, cf: "03262400363", descrizione: "NON ASSUMIBILE PERCHE'...", tipologia: "SMALL BUSINESS", aggiornato: "2026-03-24" },
  { id: "28", nome: "INPS", clienti: 1, delegaPagamento: "NO", tipologia: "PUBBLICA", aggiornato: "2026-03-24" },
  { id: "29", nome: "INPDAP", clienti: 0, delegaPagamento: "NO", tipologia: "PUBBLICA", aggiornato: "2026-03-24" },
  { id: "30", nome: "INARCASSA", clienti: 0, descrizione: "QUOTA CEDIBILE RICHIESTA...", delegaPagamento: "NO", tipologia: "SMALL BUSINESS", aggiornato: "2026-03-24" },
  { id: "31", nome: "FLEXILOG ITALIA SRL", clienti: 0, descrizione: "P.IVA 03240890164 - NON A...", tipologia: "CESSATA", ratingMax: 1, aggiornato: "2026-03-24" },
  { id: "32", nome: "GOLD ART CERAMICA S.P.A.", clienti: 0, descrizione: "RESPONSABILE DEL PERSONALE...", tipologia: "", aggiornato: "2026-03-23" },
  { id: "33", nome: "VILLA TORRI HOSPITAL SRL", clienti: 0, tipologia: "", aggiornato: "2026-03-23" },
  { id: "34", nome: "COMUNE DI BOLOGNA", clienti: 0, descrizione: "DELEGA POSSIBILE AL 13%...", tipologia: "", aggiornato: "2026-03-23" },
  { id: "35", nome: "AUSL BOLOGNA", clienti: 0, descrizione: "DELEGAZIONE POSSIBILE AL...", delegaPagamento: "SI", tipologia: "PUBBLICA", aggiornato: "2026-03-24" },
  { id: "36", nome: "RTS BOLOGNA", clienti: 0, tipologia: "", aggiornato: "2026-03-23" },
  { id: "37", nome: "COOPERATIVA IL CERCHIO", clienti: 0, descrizione: "580 DIPENDENTI AL 08-2023", tipologia: "", aggiornato: "2026-03-23" },
  { id: "38", nome: "AMSA SPA", clienti: 0, descrizione: "NON RILASCIANO CDS NE A...", tipologia: "", aggiornato: "2026-03-23" },
  { id: "39", nome: "EFFE.GI.BI DI GAZZOTTI & C. SPA", clienti: 0, descrizione: "Codice Fiscale: 01149300377", tipologia: "", aggiornato: "2026-03-23" },
  { id: "40", nome: "INOVYS LOGISTIC SPA", clienti: 0, cf: "10077340965", descrizione: "NET FORZA 5 IBL", tipologia: "PRIVATA", ratingMax: 5, aggiornato: "2026-03-30" },
  { id: "41", nome: "CENTRO SOCIALE PAPA GIOVANNI XXIII SCS-ONLUS", clienti: 0, tipologia: "", aggiornato: "2026-03-23" },
  { id: "42", nome: "BCUBE SPA", clienti: 0, descrizione: "Codice Fiscale 01700360157...", delegaPagamento: "NO", tipologia: "", aggiornato: "2026-03-23" },
  { id: "43", nome: "RIA GRANT THORNTON S.P.A.", clienti: 0, tipologia: "", aggiornato: "2026-03-23" },
  { id: "44", nome: "FLORIM S.P.A.", clienti: 0, tipologia: "", aggiornato: "2026-03-23" },
  { id: "45", nome: "HERA", clienti: 0, tipologia: "PARAPUBBLICA", aggiornato: "2026-03-24" },
  { id: "46", nome: "RUBBI SRL", clienti: 0, descrizione: "P.IVA 02180701209", tipologia: "", aggiornato: "2026-03-23" },
  { id: "47", nome: "YOOX NET-A-PORTER GROUP SPA", clienti: 0, descrizione: "P.IVA 02050461207", tipologia: "", aggiornato: "2026-03-23" },
  { id: "48", nome: "FESTO S.P.A.", clienti: 0, descrizione: "P.IVA 02235250152", tipologia: "", aggiornato: "2026-03-23" },
  { id: "49", nome: "CAV. UMBERTO BOSCHI S.P.A.", clienti: 0, descrizione: "PER ABLONDI HA ACCETTATO...", tipologia: "", aggiornato: "2026-03-23" },
  { id: "50", nome: "A.T.G. srl", clienti: 0, descrizione: "Codice Fiscale: 01611560606...", tipologia: "", aggiornato: "2026-03-23" },
  { id: "51", nome: "UNIBO - ALMAMATER", clienti: 0, descrizione: "- NON ACCETTA DELEGHE", tipologia: "", aggiornato: "2026-03-23" },
  { id: "52", nome: "GIACOMO BRODOLINI SCARL", clienti: 0, descrizione: "P.IVA 00326860384", tipologia: "", aggiornato: "2026-03-23" },
  { id: "53", nome: "TRENITALIA TPER SCARL", clienti: 0, descrizione: "CF: 03553671201", delegaPagamento: "SI", tipologia: "PARAPUBBLICA", aggiornato: "2026-03-23" },
  { id: "54", nome: "ALCAST TECH FOUNDRY & MACHINING S.R.L.", clienti: 0, descrizione: "CF: 04130811203", tipologia: "", aggiornato: "2026-03-23" },
  { id: "55", nome: "AUTOMOBILI LAMBORGHINI SPA", clienti: 0, descrizione: "NEL CDS NON VI E' DIVIETO ALLA DELEGA. P.IVA 03049840387", delegaPagamento: "SI", cds: "SI", tipologia: "PRIVATA", citta: "Bologna", cap: "40100", provincia: "Emilia Romagna", paese: "IT", aggiornato: "2026-04-21" },
  { id: "56", nome: "GIERRE SRL", clienti: 0, descrizione: "*** ACCETTA DELEGHE ***", delegaPagamento: "SI", tipologia: "", aggiornato: "2026-03-23" },
  { id: "57", nome: "RTS FERRARA", clienti: 0, tipologia: "", aggiornato: "2026-03-23" },
  { id: "58", nome: "L'UNITARIA LOGISTICA SOC COOP", clienti: 0, cf: "13457410150", descrizione: "C.F. 13457410150", delegaPagamento: "NO", tipologia: "PRIVATA", ratingMax: 5, aggiornato: "2026-04-24" },
  { id: "59", nome: "TECNORD SRL", clienti: 0, descrizione: "P.IVA 03098290376", tipologia: "", aggiornato: "2026-03-23" },
  { id: "60", nome: "CAPGEMINI ITALIA SPA", clienti: 0, descrizione: "P.IVA 10365640159", tipologia: "", aggiornato: "2026-03-23" },
  { id: "61", nome: "AUSL SANT'ORSOLA", clienti: 0, descrizione: "OSPEDALE UNIVERSITARIO", tipologia: "", aggiornato: "2026-03-23" },
  { id: "62", nome: "ISTITUTO ORTOPEDICO RIZZOLI (IOR)", clienti: 0, descrizione: "amministrazione.personale@...", delegaPagamento: "SI", tipologia: "", aggiornato: "2026-03-31" },
  { id: "63", nome: "SERVIZI LOGISTICI INTEGRATI SRL", clienti: 0, descrizione: "P. IVA 07405040721", tipologia: "", aggiornato: "2026-03-23" },
  { id: "64", nome: "NAZCA S.R.L.", clienti: 0, descrizione: "P.IVA 10982090150", tipologia: "", aggiornato: "2026-03-23" },
  { id: "65", nome: "ANAS SPA", clienti: 0, descrizione: "PARAPUBBLICA - PUBBLICA", tipologia: "", aggiornato: "2026-03-23" },
];

const AZIENDE_ITEMS_KEY = "aziende-menu-items";
const AZIENDE_DELETED_KEY = "aziende-menu-deleted";
const normalizeAziendaName = (value: string) => value.trim().toLowerCase();
const loadDeletedAziende = () => new Set(loadPersisted<string[]>(AZIENDE_DELETED_KEY, []));
const loadAziendeItems = () => {
  const deleted = loadDeletedAziende();
  return loadPersisted<Azienda[]>(AZIENDE_ITEMS_KEY, SEED).filter((a) => !deleted.has(normalizeAziendaName(a.nome)));
};
const persistAziendeItems = (items: Azienda[]) => savePersisted(AZIENDE_ITEMS_KEY, items);
const persistDeletedAziende = (deleted: Set<string>) => savePersisted(AZIENDE_DELETED_KEY, [...deleted]);

const TIP_STYLES: Record<Exclude<Tipologia, "">, string> = {
  PRIVATA: "bg-emerald-100 text-emerald-700",
  PUBBLICA: "bg-sky-100 text-sky-700",
  PARAPUBBLICA: "bg-amber-100 text-amber-700",
  COOPERATIVA: "bg-teal-100 text-teal-700",
  "SMALL BUSINESS": "bg-emerald-100 text-emerald-700",
  CESSATA: "bg-rose-100 text-rose-700",
};

function TipologiaBadge({ value }: { value: Tipologia }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide", TIP_STYLES[value])}>
      {value}
    </span>
  );
}

function YesNoBadge({ value }: { value?: SiNo }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cls = value === "SI" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
  return <span className={cn("inline-flex rounded px-2 py-0.5 text-[11px] font-semibold", cls)}>{value}</span>;
}

function RatingBadge({ value }: { value?: number }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const color =
    value >= 6 ? "bg-emerald-500" : value >= 4 ? "bg-amber-500" : value >= 2 ? "bg-rose-500" : "bg-rose-600";
  return (
    <span className={cn("inline-grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white", color)}>
      {value}
    </span>
  );
}

function emptyAzienda(): Azienda {
  return {
    id: crypto.randomUUID(),
    nome: "",
    clienti: 0,
    tipologia: "PRIVATA",
    aggiornato: new Date().toISOString().slice(0, 10),
    rating: {},
  };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const m = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${String(d.getDate()).padStart(2, "0")} ${m[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function AziendePage() {
  const [items, setItems] = useState<Azienda[]>(() => loadAziendeItems());
  const [deletedNames, setDeletedNames] = useState<Set<string>>(() => loadDeletedAziende());
  const sharedAziende = useAziendeShared();
  const { clienti } = useClientiStore();
  const clientiCountByAzienda = useMemo(() => {
    const map = new Map<string, number>();
    clienti.forEach((c) => {
      const key = (c.azienda ?? "").trim().toLowerCase();
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [clienti]);
  const countFor = (nome: string) =>
    clientiCountByAzienda.get(nome.trim().toLowerCase()) ?? 0;

  // Sincronizzazione bidirezionale con lo store condiviso usato dal form Nuovo Lead.
  // 1) Pubblica le aziende locali (per nome) nello store condiviso al mount.
  useEffect(() => {
    deletedNames.forEach((name) => aziendeStore.removeByName(name));
    items.forEach((a) => {
      if (!deletedNames.has(normalizeAziendaName(a.nome)) && !aziendeStore.findByName(a.nome)) {
        aziendeStore.add({ nome: a.nome, partitaIva: a.cf, cf: a.cf });
      }
    });
  }, [items, deletedNames]);

  // 2) Se il form Nuovo Lead crea una nuova azienda, importala anche qui.
  useEffect(() => {
    setItems((prev) => {
      let next = prev;
      sharedAziende.forEach((a) => {
        if (deletedNames.has(normalizeAziendaName(a.nome))) return;
        const existsLocally = next.some((it) => normalizeAziendaName(it.nome) === normalizeAziendaName(a.nome));
        if (!existsLocally) {
          next = [
            {
              id: a.id,
              nome: a.nome,
              cf: a.partitaIva ?? a.cf,
              clienti: 0,
              tipologia: "PRIVATA",
              aggiornato: new Date().toISOString().slice(0, 10),
            },
            ...next,
          ];
        }
      });
      if (next !== prev) persistAziendeItems(next);
      return next;
    });
  }, [sharedAziende, deletedNames]);

  // 3) Auto-popola la P.IVA / CF azienda pescandola dalla scheda cliente
  //    quando un cliente ha sia "azienda" che "partitaIva" valorizzati.
  //    Se l'azienda non esiste ancora la creiamo automaticamente.
  useEffect(() => {
    const pivaByAzienda = new Map<string, string>();
    const nomeOriginale = new Map<string, string>();
    clienti.forEach((c) => {
      const nome = (c.azienda ?? "").trim();
      const piva = (c.partitaIva ?? "").trim();
      if (!nome || !piva) return;
      const key = nome.toLowerCase();
      if (!pivaByAzienda.has(key)) {
        pivaByAzienda.set(key, piva);
        nomeOriginale.set(key, nome);
      }
    });
    if (pivaByAzienda.size === 0) return;
    setItems((prev) => {
      let changed = false;
      const next: Azienda[] = prev.map((a) => {
        const piva = pivaByAzienda.get(normalizeAziendaName(a.nome));
        if (piva && a.cf !== piva) {
          changed = true;
          return { ...a, cf: piva };
        }
        return a;
      });
      // Crea aziende mancanti
      const existingKeys = new Set(next.map((a) => normalizeAziendaName(a.nome)));
      pivaByAzienda.forEach((piva, key) => {
        if (existingKeys.has(key)) return;
        if (deletedNames.has(key)) return;
        changed = true;
        next.unshift({
          id: crypto.randomUUID(),
          nome: nomeOriginale.get(key) ?? key,
          cf: piva,
          clienti: 0,
          tipologia: "PRIVATA",
          aggiornato: new Date().toISOString().slice(0, 10),
        });
      });
      if (!changed) return prev;
      persistAziendeItems(next);
      return next;
    });
  }, [clienti, deletedNames]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<"" | Tipologia>("");
  const [editing, setEditing] = useState<Azienda | null>(null);
  const [isNew, setIsNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) => (filterTipo ? a.tipologia === filterTipo : true))
      .filter((a) =>
        q
          ? [a.nome, a.cf, a.descrizione, a.citta]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          : true,
      );
  }, [items, query, filterTipo]);

  const allFilteredIds = useMemo(() => new Set(filtered.map((a) => a.id)), [filtered]);
  const isAllSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };

  const handleDeleteMany = () => {
    if (selectedIds.size === 0) return;
    setItems((prev) => {
      const removed = prev.filter((p) => selectedIds.has(p.id));
      const next = prev.filter((p) => !selectedIds.has(p.id));
      persistAziendeItems(next);
      const nextDeleted = new Set(deletedNames);
      removed.forEach((r) => {
        nextDeleted.add(normalizeAziendaName(r.nome));
        aziendeStore.removeByName(r.nome);
      });
      setDeletedNames(nextDeleted);
      persistDeletedAziende(nextDeleted);
      return next;
    });
    toast.success(`${selectedIds.size} aziende eliminate`);
    setSelectedIds(new Set());
  };

  const openNew = () => {
    setEditing(emptyAzienda());
    setIsNew(true);
  };
  const openEdit = (a: Azienda) => {
    setEditing({ ...a, rating: { ...(a.rating ?? {}) } });
    setIsNew(false);
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast.error("Inserisci il nome dell'azienda");
      return;
    }
    const ratingValues = Object.values(editing.rating ?? {}).filter(
      (v): v is number => typeof v === "number" && v > 0,
    );
    const computedRatingMax = ratingValues.length ? Math.max(...ratingValues) : undefined;
    setItems((prev) => {
      const exists = prev.some((p) => p.id === editing.id);
      const updated = {
        ...editing,
        ratingMax: computedRatingMax,
        aggiornato: new Date().toISOString().slice(0, 10),
      };
      const next = exists ? prev.map((p) => (p.id === editing.id ? updated : p)) : [updated, ...prev];
      persistAziendeItems(next);
      return next;
    });
    const nameKey = normalizeAziendaName(editing.nome);
    if (deletedNames.has(nameKey)) {
      const nextDeleted = new Set(deletedNames);
      nextDeleted.delete(nameKey);
      setDeletedNames(nextDeleted);
      persistDeletedAziende(nextDeleted);
    }
    if (!aziendeStore.findByName(editing.nome)) {
      aziendeStore.add({ nome: editing.nome.trim(), partitaIva: editing.cf, cf: editing.cf });
    }
    toast.success(isNew ? "Azienda creata" : "Azienda aggiornata");
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    setItems((prev) => {
      const removed = prev.find((p) => p.id === id);
      const next = prev.filter((p) => p.id !== id);
      persistAziendeItems(next);
      if (removed) {
        const nextDeleted = new Set(deletedNames);
        nextDeleted.add(normalizeAziendaName(removed.nome));
        setDeletedNames(nextDeleted);
        persistDeletedAziende(nextDeleted);
        aziendeStore.removeByName(removed.nome);
      }
      return next;
    });
    toast.success("Azienda eliminata");
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      toast.error("CSV vuoto o non valido");
      return;
    }
    const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
    const idx = (k: string) => headers.findIndex((h) => h === k);
    const iNome = idx("nome");
    const iCf = idx("cf");
    const iTipo = idx("tipologia");
    const iDesc = idx("descrizione");
    if (iNome < 0) {
      toast.error("Il CSV deve avere almeno la colonna 'nome'");
      return;
    }
    const rows = lines
      .slice(1)
      .map((line, i) => {
        const cols = line.split(/[,;]/).map((c) => c.trim());
        return {
          id: `imp-${Date.now()}-${i}`,
          nome: cols[iNome] ?? "",
          cf: iCf >= 0 ? cols[iCf] : undefined,
          tipologia: (iTipo >= 0 ? (cols[iTipo].toUpperCase() as Tipologia) : "PRIVATA"),
          descrizione: iDesc >= 0 ? cols[iDesc] : undefined,
          clienti: 0,
          aggiornato: new Date().toISOString().slice(0, 10),
        } satisfies Azienda;
      })
      .filter((r) => r.nome);
    setItems((prev) => {
      const next = [...rows, ...prev];
      persistAziendeItems(next);
      return next;
    });
    toast.success(`Importate ${rows.length} aziende`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Aziende</h1>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {items.length} Aziende
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteMany}
            >
              <Trash2 className="h-4 w-4" /> Cancella {selectedIds.size} selezionate
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuova Azienda
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as "" | Tipologia)}
            className="h-9 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm"
          >
            <option value="">Tipologia: Tutto</option>
            <option value="PRIVATA">Privata</option>
            <option value="PUBBLICA">Pubblica</option>
            <option value="PARAPUBBLICA">Parapubblica</option>
            <option value="COOPERATIVA">Cooperativa</option>
            <option value="SMALL BUSINESS">Small Business</option>
            <option value="CESSATA">Cessata</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda, CF, città..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
        Sono pre-caricate {items.length} aziende visibili dalla clip di riferimento. Per importare le 646 complessive
        esporta un CSV dal sistema attuale (colonne: <code>nome,cf,tipologia,descrizione</code>) e usa{" "}
        <strong>Import CSV</strong>.
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-center">Clienti</TableHead>
              <TableHead>C.F.</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-center">Del. Pag.</TableHead>
              <TableHead className="text-center">CDS</TableHead>
              <TableHead>Tipologia</TableHead>
              <TableHead className="text-center">Rating Max</TableHead>
              <TableHead>Aggiornato</TableHead>
              <TableHead className="w-20 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  Nessuna azienda trovata
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                    />
                  </TableCell>
                  <TableCell className="font-semibold">{a.nome}</TableCell>
                   <TableCell className="text-center">
                     {(() => {
                       const n = countFor(a.nome);
                       return n > 0 ? (
                         <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-bold text-violet-700">
                           {n}
                         </span>
                       ) : (
                         <span className="text-muted-foreground">0</span>
                       );
                     })()}
                   </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.cf || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {a.descrizione || "—"}
                  </TableCell>
                  <TableCell className="text-center"><YesNoBadge value={a.delegaPagamento} /></TableCell>
                  <TableCell className="text-center"><YesNoBadge value={a.cds} /></TableCell>
                  <TableCell><TipologiaBadge value={a.tipologia} /></TableCell>
                  <TableCell className="text-center"><RatingBadge value={a.ratingMax} /></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(a.aggiornato)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {isNew ? "Nuova Azienda" : "Modifica Azienda"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome Azienda *</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  placeholder="Es. AUTOMOBILI LAMBORGHINI SPA"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Telefono</Label>
                  <Input value={editing.telefono ?? ""} onChange={(e) => setEditing({ ...editing, telefono: e.target.value })} placeholder="+39 051 123456" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="info@azienda.it" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Sito Web</Label>
                <Input value={editing.sitoWeb ?? ""} onChange={(e) => setEditing({ ...editing, sitoWeb: e.target.value })} placeholder="https://www.azienda.it" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Città</Label>
                  <Input value={editing.citta ?? ""} onChange={(e) => setEditing({ ...editing, citta: e.target.value })} placeholder="Bologna" />
                </div>
                <div className="space-y-1.5">
                  <Label>CAP</Label>
                  <Input value={editing.cap ?? ""} onChange={(e) => setEditing({ ...editing, cap: e.target.value })} placeholder="40100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Provincia</Label>
                  <Input value={editing.provincia ?? ""} onChange={(e) => setEditing({ ...editing, provincia: e.target.value })} placeholder="Emilia Romagna" />
                </div>
                <div className="space-y-1.5">
                  <Label>Paese</Label>
                  <Input value={editing.paese ?? ""} onChange={(e) => setEditing({ ...editing, paese: e.target.value })} placeholder="IT" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Indirizzo</Label>
                <Input value={editing.indirizzo ?? ""} onChange={(e) => setEditing({ ...editing, indirizzo: e.target.value })} placeholder="Via Roma 1" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipologia</Label>
                  <select
                    value={editing.tipologia}
                    onChange={(e) => setEditing({ ...editing, tipologia: e.target.value as Tipologia })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="PRIVATA">PRIVATA</option>
                    <option value="PUBBLICA">PUBBLICA</option>
                    <option value="PARAPUBBLICA">PARAPUBBLICA</option>
                    <option value="COOPERATIVA">COOPERATIVA</option>
                    <option value="SMALL BUSINESS">SMALL BUSINESS</option>
                    <option value="CESSATA">CESSATA</option>
                    <option value="">—</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Del. Pagamento</Label>
                  <select
                    value={editing.delegaPagamento ?? ""}
                    onChange={(e) => setEditing({ ...editing, delegaPagamento: e.target.value as SiNo })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Seleziona...</option>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Codice Fiscale</Label>
                  <Input value={editing.cf ?? ""} onChange={(e) => setEditing({ ...editing, cf: e.target.value })} placeholder="12345678901" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>CDS</Label>
                  <select
                    value={editing.cds ?? ""}
                    onChange={(e) => setEditing({ ...editing, cds: e.target.value as SiNo })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Seleziona...</option>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rating Compagnie Assicurative</Label>
                <div className="rounded-md border border-border">
                  <div className="grid grid-cols-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Compagnia</span>
                    <span className="text-right">Rating</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {COMPAGNIE.map((c) => (
                      <div key={c} className="grid grid-cols-2 items-center border-b border-border/60 px-3 py-1.5 last:border-0">
                        <span className="text-sm font-medium">{c}</span>
                        <select
                          value={editing.rating?.[c] ?? 0}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              rating: { ...(editing.rating ?? {}), [c]: Number(e.target.value) },
                            })
                          }
                          className="ml-auto h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Il rating max (1-6) verrà calcolato automaticamente.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Note / Descrizione</Label>
                <Textarea
                  rows={3}
                  value={editing.note ?? editing.descrizione ?? ""}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value, descrizione: e.target.value })}
                  placeholder="Note operative..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={handleSave}>{isNew ? "Crea Azienda" : "Aggiorna"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}