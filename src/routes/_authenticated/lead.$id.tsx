import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Upload,
  Shield,
  Trash2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Aggiunto per il menu Preventivi
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LEAD_STAGES, type Lead, type LeadStageKey, useLeadsStore } from "@/lib/leads-store";
import { clientiStore } from "@/lib/clienti-store";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";

const SEX_OPTS = ["M", "F", "Altro"];
const CITTADINANZA_OPTS = ["Italiana", "UE", "Extra UE"];
const TIPO_LAVORO_OPTS = ["Dipendente pubblico", "Dipendente privato", "Pensionato", "Autonomo", "Disoccupato"];
const TIPO_ABITAZIONE_OPTS = ["Proprietà", "Affitto", "Comodato", "Con i genitori"];
const FAMILIARI_OPTS = ["0", "1", "2", "3", "4 o più"];
const REDDITO_OPTS = ["Nessun reddito", "Reddito da lavoro", "Pensione", "Affitti", "Altro"];
const CRIF_OPTS = ["Pulita", "Ritardi", "Segnalato", "Da verificare"];
const PRODOTTI = ["Prestito Personale", "Cessione del Quinto", "Delega di Pagamento", "Mutuo", "Conto Corrente"];

export const Route = createFileRoute("/_authenticated/lead/$id")({
  head: () => ({ meta: [{ title: "Scheda cliente · EasyQuinto" }] }),
  component: LeadDetailPage,
});

type LeftTab = "campi" | "azioni";
type Channel = "tutti" | "whatsapp" | "email" | "sms" | "chat" | "nota";

type ThreadEvent =
  | { kind: "status"; text: string; at: string }
  | { kind: "system"; text: string; at: string }
  | { kind: "msg"; from: "me" | "them"; text: string; at: string };

type LeadCardRow = Tables<"lead_cards">;
type LeadCardInsert = TablesInsert<"lead_cards">;

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { name: parts[0] ?? "", surname: "" };
  return { name: parts.slice(0, -1).join(" "), surname: parts.at(-1) ?? "" };
};

const composeFullName = (name: string, surname: string) => [name, surname].map((x) => x.trim()).filter(Boolean).join(" ");
const asNull = (value?: string | null) => (value?.trim() ? value.trim() : null);
const asNumberOrNull = (value?: string | null) => {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const fromNumber = (value: number | null) => (value == null ? "" : String(value));
const isLeadStage = (value: string | null): value is LeadStageKey =>
  Boolean(value && LEAD_STAGES.some((stage) => stage.key === value));

const firstNameOf = (lead: Lead) => (lead.surname ? splitFullName(lead.name).name : splitFullName(lead.name).name);
const surnameOf = (lead: Lead) => lead.surname ?? splitFullName(lead.name).surname;

const rowToLeadPatch = (row: LeadCardRow): Partial<Lead> => ({
  name: row.full_name || composeFullName(row.name, row.surname) || row.name,
  surname: row.surname,
  company: row.company,
  phone: row.phone,
  email: row.email,
  source: row.source,
  ...(isLeadStage(row.stage) ? { stage: row.stage } : {}),
  engagement: row.engagement ?? undefined,
  temperature: row.temperature === "caldo" || row.temperature === "tiepido" ? row.temperature : "freddo",
  potential: row.potential === "qualificato" || row.potential === "vip" ? row.potential : "potenziale",
  phone2: row.phone2 ?? "",
  birthDate: row.birth_date ?? "",
  fiscalCode: row.fiscal_code ?? "",
  sex: row.sex ?? "",
  citizenship: row.citizenship ?? "",
  address: row.address ?? "",
  tipoLavoro: row.tipo_lavoro ?? "",
  azienda: row.azienda ?? "",
  partitaIva: row.partita_iva ?? "",
  dataAssunzione: row.data_assunzione ?? "",
  stipendioNetto: fromNumber(row.stipendio_netto),
  redditoAggiuntivo: fromNumber(row.reddito_aggiuntivo),
  tfrAzienda: fromNumber(row.tfr_azienda),
  tfrFondo: fromNumber(row.tfr_fondo),
  crif: row.crif ?? "",
  impegniMensili: fromNumber(row.impegni_mensili),
  provenienzaLead: row.provenienza_lead ?? "",
  tipoContatto: row.tipo_contatto ?? "",
  priorita: row.priorita ?? "",
  recallDate: row.recall_date ?? "",
  notes: row.notes ?? "",
  tipologiaAbitazione: row.tipologia_abitazione ?? "",
  familiariCarico: row.familiari_carico ?? "",
  relazione: row.relazione ?? "",
  prodottiInteresse: row.prodotti_interesse ?? [],
  privacyTrattamento: row.privacy_trattamento,
  privacyMarketing: row.privacy_marketing,
});

const leadToCardPayload = (lead: Lead, userId: string): LeadCardInsert => {
  const name = firstNameOf(lead);
  const surname = surnameOf(lead);
  const fullName = composeFullName(name, surname) || lead.name;
  return {
    user_id: userId,
    lead_key: lead.id,
    name,
    surname,
    full_name: fullName,
    phone: asNull(lead.phone),
    phone2: asNull(lead.phone2),
    email: asNull(lead.email),
    company: asNull(lead.company),
    source: asNull(lead.source),
    stage: lead.stage,
    engagement: asNull(lead.engagement),
    temperature: lead.temperature,
    potential: lead.potential,
    birth_date: asNull(lead.birthDate),
    fiscal_code: asNull(lead.fiscalCode),
    sex: asNull(lead.sex),
    citizenship: asNull(lead.citizenship),
    address: asNull(lead.address),
    tipo_lavoro: asNull(lead.tipoLavoro),
    azienda: asNull(lead.azienda),
    partita_iva: asNull(lead.partitaIva),
    data_assunzione: asNull(lead.dataAssunzione),
    stipendio_netto: asNumberOrNull(lead.stipendioNetto),
    reddito_aggiuntivo: asNumberOrNull(lead.redditoAggiuntivo),
    tfr_azienda: asNumberOrNull(lead.tfrAzienda),
    tfr_fondo: asNumberOrNull(lead.tfrFondo),
    crif: asNull(lead.crif),
    impegni_mensili: asNumberOrNull(lead.impegniMensili),
    provenienza_lead: asNull(lead.provenienzaLead),
    tipo_contatto: asNull(lead.tipoContatto),
    priorita: asNull(lead.priorita),
    recall_date: asNull(lead.recallDate),
    notes: asNull(lead.notes),
    tipologia_abitazione: asNull(lead.tipologiaAbitazione),
    familiari_carico: asNull(lead.familiariCarico),
    relazione: asNull(lead.relazione),
    prodotti_interesse: lead.prodottiInteresse ?? [],
    privacy_trattamento: lead.privacyTrattamento ?? false,
    privacy_marketing: lead.privacyMarketing ?? false,
  };
};

const initialThread: ThreadEvent[] = [
  { kind: "status", text: "Stato aggiornato a: 1° Tentativo non risposto", at: "01 giu 17:00" },
  { kind: "system", text: "Entrato nel workflow \"Invito a Prenotare Appuntamento\"", at: "01 giu 17:00" },
  { kind: "status", text: "Stato aggiornato a: Nuovo da Chiamare", at: "01 giu 17:00" },
  { kind: "system", text: "Workflow fermato dopo 4 tentativi falliti su \"WA Followup calendario 1\"", at: "01 giu 17:50" },
];

const NOTE_COLORS = ["#3b82f6", "#22c55e", "#a78bfa", "#f59e0b", "#ec4899", "#ef4444", "#06b6d4", "#84cc16"];

function LeadDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { leads, updateLead, deleteLead } = useLeadsStore();
  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id]);

  const [leftTab, setLeftTab] = useState<LeftTab>("campi");
  const [channel, setChannel] = useState<Channel>("tutti");
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<ThreadEvent[]>(initialThread);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; color: string; at: string }[]>([]);
  const [cardReady, setCardReady] = useState(false);

  useEffect(() => {
    setCardReady(false);
  }, [id, user?.id]);

  useEffect(() => {
    if (!user || !lead || cardReady) return;
    let cancelled = false;
    supabase
      .from("lead_cards")
      .select("*")
      .eq("lead_key", lead.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Impossibile caricare la scheda cliente");
          setCardReady(true);
          return;
        }
        if (data) {
          updateLead(lead.id, rowToLeadPatch(data));
        } else {
          await supabase.from("lead_cards").insert(leadToCardPayload(lead, user.id));
        }
        setCardReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cardReady, lead, updateLead, user]);

  useEffect(() => {
    if (!user || !lead || !cardReady) return;
    const timeout = window.setTimeout(() => {
      const payload = leadToCardPayload(lead, user.id);
      supabase
        .from("lead_cards")
        .upsert(payload, { onConflict: "user_id,lead_key" })
        .then(({ error }) => {
          if (error) toast.error("Modifica non salvata sulla scheda cliente");
        });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [cardReady, lead, user]);

  if (!lead) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Lead non trovato.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/lead">Torna ai Lead</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sendMessage = () => {
    if (!draft.trim()) return;
    const now = new Date();
    const at = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setThread((t) => [...t, { kind: "msg", from: "me", text: draft, at }]);
    setDraft("");
  };

  const saveNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return;
    setNotes((n) => [
      { id: crypto.randomUUID(), title: noteTitle, body: noteBody, color: noteColor, at: "ora" },
      ...n,
    ]);
    setNoteTitle("");
    setNoteBody("");
  };

  const clientName = firstNameOf(lead);
  const clientSurname = surnameOf(lead);
  const renameClient = (name: string, surname = clientSurname) =>
    updateLead(lead.id, { name: composeFullName(name, surname) || name, surname });

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/lead" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white", lead.avatarColor)}>
            {lead.initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">{lead.name}</h1>
            </div>
            <div className="text-xs text-muted-foreground">
              {lead.source} · {lead.phone}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="io">
            <SelectTrigger className="h-9 w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="io">Demo Base EasyQuinto (admin) — io</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={lead.stage}
            onValueChange={(v) => updateLead(lead.id, { stage: v as LeadStageKey })}
          >
            <SelectTrigger className="h-9 w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon"><Clock className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: fields */}
        <aside className="flex w-72 flex-col border-r border-border bg-card">
          <div className="flex border-b border-border text-sm">
            {([
              ["campi", "Tutti i campi"],
              ["azioni", "Azioni"],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setLeftTab(k)}
                className={cn(
                  "flex-1 py-2 font-medium transition-colors",
                  leftTab === k ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
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
                  <div className="space-y-3">
                    <EditableText label="Nome" value={clientName} onChange={(v) => renameClient(v)} />
                    <EditableText label="Cognome" value={clientSurname} onChange={(v) => renameClient(clientName, v)} />
                    <EditableText label="Telefono" value={lead.phone ?? ""} onChange={(v) => updateLead(lead.id, { phone: v })} />
                    <EditableText label="Telefono secondario" value={lead.phone2 ?? ""} onChange={(v) => updateLead(lead.id, { phone2: v })} />
                    <EditableText label="Email" value={lead.email ?? ""} onChange={(v) => updateLead(lead.id, { email: v })} />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Dati personali">
                  <div className="space-y-3">
                    <EditableText label="Data di nascita" type="date" value={lead.birthDate ?? ""} onChange={(v) => updateLead(lead.id, { birthDate: v })} />
                    <EditableText label="Codice fiscale" value={lead.fiscalCode ?? ""} onChange={(v) => updateLead(lead.id, { fiscalCode: v.toUpperCase() })} />
                    <EditableSelect label="Sesso" value={lead.sex ?? ""} options={SEX_OPTS} onChange={(v) => updateLead(lead.id, { sex: v })} />
                    <EditableSelect label="Cittadinanza" value={lead.citizenship ?? ""} options={CITTADINANZA_OPTS} onChange={(v) => updateLead(lead.id, { citizenship: v })} />
                    <EditableText label="Indirizzo" value={lead.address ?? ""} onChange={(v) => updateLead(lead.id, { address: v })} />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Situazione economica">
                  <div className="space-y-3">
                    <EditableSelect label="Tipo di lavoro" value={lead.tipoLavoro ?? ""} options={TIPO_LAVORO_OPTS} onChange={(v) => updateLead(lead.id, { tipoLavoro: v })} />
                    <EditableText label="Azienda" value={lead.azienda ?? ""} onChange={(v) => updateLead(lead.id, { azienda: v })} />
                    <EditableText label="Partita IVA" value={lead.partitaIva ?? ""} onChange={(v) => updateLead(lead.id, { partitaIva: v })} />
                    <EditableText label="Data assunzione" type="date" value={lead.dataAssunzione ?? ""} onChange={(v) => updateLead(lead.id, { dataAssunzione: v })} />
                    <EditableText label="Stipendio netto (€)" value={lead.stipendioNetto ?? ""} onChange={(v) => updateLead(lead.id, { stipendioNetto: v })} />
                    <EditableSelect label="Reddito aggiuntivo (€)" value={lead.redditoAggiuntivo ?? ""} options={REDDITO_OPTS} onChange={(v) => updateLead(lead.id, { redditoAggiuntivo: v })} />
                    <EditableText label="TFR azienda (€)" value={lead.tfrAzienda ?? ""} onChange={(v) => updateLead(lead.id, { tfrAzienda: v })} />
                    <EditableText label="TFR fondo (€)" value={lead.tfrFondo ?? ""} onChange={(v) => updateLead(lead.id, { tfrFondo: v })} />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Prestiti">
                  <div className="space-y-3">
                    <EditableSelect label="CRIF" value={lead.crif ?? ""} options={CRIF_OPTS} onChange={(v) => updateLead(lead.id, { crif: v })} />
                    <EditableText label="Impegni mensili (€)" value={lead.impegniMensili ?? ""} onChange={(v) => updateLead(lead.id, { impegniMensili: v })} />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Storico pratiche">
                  <p className="text-xs text-muted-foreground">Nessuna pratica per questo cliente.</p>
                </CollapsibleSection>
                <FieldGroup label="Life Time Commission (LTC)" value={`€ ${(lead.ltc || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  (0 operazioni)`} />
                <div>
                  <SmallLabel>Recensione</SmallLabel>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4" />
                    ))}
                    <span className="ml-2 text-xs">Nessuna</span>
                  </div>
                </div>
                <EditableSelect label="Tipologia abitazione" value={lead.tipologiaAbitazione ?? ""} options={TIPO_ABITAZIONE_OPTS} onChange={(v) => updateLead(lead.id, { tipologiaAbitazione: v })} />
                <EditableSelect label="Familiari a carico" value={lead.familiariCarico ?? ""} options={FAMILIARI_OPTS} onChange={(v) => updateLead(lead.id, { familiariCarico: v })} />
                <div>
                  <SmallLabel>Relazione</SmallLabel>
                  <Input value={lead.relazione ?? ""} onChange={(e) => updateLead(lead.id, { relazione: e.target.value })} placeholder="Cerca contatto..." className="h-9 text-xs" />
                </div>

                <SectionLabel>Prodotto di interesse</SectionLabel>
                {PRODOTTI.map((p) => {
                  const selected = lead.prodottiInteresse ?? [];
                  const checked = selected.includes(p);
                  return (
                    <label key={p} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = v
                            ? [...selected, p]
                            : selected.filter((x) => x !== p);
                          updateLead(lead.id, { prodottiInteresse: next });
                        }}
                      />
                      {p}
                    </label>
                  );
                })}

                <SectionLabel>GDPR &amp; Privacy</SectionLabel>
                <div className="space-y-2 rounded-md border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Stato consensi</div>
                  <label className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <div className="font-medium">Trattamento dati personali</div>
                      <div className="text-[10px] text-muted-foreground">Accettato il 22/01/2026 07:07</div>
                    </div>
                    <Checkbox checked={lead.privacyTrattamento ?? false} onCheckedChange={(v) => updateLead(lead.id, { privacyTrattamento: Boolean(v) })} />
                  </label>
                  <label className="flex items-start justify-between gap-2 text-xs">
                    <div className="font-medium">Materiale marketing</div>
                    <Checkbox checked={lead.privacyMarketing ?? false} onCheckedChange={(v) => updateLead(lead.id, { privacyMarketing: Boolean(v) })} />
                  </label>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Diritti dell'interessato</div>
                  <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                    <Upload className="h-3 w-3" /> Esporta dati cliente (JSON)
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-1 text-xs text-amber-700 border-amber-300">
                    <Shield className="h-3 w-3" /> Sposta in blacklist
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1 text-xs text-rose-700 border-rose-300"
                    onClick={() => {
                      clientiStore.removeByContact({ id: lead.id, name: lead.name, phone: lead.phone, email: lead.email });
                      deleteLead(lead.id);
                      navigate({ to: "/lead" });
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Anonimizza cliente
                  </Button>
                  <p className="text-[10px] text-muted-foreground">Art. 17 e 20 GDPR — diritto all'oblio e portabilità</p>
                </div>
              </>
            )}

            {leftTab === "azioni" && (
              <div className="space-y-2">
                
                {/* INIZIO MODIFICA: Menu Crea Preventivo */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary">
                      <Send className="h-3 w-3" /> Crea / Invia Preventivo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem 
                      className="cursor-pointer"
                      onClick={() => navigate({ to: "/preventivi-prestiti", search: { leadId: lead.id } as any })}
                    >
                      Preventivo Prestito Personale
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="cursor-pointer"
                      onClick={() => navigate({ to: "/preventivi-cessioni", search: { leadId: lead.id } as any })}
                    >
                      Preventivo Cessione del Quinto
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* FINE MODIFICA */}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={() => {
                    if (!lead.phone) return;
                    const num = lead.phone.replace(/\D/g, "");
                    window.open(`https://wa.me/${num}`, "_blank");
                  }}
                >
                  <MessageSquare className="h-3 w-3" /> Scrivi su WhatsApp
                </Button>
                
                {/* INIZIO MODIFICA: Chiama dal PC */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={() => {
                    if (lead.phone) window.open(`tel:${lead.phone.replace(/\s+/g, "")}`, "_self");
                  }}
                >
                  <Phone className="h-3 w-3" /> Chiama dal PC / Mobile
                </Button>
                {/* FINE MODIFICA */}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={() => {
                    if (lead.email) window.location.href = `mailto:${lead.email}`;
                  }}
                >
                  <Mail className="h-3 w-3" /> Invia email
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs text-rose-700 border-rose-300"
                  onClick={() => {
                    clientiStore.removeByContact({ id: lead.id, name: lead.name, phone: lead.phone, email: lead.email });
                    deleteLead(lead.id);
                    navigate({ to: "/lead" });
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Elimina cliente
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: conversation */}
        <main className="flex flex-1 flex-col bg-muted/20">
          <div className="flex items-center gap-1 border-b border-border bg-card px-2 text-sm">
            {([
              ["tutti", "Tutti", thread.length, MessageSquare],
              ["whatsapp", "WhatsApp", 0, MessageSquare],
              ["email", "Email", 0, Mail],
              ["sms", "SMS", 0, Smartphone],
              ["chat", "Chat Widget", 0, Globe],
              ["nota", "Nota", notes.length, StickyNote],
            ] as const).map(([k, l, count, Icon]) => (
              <button
                key={k}
                onClick={() => setChannel(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  channel === k
                    ? "border-b-2 border-primary text-primary"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {l} {count > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{count}</Badge>}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {thread.map((ev, i) => {
              if (ev.kind === "status") {
                return (
                  <div key={i} className="mx-auto inline-flex w-fit items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] text-sky-700">
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
                <div key={i} className={cn("flex", ev.from === "me" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[70%] rounded-2xl px-3 py-2 text-sm",
                    ev.from === "me" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card border border-border"
                  )}>
                    {ev.text}
                    <div className={cn("mt-1 text-[10px]", ev.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>{ev.at}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border bg-card px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Invia via:</span>
              <Pill active={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} icon={MessageSquare} label="WhatsApp" color="emerald" />
              <Pill active={channel === "email"} onClick={() => setChannel("email")} icon={Mail} label="Email" color="blue" />
              <Pill active={channel === "sms"} onClick={() => setChannel("sms")} icon={Smartphone} label="SMS" color="amber" />
              <Pill active={channel === "chat"} onClick={() => setChannel("chat")} icon={Globe} label="Chat Widget" color="indigo" />
              <Pill active={channel === "nota"} onClick={() => setChannel("nota")} icon={StickyNote} label="Nota" color="violet" />
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
                <div className="mt-1 text-[10px] text-muted-foreground">Invio: Enter · A capo: Shift+Enter</div>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><LinkIcon className="h-4 w-4" /></Button>
                {/* INIZIO MODIFICA: Chiama dal PC */}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    if (lead.phone) window.open(`tel:${lead.phone.replace(/\s+/g, "")}`, "_self");
                  }}><Phone className="h-4 w-4" /></Button>
                {/* FINE MODIFICA */}
                <Button variant="ghost" size="icon" className="h-8 w-8"><Mic className="h-4 w-4" /></Button>
                <Button size="icon" className="h-8 w-8" onClick={sendMessage} disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT: notes */}
        <aside className="hidden w-80 flex-col border-l border-border bg-card xl:flex">
          <div className="border-b border-border px-4 py-3 font-semibold">Aggiungi nota</div>
          <div className="space-y-3 p-4 text-sm">
            <div>
              <div className="flex items-center justify-between">
                <SmallLabel>Titolo</SmallLabel>
                <span className="text-[10px] text-muted-foreground">{noteTitle.length}/120</span>
              </div>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value.slice(0, 120))}
                placeholder="Titolo nota..."
                className="h-8 text-xs"
              />
            </div>
            <div className="rounded-md border border-border">
              <div className="flex items-center gap-1 border-b border-border px-2 py-1 text-muted-foreground">
                <IconBtn Icon={Bold} />
                <IconBtn Icon={Italic} />
                <IconBtn Icon={Underline} />
                <IconBtn Icon={Strikethrough} />
                <IconBtn Icon={LinkIcon} />
                <IconBtn Icon={List} />
                <IconBtn Icon={ListOrdered} />
                <IconBtn Icon={RotateCcw} />
              </div>
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Descrizione nota..."
                className="border-0 focus-visible:ring-0 text-xs"
              />
            </div>
            <div>
              <SmallLabel>Colore</SmallLabel>
              <div className="flex items-center gap-2">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNoteColor(c)}
                    style={{ background: c }}
                    className={cn("h-5 w-5 rounded-full border-2", noteColor === c ? "border-foreground" : "border-transparent")}
                  />
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
              <Paperclip className="h-3 w-3" /> Carica file (0/5)
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setNoteTitle(""); setNoteBody(""); }}>Annulla</Button>
              <Button size="sm" className="flex-1" onClick={saveNote}>Salva</Button>
            </div>
          </div>
          <div className="border-t border-border px-4 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cerca note..." className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-10 text-center text-xs text-muted-foreground">
                <StickyNote className="h-8 w-8 opacity-30" />
                <div className="mt-2 font-medium">Nessuna nota</div>
                <div>Aggiungi la prima nota qui sopra</div>
              </div>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border p-2" style={{ borderLeftColor: n.color, borderLeftWidth: 4 }}>
                    {n.title && <div className="text-xs font-semibold">{n.title}</div>}
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <div className="mt-1 text-[10px] text-muted-foreground">{n.at}</div>
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

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-md bg-primary/5 px-2 py-1 text-[10px] font-semibold uppercase text-primary">{children}</div>;
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
        className={cn("flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase", highlighted ? "text-primary" : "text-muted-foreground")}
      >
        {title}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && children && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function FieldSelect({ label }: { label: string }) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <Select>
        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
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
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-xs"
      />
    </div>
  );
}

function EditableSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="—" />
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

function IconBtn({ Icon }: { Icon: typeof Bold }) {
  return (
    <button className="rounded p-1 hover:bg-muted"><Icon className="h-3 w-3" /></button>
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
        !active && "opacity-70 hover:opacity-100"
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}