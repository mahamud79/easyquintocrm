import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bold,
  ChevronDown,
  Clock,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Mail,
  MessageSquare,
  Mic,
  Paperclip,
  Phone,
  Search,
  Send,
  Smartphone,
  Star,
  Strikethrough,
  Underline,
  Globe,
  StickyNote,
  RotateCcw,
  Trash2,
  Calendar as CalendarIcon,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useClientiStore, type Cliente } from "@/lib/clienti-store";
import { clientiStore } from "@/lib/clienti-store";
import { praticheActions } from "@/lib/pratiche-store";
import { useLeadsStore, LEAD_STAGES, type LeadStageKey } from "@/lib/leads-store";
import { leadsStore } from "@/lib/leads-store";
import { usePreventiviStore, type Preventivo } from "@/lib/preventivi-store";
import { useCompagnie } from "@/lib/compagnie-store";
import { conversationsStore } from "@/lib/conversations-store";
import { useOptionList } from "@/lib/option-lists-store";
import CodiceFiscale from "codice-fiscale-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { COMUNI_LIST, findComune } from "@/lib/comuni";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { useServerFn } from "@tanstack/react-start";
import { lookupPartitaIva } from "@/lib/vies.functions";

const SEX_OPTS = ["M", "F", "Altro"];
const CITTADINANZA_OPTS = ["Italiana", "UE", "Extra UE"];
const TIPO_LAVORO_OPTS = [
  "Dipendente pubblico",
  "Dipendente privato",
  "Pensionato",
  "Autonomo",
  "Disoccupato",
];
const SETTORE_ATC_OPTS = [
  "Statale",
  "Para-Statale",
  "Pubblico",
  "Privato",
  "Cooperativa",
  "Pensionato INPS",
];
const REDDITO_OPTS = ["Nessun reddito", "Reddito da lavoro", "Pensione", "Affitti", "Altro"];
const CRIF_OPTS = ["Pulita", "Ritardi", "Segnalato", "Da verificare"];

const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { name: parts[0] ?? "", surname: "" };
  return { name: parts.slice(0, -1).join(" "), surname: parts.at(-1) ?? "" };
};

const formatAge = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "";
  return `${years} ${years === 1 ? "anno" : "anni"} e ${months} ${months === 1 ? "mese" : "mesi"}`;
};
const compose = (n: string, s: string) =>
  [n, s]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" ");
const asNull = (v?: string | null) => (v?.trim() ? v.trim() : null);
const asNum = (v?: string | null) => {
  if (!v?.trim()) return null;
  // Accept both Italian ("1.710,00") and dot-decimal ("1710.00") inputs.
  const s = v.trim();
  const hasComma = s.includes(",");
  const normalized = hasComma ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};
const fromNum = (n: number | null) => (n == null ? "" : String(n));

export const Route = createFileRoute("/_authenticated/clienti/$id")({
  head: () => ({ meta: [{ title: "Scheda cliente · LeadValue" }] }),
  component: ClienteDetailPage,
});

type LeftTab = "campi" | "azioni" | "preventivi";
type Channel = "tutti" | "whatsapp" | "email" | "sms" | "nota";

type MsgChannel = "whatsapp" | "email" | "sms";
type ThreadEvent =
  | { kind: "status"; text: string; at: string; channel?: MsgChannel }
  | { kind: "system"; text: string; at: string; channel?: MsgChannel }
  | { kind: "msg"; from: "me" | "them"; text: string; at: string; channel: MsgChannel };

const initialThread: ThreadEvent[] = [
  { kind: "status", text: "Risposta ricevuta", at: "17 mag 23:20" },
  {
    kind: "system",
    text: 'Entrato automaticamente nel workflow "Invito Newsletter"',
    at: "20 mag 13:00",
  },
  {
    kind: "system",
    text: 'Workflow fermato dopo 4 tentativi falliti su "Email 1 - Invito iniziale"',
    at: "26 mag 23:00",
  },
];

const NOTE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#a78bfa",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
];

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const { user } = useAuth();
  const { clienti, updateCliente, deleteCliente } = useClientiStore();
  const { leads, updateLead } = useLeadsStore();
  const fontiLead = useOptionList("fonti_lead");
  const cliente = useMemo(() => clienti.find((c) => c.id === id), [clienti, id]);
  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id]);

  // Derive the province from the typed/selected birth place (Italian comune lookup)
  const birthProvince = useMemo(
    () => findComune(cliente?.birthPlace)?.provincia ?? "",
    [cliente?.birthPlace],
  );

  // Derive the province from the typed/selected residence city (Italian comune lookup)
  const residenceProvince = useMemo(
    () => findComune(cliente?.residenceCity)?.provincia ?? "",
    [cliente?.residenceCity],
  );

  // Keep the stored province in sync with the auto-derived one from the residence city
  useEffect(() => {
    if (!cliente) return;
    if (residenceProvince && residenceProvince !== cliente.province) {
      updateCliente(cliente.id, { province: residenceProvince });
    }
  }, [cliente?.id, residenceProvince]);

  // Auto-compute Italian fiscal code from name + surname + birth date + sex + birth place
  useEffect(() => {
    if (!cliente) return;
    const { name, surname } = splitName(cliente.name);
    const sur = cliente.surname ?? surname;
    const sex = cliente.sex === "F" ? "F" : cliente.sex === "M" ? "M" : "";
    if (!name || !sur || !cliente.birthDate || !sex || !cliente.birthPlace) return;
    try {
      const [y, m, d] = cliente.birthDate.split("-").map((n) => parseInt(n, 10));
      if (!y || !m || !d) return;
      const cf = new CodiceFiscale({
        name,
        surname: sur,
        gender: sex,
        day: d,
        month: m,
        year: y,
        birthplace: cliente.birthPlace,
        birthplaceProvincia: findComune(cliente.birthPlace)?.provincia ?? "",
      });
      const code = cf.cf as string;
      if (code && code !== cliente.fiscalCode) {
        updateCliente(cliente.id, { fiscalCode: code });
      }
    } catch {
      // birthplace not recognized or invalid input — leave the field untouched
    }
  }, [
    cliente?.id,
    cliente?.name,
    cliente?.surname,
    cliente?.birthDate,
    cliente?.sex,
    cliente?.birthPlace,
  ]);

  useEffect(() => {
    if (cliente) return;
    const lead = leads.find((l) => l.id === id);
    if (lead) {
      clientiStore.ensure({ id: lead.id, name: lead.name, phone: lead.phone, email: lead.email });
    }
  }, [cliente, id, leads]);

  // Quando la scheda si apre per un lead, copia i campi rilevanti che il
  // form di nuovo lead chiede: note, azienda, fonte. Lo facciamo una volta
  // sola — l'utente può poi modificare liberamente.
  useEffect(() => {
    if (!cliente) return;
    const fromLead = leads.find((l) => l.id === cliente.id);
    if (!fromLead) return;
    const patch: Partial<Cliente> = {};
    if (fromLead.notes && !cliente.notes) patch.notes = fromLead.notes;
    if (fromLead.company && fromLead.company !== "Privato" && !cliente.azienda) {
      patch.azienda = fromLead.company;
    }
    if (fromLead.source && !cliente.provenienzaLead) patch.provenienzaLead = fromLead.source;
    if (Object.keys(patch).length > 0) updateCliente(cliente.id, patch);
  }, [cliente?.id, leads]);

  // Mantieni il nominativo e l'azienda delle pratiche del kanban allineati
  // a quanto scritto nella scheda cliente (case-sensitive incluso).
  useEffect(() => {
    if (!cliente) return;
    praticheActions.syncClienteForCliente(
      { id: cliente.id, name: cliente.name },
      cliente.azienda ?? null,
    );
  }, [cliente?.id, cliente?.name, cliente?.azienda]);

  const [leftTab, setLeftTab] = useState<LeftTab>("campi");
  const [channel, setChannel] = useState<Channel>("tutti");
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<ThreadEvent[]>(initialThread);
  const [noteBody, setNoteBody] = useState("");
  type NoteFile = { name: string; type: string; size: number; url: string };
  const [noteFiles, setNoteFiles] = useState<NoteFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cardReady, setCardReady] = useState(false);

  const notes = cliente?.noteEntries ?? [];

  // Seed first note from lead note (created in nuovo-lead) the first time the
  // scheda opens, so the user finds it already saved in the side panel.
  useEffect(() => {
    if (!cliente) return;
    if ((cliente.noteEntries?.length ?? 0) > 0) return;
    if (!cliente.notes?.trim()) return;
    updateCliente(cliente.id, {
      noteEntries: [
        {
          id: crypto.randomUUID(),
          body: cliente.notes,
          files: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }, [cliente?.id, cliente?.notes]);

  useEffect(() => {
    setCardReady(false);
  }, [id, user?.id]);

  useEffect(() => {
    if (!user || !cliente || cardReady) return;
    let cancelled = false;
    supabase
      .from("lead_cards")
      .select("*")
      .eq("lead_key", `cli-${cliente.id}`)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Impossibile caricare la scheda cliente");
          setCardReady(true);
          return;
        }
        if (data) {
          updateCliente(cliente.id, {
            name: data.full_name || cliente.name,
            surname: data.surname ?? splitName(cliente.name).surname,
            phone: data.phone ?? cliente.phone,
            phone2: data.phone2 ?? "",
            email: data.email ?? cliente.email,
            engagement: data.engagement ?? "",
            birthDate: data.birth_date ?? "",
            fiscalCode: data.fiscal_code ?? "",
            sex: data.sex ?? "",
            citizenship: data.citizenship ?? "",
            residenceCity: data.residence_city ?? "",
            province: data.province ?? "",
            address: data.address ?? "",
            tipoLavoro: data.tipo_lavoro ?? "",
            azienda: data.azienda ?? "",
            partitaIva: data.partita_iva ?? "",
            dataAssunzione: data.data_assunzione ?? "",
            stipendioNetto: fromNum(data.stipendio_netto),
            redditoAggiuntivo: fromNum(data.reddito_aggiuntivo),
            tfrAzienda: fromNum(data.tfr_azienda),
            tfrFondo: fromNum(data.tfr_fondo),
            crif: data.crif ?? "",
            impegniMensili: fromNum(data.impegni_mensili),
            provenienzaLead: data.provenienza_lead ?? "",
            tipoContatto: data.tipo_contatto ?? "",
            priorita: data.priorita ?? "",
            recallDate: data.recall_date ?? "",
            notes: data.notes ?? "",
            tipologiaAbitazione: data.tipologia_abitazione ?? "",
            familiariCarico: data.familiari_carico ?? "",
            relazione: data.relazione ?? "",
            prodottiInteresse: data.prodotti_interesse ?? [],
            privacyTrattamento: data.privacy_trattamento,
            privacyMarketing: data.privacy_marketing,
          });
        }
        setCardReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cardReady, cliente, updateCliente, user]);

  useEffect(() => {
    if (!user || !cliente || !cardReady) return;
    const sn = splitName(cliente.name);
    const name = cliente.surname !== undefined ? sn.name : sn.name;
    const surname = cliente.surname ?? sn.surname;
    const payload = {
      user_id: user.id,
      lead_key: `cli-${cliente.id}`,
      name,
      surname,
      full_name: compose(name, surname) || cliente.name,
      phone: asNull(cliente.phone),
      phone2: asNull(cliente.phone2),
      email: asNull(cliente.email),
      engagement: asNull(cliente.engagement),
      birth_date: asNull(cliente.birthDate),
      fiscal_code: asNull(cliente.fiscalCode),
      sex: asNull(cliente.sex),
      citizenship: asNull(cliente.citizenship),
      residence_city: asNull(cliente.residenceCity),
      province: asNull(cliente.province),
      address: asNull(cliente.address),
      tipo_lavoro: asNull(cliente.tipoLavoro),
      azienda: asNull(cliente.azienda),
      partita_iva: asNull(cliente.partitaIva),
      data_assunzione: asNull(cliente.dataAssunzione),
      stipendio_netto: asNum(cliente.stipendioNetto),
      reddito_aggiuntivo: asNum(cliente.redditoAggiuntivo),
      tfr_azienda: asNum(cliente.tfrAzienda),
      tfr_fondo: asNum(cliente.tfrFondo),
      crif: asNull(cliente.crif),
      impegni_mensili: asNum(cliente.impegniMensili),
      provenienza_lead: asNull(cliente.provenienzaLead),
      tipo_contatto: asNull(cliente.tipoContatto),
      priorita: asNull(cliente.priorita),
      recall_date: asNull(cliente.recallDate),
      notes: asNull(cliente.notes),
      tipologia_abitazione: asNull(cliente.tipologiaAbitazione),
      familiari_carico: asNull(cliente.familiariCarico),
      relazione: asNull(cliente.relazione),
      prodotti_interesse: cliente.prodottiInteresse ?? [],
      privacy_trattamento: cliente.privacyTrattamento ?? false,
      privacy_marketing: cliente.privacyMarketing ?? false,
    };
    const t = window.setTimeout(() => {
      supabase
        .from("lead_cards")
        .upsert(payload, { onConflict: "user_id,lead_key" })
        .then(({ error }) => {
          if (error) toast.error("Modifica non salvata");
        });
    }, 350);
    return () => window.clearTimeout(t);
  }, [cardReady, cliente, user]);

  if (!cliente) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Cliente non trovato.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/clienti">Torna ai Clienti</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sendMessage = () => {
    if (!draft.trim()) return;
    const now = new Date();
    const at = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const ch: MsgChannel = channel === "tutti" || channel === "nota" ? "whatsapp" : channel;
    setThread((t) => [...t, { kind: "msg", from: "me", text: draft, at, channel: ch }]);
    // mirror into the shared Conversazioni store
    if (cliente) {
      conversationsStore.ensure({
        clientId: cliente.id,
        name: cliente.name,
        phone: cliente.phone,
        email: cliente.email,
      });
      conversationsStore.appendMessage(cliente.id, {
        from: "me",
        channel: ch,
        text: draft,
      });
    }
    setDraft("");
  };

  const saveNote = () => {
    if (!cliente) return;
    if (!noteBody.trim() && noteFiles.length === 0) return;
    const entry = {
      id: crypto.randomUUID(),
      body: noteBody,
      files: noteFiles,
      createdAt: new Date().toISOString(),
    };
    updateCliente(cliente.id, { noteEntries: [entry, ...(cliente.noteEntries ?? [])] });
    setNoteBody("");
    setNoteFiles([]);
  };

  const deleteNote = (noteId: string) => {
    if (!cliente) return;
    updateCliente(cliente.id, {
      noteEntries: (cliente.noteEntries ?? []).filter((n) => n.id !== noteId),
    });
  };

  const formatNoteAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const remaining = Math.max(0, 5 - noteFiles.length);
    const picked = Array.from(list).slice(0, remaining);
    Promise.all(
      picked.map(
        (f) =>
          new Promise<NoteFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ name: f.name, type: f.type, size: f.size, url: String(reader.result) });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(f);
          }),
      ),
    ).then((newOnes) => setNoteFiles((prev) => [...prev, ...newOnes]));
    e.target.value = "";
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.history.back();
              } else {
                navigate({ to: "/privati" });
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white",
              cliente.avatarColor,
            )}
          >
            {cliente.initials}
          </div>
          <div>
            <h1 className="text-base font-semibold">{cliente.name}</h1>
            <div className="text-xs text-muted-foreground">{cliente.phone ?? ""}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead ? (
            <Select
              value={lead.stage}
              onValueChange={(v) => updateLead(lead.id, { stage: v as LeadStageKey })}
            >
              <SelectTrigger className="h-9 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button variant="ghost" size="icon">
            <Clock className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: fields */}
        <aside className="flex w-72 flex-col border-r border-border bg-card">
          <div className="flex border-b border-border text-sm">
            {(
              [
                ["campi", "Tutti i campi"],
                ["preventivi", "Preventivi inviati"],
                ["azioni", "Azioni"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setLeftTab(k)}
                className={cn(
                  "flex-1 py-2 font-medium transition-colors",
                  leftTab === k
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {leftTab === "campi" && (
              <>
                <CollapsibleSection title="Contatto" defaultOpen>
                  <EditableText
                    label="Nome"
                    value={splitName(cliente.name).name}
                    onChange={(v) => {
                      const sur = cliente.surname ?? splitName(cliente.name).surname;
                      const full = compose(v, sur);
                      updateCliente(cliente.id, { name: full, surname: sur });
                      if (lead) updateLead(lead.id, { name: full, surname: sur });
                    }}
                  />
                  <EditableText
                    label="Cognome"
                    value={cliente.surname ?? splitName(cliente.name).surname}
                    onChange={(v) => {
                      const nm = splitName(cliente.name).name;
                      const full = compose(nm, v);
                      updateCliente(cliente.id, { name: full, surname: v });
                      if (lead) updateLead(lead.id, { name: full, surname: v });
                    }}
                  />
                  <EditableText
                    label="Telefono"
                    value={cliente.phone ?? ""}
                    onChange={(v) => {
                      updateCliente(cliente.id, { phone: v });
                      if (lead) updateLead(lead.id, { phone: v });
                    }}
                  />
                  <EditableText
                    label="Telefono secondario"
                    value={cliente.phone2 ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { phone2: v })}
                  />
                  <EditableText
                    label="Email"
                    value={cliente.email ?? ""}
                    onChange={(v) => {
                      updateCliente(cliente.id, { email: v });
                      if (lead) updateLead(lead.id, { email: v });
                    }}
                  />
                  <EditableSelect
                    label="Fonte"
                    value={cliente.provenienzaLead ?? ""}
                    options={fontiLead}
                    onChange={(v) => updateCliente(cliente.id, { provenienzaLead: v })}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Dati personali">
                  <EditableText
                    label="Data nascita"
                    type="date"
                    value={cliente.birthDate ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { birthDate: v })}
                  />
                  {cliente.birthDate ? (
                    <div className="space-y-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Età
                      </div>
                      <div className="text-sm text-foreground">{formatAge(cliente.birthDate)}</div>
                    </div>
                  ) : null}
                  <ComuneAutocomplete
                    label="Luogo di nascita"
                    value={cliente.birthPlace ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { birthPlace: v })}
                  />
                  <div>
                    <SmallLabel>Provincia di nascita</SmallLabel>
                    <Input
                      value={birthProvince}
                      readOnly
                      placeholder="—"
                      className="h-9 text-xs bg-muted/40"
                    />
                  </div>
                  <EditableSelect
                    label="Sesso"
                    value={cliente.sex ?? ""}
                    options={SEX_OPTS}
                    onChange={(v) => updateCliente(cliente.id, { sex: v })}
                  />
                  <EditableText
                    label="Codice fiscale"
                    value={cliente.fiscalCode ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { fiscalCode: v.toUpperCase() })}
                  />
                  <EditableSelect
                    label="Cittadinanza"
                    value={cliente.citizenship ?? ""}
                    options={CITTADINANZA_OPTS}
                    onChange={(v) => updateCliente(cliente.id, { citizenship: v })}
                  />
                  <ComuneAutocomplete
                    label="Città"
                    value={cliente.residenceCity ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { residenceCity: v })}
                  />
                  <div>
                    <SmallLabel>Provincia</SmallLabel>
                    <Input
                      value={residenceProvince || (cliente.province ?? "")}
                      readOnly
                      placeholder="—"
                      className="h-9 text-xs bg-muted/40"
                    />
                  </div>
                  <AddressFields
                    address={cliente.address ?? ""}
                    city={cliente.residenceCity ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { address: v })}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Situazione economica">
                  <EditableSelect
                    label="Tipo di lavoro"
                    value={cliente.tipoLavoro ?? ""}
                    options={TIPO_LAVORO_OPTS}
                    onChange={(v) => updateCliente(cliente.id, { tipoLavoro: v })}
                  />
                  <EditableSelect
                    label="Settore ATC"
                    value={cliente.settoreAtc ?? ""}
                    options={SETTORE_ATC_OPTS}
                    onChange={(v) => updateCliente(cliente.id, { settoreAtc: v })}
                  />
                  <EditableText
                    label="Azienda"
                    value={cliente.azienda ?? ""}
                    onChange={(v) => {
                      updateCliente(cliente.id, { azienda: v });
                      praticheActions.syncClienteForCliente(
                        { id: cliente.id, name: cliente.name },
                        v,
                      );
                    }}
                  />
                  <PartitaIvaField
                    value={cliente.partitaIva ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { partitaIva: v })}
                    onCompanyFound={(name) => {
                      updateCliente(cliente.id, { azienda: name });
                      praticheActions.syncClienteForCliente(
                        { id: cliente.id, name: cliente.name },
                        name,
                      );
                    }}
                    currentCompany={cliente.azienda ?? ""}
                  />
                  <EditableText
                    label="Data assunzione"
                    type="date"
                    value={cliente.dataAssunzione ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { dataAssunzione: v })}
                  />
                  {cliente.dataAssunzione ? (
                    <div className="space-y-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Anzianità lavorativa
                      </div>
                      <div className="text-sm text-foreground">
                        {formatAge(cliente.dataAssunzione)}
                      </div>
                    </div>
                  ) : null}
                  <EuroInput
                    label="Stipendio netto"
                    value={cliente.stipendioNetto ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { stipendioNetto: v })}
                  />
                  <EditableSelect
                    label="Reddito aggiuntivo"
                    value={cliente.redditoAggiuntivo ?? ""}
                    options={REDDITO_OPTS}
                    onChange={(v) => updateCliente(cliente.id, { redditoAggiuntivo: v })}
                  />
                  <EuroInput
                    label="TFR azienda"
                    value={cliente.tfrAzienda ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { tfrAzienda: v })}
                  />
                  <EuroInput
                    label="TFR fondo"
                    value={cliente.tfrFondo ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { tfrFondo: v })}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Prestiti">
                  <EditableSelect
                    label="CRIF"
                    value={cliente.crif ?? ""}
                    options={CRIF_OPTS}
                    onChange={(v) => updateCliente(cliente.id, { crif: v })}
                  />
                  <EuroInput
                    label="Impegni mensili"
                    value={cliente.impegniMensili ?? ""}
                    onChange={(v) => updateCliente(cliente.id, { impegniMensili: v })}
                  />
                </CollapsibleSection>
              </>
            )}

            {leftTab === "azioni" && (
              <AzioniPanel
                cliente={cliente}
                onDelete={() => {
                  deleteCliente(cliente.id);
                  // Rimuovi anche il lead collegato (stesso id, oppure
                  // matchato per nome/telefono) cosi sparisce dalla rubrica
                  // privati e dalla kanban.
                  leadsStore.deleteByContact({
                    id: cliente.id,
                    name: cliente.name,
                    phone: cliente.phone,
                    email: cliente.email,
                  });
                  navigate({ to: "/clienti" });
                }}
              />
            )}

            {leftTab === "preventivi" && (
              <PreventiviInviatiPanel cliente={cliente} />
            )}
          </div>
        </aside>

        {/* CENTER */}
        <main className="flex flex-1 flex-col bg-muted/20">
          <div className="flex items-center gap-1 border-b border-border bg-card px-2 text-sm">
            {(
              [
                ["tutti", "Tutti", thread.length, MessageSquare],
                [
                  "whatsapp",
                  "WhatsApp",
                  thread.filter((e) => e.kind === "msg" && e.channel === "whatsapp").length,
                  MessageSquare,
                ],
                [
                  "email",
                  "Email",
                  thread.filter((e) => e.kind === "msg" && e.channel === "email").length,
                  Mail,
                ],
                [
                  "sms",
                  "SMS",
                  thread.filter((e) => e.kind === "msg" && e.channel === "sms").length,
                  Smartphone,
                ],
                ["nota", "Nota", notes.length, StickyNote],
              ] as const
            ).map(([k, l, count, Icon]) => (
              <button
                key={k}
                onClick={() => setChannel(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  channel === k
                    ? "border-b-2 border-primary text-primary"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {l}{" "}
                {count > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {count}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {channel === "nota" ? (
              notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-10 text-center text-xs text-muted-foreground">
                  <StickyNote className="h-8 w-8 opacity-30" />
                  <div className="mt-2 font-medium">Nessuna nota</div>
                  <div>Aggiungi la prima nota dal pannello a destra</div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg border border-border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {n.body && (
                          <p className="whitespace-pre-wrap text-xs text-foreground/80">
                            {n.body}
                          </p>
                        )}
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Elimina nota"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {n.files && n.files.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {n.files.map((f, i) => (
                            <li key={i}>
                              <a
                                href={f.url}
                                download={f.name}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Paperclip className="h-3 w-3" /> {f.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 text-[10px] text-muted-foreground">{formatNoteAt(n.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              (() => {
                const filtered =
                  channel === "tutti"
                    ? thread
                    : thread.filter((e) => e.kind === "msg" && e.channel === channel);
                if (filtered.length === 0) {
                  const labels: Record<string, string> = {
                    whatsapp: "WhatsApp",
                    email: "Email",
                    sms: "SMS",
                  };
                  return (
                    <div className="flex flex-col items-center justify-center pt-10 text-center text-xs text-muted-foreground">
                      <MessageSquare className="h-8 w-8 opacity-30" />
                      <div className="mt-2 font-medium">
                        Nessun messaggio {labels[channel] ?? ""}
                      </div>
                      <div>I messaggi inviati e ricevuti appariranno qui</div>
                    </div>
                  );
                }
                return filtered.map((ev, i) => {
                  if (ev.kind === "status") {
                    return (
                      <div
                        key={i}
                        className="mx-auto inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700"
                      >
                        {ev.text} <span className="text-muted-foreground">{ev.at}</span>
                      </div>
                    );
                  }
                  if (ev.kind === "system") {
                    return (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          ⚠ {ev.text}
                          <div className="mt-1 text-[10px] text-amber-700/70">{ev.at}</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className={cn("flex", ev.from === "me" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                          ev.from === "me"
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-card border border-border",
                        )}
                      >
                        {ev.text}
                        <div
                          className={cn(
                            "mt-1 text-[10px]",
                            ev.from === "me"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {ev.at}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>

          <div className="border-t border-border bg-card px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Invia via:</span>
              <Pill
                active={channel === "whatsapp"}
                onClick={() => setChannel("whatsapp")}
                icon={MessageSquare}
                label="WhatsApp"
                color="emerald"
              />
              <Pill
                active={channel === "email"}
                onClick={() => setChannel("email")}
                icon={Mail}
                label="Email"
                color="blue"
              />
              <Pill
                active={channel === "sms"}
                onClick={() => setChannel("sms")}
                icon={Smartphone}
                label="SMS"
                color="amber"
              />
              <Pill
                active={channel === "nota"}
                onClick={() => setChannel("nota")}
                icon={StickyNote}
                label="Nota"
                color="violet"
              />
              <span className="mx-1">|</span>
              <Pill icon={CalendarIcon} label="Appuntamento" color="rose" />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={`Messaggio ${channel === "tutti" ? "" : channel}...`}
                  rows={2}
                  className="resize-none"
                />
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Invio: Enter · A capo: Shift+Enter
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <LinkIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={sendMessage}
                  disabled={!draft.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT: notes */}
        <aside className="hidden w-80 flex-col border-l border-border bg-card xl:flex">
          <div className="border-b border-border px-4 py-3 font-semibold">Note</div>
          <div className="flex-1 overflow-y-auto p-4">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-10 text-center text-xs text-muted-foreground">
                <StickyNote className="h-8 w-8 opacity-30" />
                <div className="mt-2 font-medium">Nessuna nota</div>
                <div>Aggiungi la prima nota qui sotto</div>
              </div>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border p-2">
                    <div className="flex items-start justify-between gap-2">
                      {n.body && (
                        <p className="whitespace-pre-wrap text-xs text-foreground/90">{n.body}</p>
                      )}
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Elimina nota"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {n.files && n.files.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {n.files.map((f, i) => (
                          <li key={i}>
                            <a
                              href={f.url}
                              download={f.name}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <Paperclip className="h-3 w-3" /> {f.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {formatNoteAt(n.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-3 space-y-2 text-sm">
            <Textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              placeholder="Scrivi una nota..."
              className="text-xs"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={noteFiles.length >= 5}
              >
                <Paperclip className="h-3 w-3" /> Allega file ({noteFiles.length}/5)
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={saveNote}
                disabled={!noteBody.trim() && noteFiles.length === 0}
              >
                Salva
              </Button>
            </div>
            {noteFiles.length > 0 && (
              <ul className="space-y-1">
                {noteFiles.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-muted/40 px-2 py-1 text-[11px]"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setNoteFiles((arr) => arr.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Rimuovi"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function FieldGroup({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function AzioniPanel({ cliente, onDelete }: { cliente: Cliente; onDelete: () => void }) {
  const phoneHref = cliente.phone ? `tel:${cliente.phone.replace(/\s/g, "")}` : "#";
  const waHref = cliente.phone ? `https://wa.me/${cliente.phone.replace(/\D/g, "")}` : "#";
  const mailHref = cliente.email ? `mailto:${cliente.email}` : "#";

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2 text-xs">
        <Link to="/preventivi-cessioni" search={{ clienteId: cliente.id }}>
          <FileText className="h-3 w-3 text-blue-600" /> Invia Preventivo
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2 text-xs">
        <a href={waHref} target="_blank" rel="noopener noreferrer">
          <Send className="h-3 w-3 text-emerald-600" /> Scrivi su WhatsApp
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2 text-xs">
        <a href={phoneHref}>
          <Phone className="h-3 w-3 text-slate-600" /> Chiama
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2 text-xs">
        <a href={mailHref}>
          <Mail className="h-3 w-3 text-slate-600" /> Invia Email
        </a>
      </Button>

      <div className="pt-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-rose-700 border-rose-300"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" /> Elimina cliente
        </Button>
      </div>
    </div>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{children}</div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md bg-primary/5 px-2 py-1 text-[10px] font-semibold uppercase text-primary">
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  highlighted,
  defaultOpen = false,
}: {
  title: string;
  children?: React.ReactNode;
  highlighted?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-md", highlighted ? "bg-primary/10" : "bg-muted/40")}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase",
          highlighted ? "text-primary" : "text-muted-foreground",
        )}
      >
        {title}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && children && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

function FieldSelect({ label }: { label: string }) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <Select>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="-">—</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function EditableText({
  label,
  value,
  onChange,
  type = "text",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      {label && <SmallLabel>{label}</SmallLabel>}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-xs"
      />
    </div>
  );
}

function formatEuro(raw: string): string {
  if (raw === "" || raw == null) return "";
  // Accept stored dot-decimal ("3534.32") or legacy Italian ("3.534,32") values.
  const s = String(raw).trim();
  const hasComma = s.includes(",");
  const normalized = hasComma ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
}

function EuroInput({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);
  const display = focused ? draft : value ? formatEuro(value) : "";
  return (
    <div>
      {label && <SmallLabel>{label}</SmallLabel>}
      <Input
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={() => {
          setDraft(value);
          setFocused(true);
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d,.-]/g, "");
          setDraft(v);
          const normalized = v.replace(/\./g, "").replace(",", ".");
          onChange(normalized);
        }}
        onBlur={() => setFocused(false)}
        placeholder="€ 0,00"
        className="h-9 text-xs"
      />
    </div>
  );
}

function PartitaIvaField({
  value,
  onChange,
  onCompanyFound,
  currentCompany,
}: {
  value: string;
  onChange: (v: string) => void;
  onCompanyFound: (name: string) => void;
  currentCompany: string;
}) {
  const lookup = useServerFn(lookupPartitaIva);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "ko">("idle");
  const tryLookup = async (vat: string) => {
    const digits = vat.replace(/\D/g, "");
    if (digits.length !== 11) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    try {
      const res = await lookup({ data: { vat: digits } });
      if (res.valid) {
        setStatus("ok");
        if (res.name && !currentCompany.trim()) onCompanyFound(res.name);
      } else {
        setStatus("ko");
      }
    } catch {
      setStatus("ko");
    }
  };
  return (
    <div>
      <SmallLabel>
        Partita IVA{" "}
        {status === "loading" && <span className="text-muted-foreground">(verifica...)</span>}
        {status === "ok" && <span className="text-emerald-600">✓ valida</span>}
        {status === "ko" && <span className="text-rose-600">non trovata</span>}
      </SmallLabel>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setStatus("idle");
        }}
        onBlur={(e) => tryLookup(e.target.value)}
        placeholder="11 cifre"
        className="h-9 text-xs"
      />
    </div>
  );
}

function ComuneAutocomplete({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const normalized = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!normalized) return [] as typeof COMUNI_LIST;
    return COMUNI_LIST.filter((c) => c.name.toLowerCase().startsWith(normalized)).slice(0, 100);
  }, [normalized]);

  return (
    <div>
      {label && <SmallLabel>{label}</SmallLabel>}
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Inizia a digitare..."
            autoComplete="off"
            className="h-9 text-xs"
          />
        </PopoverAnchor>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] max-h-64 overflow-y-auto"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ul className="py-1">
            {suggestions.map((c) => (
              <li
                key={`${c.name}-${c.provincia}`}
                className="cursor-pointer px-3 py-1.5 text-xs hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(c.name);
                  onChange(c.name);
                  setOpen(false);
                }}
              >
                {c.name} <span className="text-muted-foreground">({c.provincia})</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function EditableSelect({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      {label && <SmallLabel>{label}</SmallLabel>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="Seleziona..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function splitAddress(full: string): { street: string; civic: string } {
  const s = (full ?? "").trim();
  if (!s) return { street: "", civic: "" };
  // Match trailing civic number (e.g. ", 5", " 5/A", " 12 bis")
  const m = s.match(/^(.*?)[,\s]+(\d+[\w/\-\s]*)$/);
  if (m) return { street: m[1].trim().replace(/,\s*$/, ""), civic: m[2].trim() };
  return { street: s, civic: "" };
}

function joinAddress(street: string, civic: string): string {
  const s = street.trim();
  const c = civic.trim();
  if (s && c) return `${s}, ${c}`;
  return s || c;
}

function AddressFields({
  address,
  city,
  onChange,
}: {
  address: string;
  city?: string;
  onChange: (v: string) => void;
}) {
  const initial = splitAddress(address);
  const [street, setStreet] = useState(initial.street);
  const [civic, setCivic] = useState(initial.civic);
  useEffect(() => {
    const next = splitAddress(address);
    setStreet(next.street);
    setCivic(next.civic);
  }, [address]);

  return (
    <div className="space-y-2">
      <AddressAutocomplete
        label="Indirizzo"
        value={street}
        city={city}
        onChange={(v) => {
          setStreet(v);
          onChange(joinAddress(v, civic));
        }}
      />
      <div className="w-28">
        <SmallLabel>N. civico</SmallLabel>
        <Input
          value={civic}
          onChange={(e) => {
            setCivic(e.target.value);
            onChange(joinAddress(street, e.target.value));
          }}
          placeholder="es. 12"
          className="h-9 text-xs"
        />
      </div>
    </div>
  );
}

function AddressAutocomplete({
  label,
  value,
  city,
  onChange,
}: {
  label?: string;
  value: string;
  city?: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<{ label: string; street: string }[]>([]);
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          addressdetails: "1",
          limit: "8",
          countrycodes: "it",
          street: q,
        });
        if (city) params.set("city", city);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          signal: ctrl.signal,
          headers: { "Accept-Language": "it" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          display_name: string;
          address: Record<string, string>;
        }>;
        const items = data
          .map((d) => {
            const a = d.address || {};
            const road = a.road || a.pedestrian || a.footway || a.cycleway || "";
            const street = road || d.display_name.split(",")[0];
            return { label: d.display_name, street };
          })
          .filter((x) => x.street);
        // dedupe by street
        const seen = new Set<string>();
        const uniq = items.filter((i) => (seen.has(i.street) ? false : (seen.add(i.street), true)));
        setSuggestions(uniq);
      } catch {
        /* ignore */
      }
    }, 350);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [query, city]);

  return (
    <div>
      {label && <SmallLabel>{label}</SmallLabel>}
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Via, numero civico..."
            autoComplete="off"
            className="h-9 text-xs"
          />
        </PopoverAnchor>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] max-h-64 overflow-y-auto"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ul className="py-1">
            {suggestions.map((s, i) => (
              <li
                key={`${s.street}-${i}`}
                className="cursor-pointer px-3 py-1.5 text-xs hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(s.street);
                  onChange(s.street);
                  setOpen(false);
                }}
                title={s.label}
              >
                {s.street}
                <div className="truncate text-[10px] text-muted-foreground">{s.label}</div>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function IconBtn({ Icon }: { Icon: typeof Bold }) {
  return (
    <button className="rounded p-1 hover:bg-muted">
      <Icon className="h-3 w-3" />
    </button>
  );
}

function Pill({
  icon: Icon,
  label,
  color,
  active,
  onClick,
}: {
  icon: typeof MessageSquare;
  label: string;
  color: "emerald" | "blue" | "amber" | "indigo" | "violet" | "rose";
  active?: boolean;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    violet: "bg-violet-100 text-violet-700 border-violet-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-opacity",
        colorMap[color],
        !active && "opacity-70 hover:opacity-100",
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

// =============================================================
//  Preventivi inviati — sotto-pannello scheda cliente
// =============================================================

function PreventiviInviatiPanel({ cliente }: { cliente: Cliente }) {
  const { preventivi, updatePreventivo, removePreventivo } = usePreventiviStore();

  const matchKey = (s: string) => s.trim().toLowerCase();
  const clienteNameKey = matchKey(cliente.name);

  const linked = useMemo(
    () =>
      preventivi.filter((p) => {
        if (p.dettagli?.clienteId && p.dettagli.clienteId === cliente.id) return true;
        return matchKey(p.nome) === clienteNameKey;
      }),
    [preventivi, cliente.id, clienteNameKey],
  );

  if (linked.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
        Nessun preventivo inviato per questo cliente.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {linked.map((p) => (
        <PreventivoInviatoCard
          key={p.id}
          preventivo={p}
          onUpdate={updatePreventivo}
          onDelete={() => {
            if (confirm("Eliminare definitivamente questo preventivo?")) removePreventivo(p.id);
          }}
        />
      ))}
    </div>
  );
}

function PreventivoInviatoCard({
  preventivo,
  onUpdate,
  onDelete,
}: {
  preventivo: Preventivo;
  onUpdate: (id: string, patch: Partial<Omit<Preventivo, "id">>) => void;
  onDelete: () => void;
}) {
  const d = preventivo.dettagli ?? {};
  const impegniInEssere = (d.impegni ?? []).filter((i) => !i.daEstinguere);

  const fmtEur = (n?: number | null) => {
    if (n == null || !isFinite(n)) return "—";
    const formatted = n.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    });
    return `€ ${formatted}`;
  };

  const MESI_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const fmtMY = (s?: string | null) => {
    if (!s) return "—";
    const [y, m] = s.split("-").map(Number);
    if (!y || !m || m < 1 || m > 12) return "—";
    return `${MESI_IT[m - 1]} ${y}`;
  };

  const dataLabel = new Date(preventivo.data).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const patchDettagli = (patch: Partial<typeof d>) => {
    const nextD = { ...d, ...patch };
    // Ricalcolo coerente: montante = rata × durata, provvigione = montante × pct/100
    const rata = nextD.rata ?? 0;
    const durata = nextD.durata ?? 0;
    const montante = rata * durata;
    const pct = nextD.provvigionePct ?? 0;
    const provvigione = montante * (pct / 100);
    onUpdate(preventivo.id, {
      dettagli: { ...nextD, montante },
      importo: montante,
      provvigione,
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-foreground">{preventivo.prodotto}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {dataLabel}
            {d.archived ? " · trasformato in pratica" : ""}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {d.pdfDataUrl && (
            <a
              href={d.pdfDataUrl}
              download={`Preventivo_${preventivo.nome.replace(/[^a-z0-9_-]+/gi, "_")}.pdf`}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
              title="Scarica PDF salvato"
            >
              PDF
            </a>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/20"
            title="Elimina preventivo"
          >
            <Trash2 className="h-3 w-3" /> Elimina
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {/* STEP 3 — Impegni in essere */}
        <section>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Impegni in essere
          </div>
          {impegniInEssere.length === 0 ? (
            <div className="rounded border border-dashed border-border bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
              Nessun impegno in essere.
            </div>
          ) : (
            <ul className="space-y-1">
              {impegniInEssere.map((i) => (
                <li
                  key={i.id}
                  className="rounded border border-border/70 bg-muted/20 px-2 py-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{i.banca || "—"}</span>
                    <span className="text-muted-foreground">{i.tipo}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {fmtMY(i.dataDecorrenza)} → {fmtMY(i.dataScadenza)}
                    </span>
                    <span className="font-semibold text-foreground">{fmtEur(i.rata)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Dati prestito */}
        <section>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Dati prestito
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Rata €" value={d.rata} step={1} onChange={(v) => patchDettagli({ rata: v })} />
            <NumField label="Durata (mesi)" value={d.durata} step={1} onChange={(v) => patchDettagli({ durata: v })} />
            <NumField label="TAN %" value={d.tan} step={0.01} onChange={(v) => patchDettagli({ tan: v })} />
            <NumField label="TAEG %" value={d.taeg} step={0.01} onChange={(v) => patchDettagli({ taeg: v })} />
          </div>
          <div className="mt-2 space-y-1 rounded border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px]">
            <Row k="Montante" v={fmtEur((d.rata ?? 0) * (d.durata ?? 0))} />
            <Row k="Netto erogato" v={fmtEur(d.netto)} />
          </div>
        </section>

        {/* Provvigioni */}
        <section>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Provvigioni
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">Banca mandante</span>
              <Input
                value={d.bancaMandante ?? ""}
                onChange={(e) => patchDettagli({ bancaMandante: e.target.value })}
                className="h-8 text-xs"
              />
            </label>
            <NumField label="Provv. %" value={d.provvigionePct} step={0.01} onChange={(v) => patchDettagli({ provvigionePct: v })} />
          </div>
          <div className="mt-2 space-y-1 rounded border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px]">
            <Row k="Provvigione €" v={fmtEur(preventivo.provvigione)} />
          </div>
        </section>

        {/* Assicurazione */}
        <section>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Assicurazione
          </div>
          <CompagniaSelect
            value={d.assicurazione ?? ""}
            onChange={(v) => patchDettagli({ assicurazione: v })}
          />
        </section>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number | undefined;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="h-8 text-xs"
      />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-foreground">{v}</span>
    </div>
  );
}

function CompagniaSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [compagnie] = useCompagnie();
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Seleziona compagnia" />
      </SelectTrigger>
      <SelectContent>
        {compagnie.map((c) => (
          <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
