import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Calendar as CalendarIcon,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Flag,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LEAD_STAGES, type LeadStageKey, useLeadsStore } from "@/lib/leads-store";
import { clientiStore } from "@/lib/clienti-store";
import { supabase } from "@/integrations/supabase/client";
import { useOptionList } from "@/lib/option-lists-store";
import { aziendeStore, useAziende } from "@/lib/aziende-store";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/_authenticated/lead/")({
  head: () => ({ meta: [{ title: "Lead · EasyQuinto" }] }),
  component: LeadPage,
});

type ViewMode = "kanban" | "list";
type Quick = "tutti" | "scaduti" | "oggi" | "settimana";

function LeadPage() {
  const { leads, moveLead, deleteLead, updateLead, addLead } = useLeadsStore();
  // Una tantum: riallinea i nomi dei lead alla scheda cliente salvata in cloud
  // (lead_cards), così se l'utente ha corretto un nome nella scheda lo vede
  // riflesso anche sulla kanban senza dover reinserire i dati.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (reconciledRef.current) return;
    if (leads.length === 0) return;
    reconciledRef.current = true;
    (async () => {
      const keys = leads.flatMap((l) => [l.id, `cli-${l.id}`]);
      const { data, error } = await supabase
        .from("lead_cards")
        .select("lead_key, full_name, name, surname, phone, email")
        .in("lead_key", keys);
      if (error || !data) return;
      const byId = new Map<string, typeof data[number]>();
      for (const row of data) {
        const id = row.lead_key.startsWith("cli-") ? row.lead_key.slice(4) : row.lead_key;
        // privilegia la chiave cli-* (scheda cliente) che è quella aggiornata
        if (!byId.has(id) || row.lead_key.startsWith("cli-")) byId.set(id, row);
      }
      for (const lead of leads) {
        const row = byId.get(lead.id);
        if (!row) continue;
        const fullName = row.full_name || [row.name, row.surname].filter(Boolean).join(" ");
        const patch: Parameters<typeof updateLead>[1] = {};
        if (fullName && fullName !== lead.name) patch.name = fullName;
        if (row.surname && row.surname !== lead.surname) patch.surname = row.surname;
        if (row.phone && row.phone !== lead.phone) patch.phone = row.phone;
        if (row.email && row.email !== lead.email) patch.email = row.email;
        if (Object.keys(patch).length > 0) updateLead(lead.id, patch);
      }
    })();
  }, [leads, updateLead]);
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("kanban");
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<Quick>("tutti");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragDisabledLeadId, setDragDisabledLeadId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStageKey | null>(null);
  const [notesLeadId, setNotesLeadId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const notesLead = notesLeadId ? leads.find((l) => l.id === notesLeadId) ?? null : null;
  const openNotes = (id: string, current: string) => {
    setNotesLeadId(id);
    setNotesDraft(current);
  };
  const saveNotes = () => {
    if (notesLeadId) updateLead(notesLeadId, { notes: notesDraft });
    setNotesLeadId(null);
  };

  const [apptLeadId, setApptLeadId] = useState<string | null>(null);
  const [apptTitle, setApptTitle] = useState("");
  const [apptDate, setApptDate] = useState("");
  const apptLead = apptLeadId ? leads.find((l) => l.id === apptLeadId) ?? null : null;
  const openAppt = (id: string) => {
    setApptLeadId(id);
    setApptTitle("");
    setApptDate("");
  };
  const saveAppt = async () => {
    if (!apptLeadId || !apptTitle || !apptDate) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activities").insert({
      title: apptTitle,
      due_date: new Date(apptDate).toISOString(),
      type: "meeting",
      contact_id: apptLeadId,
      user_id: user.id,
    });
    setApptLeadId(null);
  };

  const openLeadSheet = (id: string) => {
    navigate({ to: "/lead/$id", params: { id } });
  };

  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    source: "",
    notes: "",
  });
  const fontiLead = useOptionList("fonti_lead");
  const aziende = useAziende();
  const [newAziendaOpen, setNewAziendaOpen] = useState(false);
  const [newAziendaNome, setNewAziendaNome] = useState("");
  const [newAziendaPiva, setNewAziendaPiva] = useState("");
  const resetNewLead = () =>
    setNewLead({ name: "", phone: "", email: "", company: "", source: "", notes: "" });
  const saveNewLead = () => {
    if (!newLead.name.trim()) return;
    addLead({
      name: newLead.name.trim(),
      phone: newLead.phone.trim() || undefined,
      email: newLead.email.trim() || undefined,
      source: newLead.source.trim() || undefined,
      value: 0,
      stage: "nuovo_da_chiamare",
      notes: newLead.notes.trim() || undefined,
    });
    setAddOpen(false);
    resetNewLead();
  };

  const confirmCreateAzienda = () => {
    if (!newAziendaNome.trim()) return;
    aziendeStore.add({ nome: newAziendaNome.trim(), partitaIva: newAziendaPiva.trim() || undefined });
    // Procedi col salvataggio del lead usando il nome appena creato
    const draft = { ...newLead, company: newAziendaNome.trim() };
    addLead({
      name: draft.name.trim(),
      phone: draft.phone.trim() || undefined,
      email: draft.email.trim() || undefined,
      company: draft.company || undefined,
      source: draft.source.trim() || undefined,
      value: 0,
      stage: "nuovo_da_chiamare",
      notes: draft.notes.trim() || undefined,
    });
    setNewAziendaOpen(false);
    setAddOpen(false);
    resetNewLead();
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return leads.filter((l) => {
      if (query && !`${l.name} ${l.phone ?? ""} ${l.source ?? ""}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (quick === "scaduti" && l.dueDate && l.dueDate >= now) return false;
      if (quick === "oggi" && (!l.dueDate || l.dueDate < startOfDay || l.dueDate.getDate() !== now.getDate()))
        return false;
      if (quick === "settimana") {
        const weekEnd = new Date(startOfDay);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (!l.dueDate || l.dueDate < startOfDay || l.dueDate > weekEnd) return false;
      }
      return true;
    });
  }, [leads, query, quick]);

  const byStage = useMemo(() => {
    const map = new Map<LeadStageKey, typeof leads>();
    LEAD_STAGES.forEach((s) => map.set(s.key, []));
    filtered.forEach((l) => map.get(l.stage)?.push(l));
    return map;
  }, [filtered]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Top header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1 text-base font-semibold">
            1. Gestione Nuovi Lead <ChevronDown className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-xs">{leads.length} lead</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-lg border border-border bg-background p-0.5 sm:flex">
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setView("list")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-1">
            <Download className="h-4 w-4" /> Importa
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Aggiungi opportunità
          </Button>
          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1 rounded-full bg-primary/5 text-primary border-primary/30">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtri avanzati
          </Button>
          <Button variant="outline" size="sm" className="gap-1 rounded-full bg-primary/5 text-primary border-primary/30">
            <ArrowDownUp className="h-3.5 w-3.5" /> Ordina (1)
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca Lead"
              className="h-9 w-64 rounded-full pl-9"
            />
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Settings2 className="h-4 w-4" /> Gestisci campi
          </Button>
        </div>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["tutti", "Tutti", null] as const,
            ["scaduti", "Scaduti", "(1)"] as const,
            ["oggi", "Oggi", null] as const,
            ["settimana", "Questa settimana", null] as const,
          ]).map(([id, label, badge]) => (
            <button
              key={id}
              onClick={() => setQuick(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                quick === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {id === "scaduti" && <Clock className="h-3 w-3" />}
              {id === "oggi" && <Clock className="h-3 w-3" />}
              {id === "settimana" && <CalendarIcon className="h-3 w-3" />}
              {label} {badge}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs">
          Ordina per data <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Board */}
      {view === "kanban" ? (
        <div className="flex flex-1 gap-3 overflow-x-auto bg-muted/30 p-4">
          {LEAD_STAGES.map((stage) => {
            const items = byStage.get(stage.key) ?? [];
            const total = items.reduce((acc, x) => acc + (x.value ?? 0), 0);
            const isOver = dragOver === stage.key;
            return (
              <div
                key={stage.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage.key);
                }}
                onDragLeave={() => setDragOver((s) => (s === stage.key ? null : s))}
                onDrop={() => {
                  if (draggingId) moveLead(draggingId, stage.key);
                  setDraggingId(null);
                  setDragOver(null);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-xl",
                  isOver && "ring-2 ring-primary/40"
                )}
              >
                <div className={cn("rounded-t-xl border-t-4 bg-card px-3 py-2", stage.border)}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">{stage.label}</div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {items.length} Opportunità € {total.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {items.map((lead) => (
                    <article
                      key={lead.id}
                      draggable={dragDisabledLeadId !== lead.id}
                      onDragStart={() => setDraggingId(lead.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={cn(
                        "group rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
                        draggingId === lead.id && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/lead/$id"
                          params={{ id: lead.id }}
                          draggable={false}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setDragDisabledLeadId(lead.id);
                          }}
                          onPointerUp={() => setDragDisabledLeadId(null)}
                          onPointerCancel={() => setDragDisabledLeadId(null)}
                          onDragStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragDisabledLeadId(null);
                            openLeadSheet(lead.id);
                          }}
                          className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          {lead.name}
                        </Link>
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white", lead.avatarColor)}>
                          {lead.initials}
                        </div>
                      </div>
                      <dl className="mt-2 space-y-1 text-xs">
                        <Row label="Azienda" value={lead.company ?? "Privato"} />
                        <Row label="Telefono" value={lead.phone ?? "—"} />
                        <Row label="Fonte" value={lead.source ?? "—"} />
                      </dl>
                      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                        <span>{lead.createdLabel}</span>
                        <span className={cn(lead.overdueLabel && "text-rose-600 font-medium")}>
                          {lead.overdueLabel ?? lead.dueLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <ActionIcon
                            Icon={Phone}
                            title="Chiama"
                            href={lead.phone ? `tel:${lead.phone.replace(/\s+/g, "")}` : undefined}
                          />
                          <ActionIcon
                            Icon={WhatsAppIcon}
                            title="WhatsApp"
                            className="text-emerald-600 hover:bg-emerald-50"
                            href={
                              lead.phone
                                ? `https://wa.me/${lead.phone.replace(/[^\d]/g, "")}`
                                : undefined
                            }
                            external
                          />
                          <ActionIcon
                            Icon={FileText}
                            title="Note"
                            onClick={() => openNotes(lead.id, lead.notes)}
                          />
                          <ActionIcon Icon={CalendarPlus} title="Nuovo appuntamento" onClick={() => openAppt(lead.id)} />
                          <StageMenu
                            currentStage={lead.stage}
                            onChange={(s) => moveLead(lead.id, s)}
                          />
                          <ActionIcon Icon={Flag} title="Segnala come perso" onClick={() => moveLead(lead.id, "persa")} />
                        </div>
                        <button
                          onClick={() => {
                            // Eliminando il lead, rimuovi anche il
                            // cliente collegato per id/nome/telefono/email cosi
                            // non resta nella rubrica privati.
                            clientiStore.removeByContact({
                              id: lead.id,
                              name: lead.name,
                              phone: lead.phone,
                              email: lead.email,
                            });
                            deleteLead(lead.id);
                          }}
                          className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                      Nessun lead
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nominativo</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Fonte</th>
                <th className="px-3 py-2">Creato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const stage = LEAD_STAGES.find((s) => s.key === l.stage)!;
                return (
                  <tr key={l.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link
                        to="/lead/$id"
                        params={{ id: l.id }}
                        onClick={(e) => {
                          e.preventDefault();
                          openLeadSheet(l.id);
                        }}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs", stage.pill)}>{stage.label}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.source ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.createdLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!notesLeadId} onOpenChange={(open) => !open && setNotesLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note · {notesLead?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Scrivi una nota su questo lead…"
            rows={6}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesLeadId(null)}>Annulla</Button>
            <Button onClick={saveNotes}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!apptLeadId} onOpenChange={(open) => !open && setApptLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo appuntamento · {apptLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={apptTitle}
              onChange={(e) => setApptTitle(e.target.value)}
              placeholder="Titolo appuntamento"
            />
            <Input
              type="datetime-local"
              value={apptDate}
              onChange={(e) => setApptDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApptLeadId(null)}>Annulla</Button>
            <Button onClick={saveAppt}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetNewLead(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova opportunità</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="Nominativo *"
              value={newLead.name}
              onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Telefono"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
              />
              <Input
                placeholder="Email"
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={newLead.source}
              onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
            >
              <option value="">Provenienza lead…</option>
              {fontiLead.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <Textarea
              rows={3}
              placeholder="Note (opzionale)…"
              value={newLead.notes}
              onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetNewLead(); }}>Annulla</Button>
            <Button onClick={saveNewLead} disabled={!newLead.name.trim()}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog secondario: creazione nuova azienda quando non trovata */}
      <Dialog open={newAziendaOpen} onOpenChange={setNewAziendaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova azienda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              "{newAziendaNome}" non è presente nelle Aziende. Inserisci i dati per crearla.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Nome azienda</Label>
              <Input value={newAziendaNome} onChange={(e) => setNewAziendaNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Partita IVA</Label>
              <Input value={newAziendaPiva} onChange={(e) => setNewAziendaPiva(e.target.value)} placeholder="11 cifre" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAziendaOpen(false)}>Annulla</Button>
            <Button onClick={confirmCreateAzienda} disabled={!newAziendaNome.trim()}>
              Crea azienda e lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ActionIcon({
  Icon,
  title,
  href,
  external,
  to,
  params,
  className,
  onClick,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title?: string;
  href?: string;
  external?: boolean;
  to?: string;
  params?: Record<string, string>;
  className?: string;
  onClick?: () => void;
}) {
  const cls = cn("rounded p-1 hover:bg-muted transition", className);
  if (to) {
    return (
      <Link to={to as any} params={params as any} title={title} className={cls} onClick={(e) => e.stopPropagation()}>
        <Icon className="h-3.5 w-3.5" />
      </Link>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        title={title}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cls}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="h-3.5 w-3.5" />
      </a>
    );
  }
  return (
    <button
      type="button"
      title={title}
      className={cls}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.11 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.27-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.84-7.01zM12.04 20.15h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.13.82.83-3.05-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.23 8.23zm4.51-6.16c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.45-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.12.16 1.73 2.64 4.19 3.7.58.25 1.04.4 1.4.51.59.19 1.12.16 1.55.1.47-.07 1.46-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28z"/>
    </svg>
  );
}

function StageMenu({
  currentStage,
  onChange,
}: {
  currentStage: LeadStageKey;
  onChange: (s: LeadStageKey) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded p-1 hover:bg-muted">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">Cambia stato</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LEAD_STAGES.map((s) => (
          <DropdownMenuItem
            key={s.key}
            onClick={() => onChange(s.key)}
            className={cn(s.key === currentStage && "font-semibold text-primary")}
          >
            {s.key === currentStage && "✓ "}
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}