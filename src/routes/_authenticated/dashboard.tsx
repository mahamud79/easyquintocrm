import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Logo";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Wallet,
  ListChecks,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Euro,
  BarChart3,
  Sparkles,
  CheckCircle2,
  Loader2,
  Settings,
} from "lucide-react";
import { Clock, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLiquidatoStore } from "@/lib/liquidato-store";
import { praticaMontanteLordo, usePraticheStore, type PraticaStageKey } from "@/lib/pratiche-store";
import { useLeadsStore } from "@/lib/leads-store";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · LeadValue" },
      { name: "description", content: "Valore economico pratiche, promemoria, attività e pipeline lead." },
    ],
  }),
  component: DashboardPage,
});

type DealRow = { value: number | null; stage: string | null; updated_at?: string | null };
type ActivityRow = {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  contact_id: string | null;
  type: string | null;
};
type ContactRow = { id: string; full_name: string | null };

const fmt = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v < 0 ? "-" : "";
  const [intPart, decPart] = Math.abs(v).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}€ ${grouped},${decPart}`;
};

const MESI = Array.from({ length: 12 }, (_, i) =>
  new Date(2026, i, 1).toLocaleDateString("it-IT", { month: "long" }),
);

const ANNI = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 4 + i);

const leadMontante = (lead: { value?: number | null }) => Number(lead.value ?? 0) || 0;
const leadProvvigione = (lead: { value?: number | null; provvigione?: number | null }) => {
  const savedProvvigione = Number(lead.provvigione ?? 0) || 0;
  return savedProvvigione > 0 ? savedProvvigione : leadMontante(lead) * 0.04;
};

function DashboardPage() {
  const [deals, setDeals] = useState<DealRow[] | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"provvigioni" | "montante">("provvigioni");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [liquidateMonth, setLiquidateMonth] = useState<Date>(() => new Date());

  const { rows: liquidateRows } = useLiquidatoStore();
  const { pratiche } = usePraticheStore();
  const { leads } = useLeadsStore();


  const refreshActivities = async () => {
    const { data } = await supabase
      .from("activities")
      .select("id, title, due_date, completed, contact_id, type")
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8);
    setActivities((data ?? []) as ActivityRow[]);
  };

  useEffect(() => {
    (async () => {
      const [dealsRes, activitiesRes, contactsRes] = await Promise.all([
        supabase.from("deals").select("value, stage, updated_at"),
        supabase
          .from("activities")
          .select("id, title, due_date, completed, contact_id, type")
          .order("completed", { ascending: true })
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(8),
        supabase.from("contacts").select("id, full_name"),
      ]);
      setDeals((dealsRes.data ?? []) as DealRow[]);
      setActivities((activitiesRes.data ?? []) as ActivityRow[]);
      const map: Record<string, string> = {};
      for (const c of (contactsRes.data ?? []) as ContactRow[]) {
        if (c.id) map[c.id] = c.full_name ?? "—";
      }
      setContacts(map);
      setLoading(false);
    })();
  }, []);

  // Aggregazioni dai dati live dell'app
  const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0);

  // 1) Preventivo inviato → leads nello stage "preventivo_inviato"
  const preventivoLeads = leads.filter((l) => l.stage === "preventivo_inviato");
  const preventivoMontante = sum(preventivoLeads.map(leadMontante));
  const preventivoProvv = sum(preventivoLeads.map(leadProvvigione));

  // 2) In trattativa → leads nello stage "in_trattativa"
  const trattativaLeads = leads.filter((l) => l.stage === "in_trattativa");
  const trattativaMontante = sum(trattativaLeads.map(leadMontante));
  const trattativaProvv = sum(trattativaLeads.map(leadProvvigione));

  // 3) In lavorazione → pratiche attive (escluso passate, respinta, liquidata)
  const stageEscluse: PraticaStageKey[] = ["passate", "respinta", "liquidata"];
  const praticheAttive = pratiche.filter((p) => !stageEscluse.includes(p.stage));
  const lavorazioneMontante = sum(praticheAttive.map(praticaMontanteLordo));
  const lavorazioneProvv = sum(praticheAttive.map((p) => p.provvigione));

  // 4) Liquidate → pratiche liquidate nel mese selezionato
  const sameYM = (iso: string, d: Date) => {
    const x = new Date(iso);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
  };
  const liquidateDateByPratica = new Map(
    liquidateRows
      .filter((r) => r.id.startsWith("liq-p-"))
      .map((r) => [r.id.replace(/^liq-/, ""), r.dataLiq]),
  );
  const praticheLiquidate = pratiche.filter((p) => {
    if (p.stage !== "liquidata") return false;
    const dataLiq = liquidateDateByPratica.get(p.id);
    return dataLiq ? sameYM(dataLiq, liquidateMonth) : sameYM(new Date().toISOString(), liquidateMonth);
  });
  const liquidateProvv = sum(praticheLiquidate.map((p) => p.provvigione));
  const liquidateMontante = sum(praticheLiquidate.map(praticaMontanteLordo));
  const monthLabel = liquidateMonth.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const shiftLiquidateMonth = (delta: number) => {
    setLiquidateMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const cards = [
    {
      key: "preventivo",
      label: "Preventivo inviato",
      count: preventivoLeads.length,
      provvigioni: preventivoProvv,
      montante: preventivoMontante,
      tone: "violet",
      live: true,
    },
    {
      key: "trattativa",
      label: "In trattativa",
      count: trattativaLeads.length,
      provvigioni: trattativaProvv,
      montante: trattativaMontante,
      tone: "sky",
      live: true,
    },
    {
      key: "lavorazione",
      label: "In lavorazione",
      count: praticheAttive.length,
      provvigioni: lavorazioneProvv,
      montante: lavorazioneMontante,
      tone: "amber",
      live: true,
    },
    {
      key: "liquidate",
      label: "Liquidate",
      count: praticheLiquidate.length,
      provvigioni: liquidateProvv,
      montante: liquidateMontante,
      tone: "emerald",
      live: false,
    },
  ] as const;
  // suppress unused-deals warning while we keep the supabase fetch for activities/contacts
  void deals;

  const toneStyles: Record<string, { bg: string; ring: string; text: string; badge: string; chip: string }> = {
    violet: {
      bg: "bg-violet-50",
      ring: "ring-violet-200/70",
      text: "text-violet-700",
      badge: "bg-violet-600 text-white",
      chip: "text-violet-700",
    },
    sky: {
      bg: "bg-sky-50",
      ring: "ring-sky-200/70",
      text: "text-sky-700",
      badge: "bg-sky-600 text-white",
      chip: "text-sky-700",
    },
    amber: {
      bg: "bg-amber-50",
      ring: "ring-amber-200/70",
      text: "text-amber-700",
      badge: "bg-amber-500 text-white",
      chip: "text-amber-700",
    },
    emerald: {
      bg: "bg-emerald-50",
      ring: "ring-emerald-200/70",
      text: "text-emerald-700",
      badge: "bg-emerald-600 text-white",
      chip: "text-emerald-700",
    },
  };


  return (
    <div className="space-y-6">
      {/* Brand header (mirrors original) */}
      <div className="flex items-center gap-3">
        <Wordmark className="h-12" />
      </div>

      {/* Valore economico card group */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">Valore Economico Pratiche</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 p-0.5 text-emerald-700">
              <button
                type="button"
                onClick={() => shiftLiquidateMonth(-1)}
                className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-emerald-100"
                title="Mese precedente"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex h-7 items-center gap-1 rounded-full px-1 text-xs font-semibold uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" />
                <select
                  value={liquidateMonth.getMonth()}
                  onChange={(e) =>
                    setLiquidateMonth((prev) => new Date(prev.getFullYear(), Number(e.target.value), 1))
                  }
                  className="h-6 rounded-full border-0 bg-transparent px-1 text-xs font-semibold capitalize outline-none hover:bg-emerald-100"
                  title="Scegli mese"
                >
                  {MESI.map((mese, index) => (
                    <option key={mese} value={index}>
                      {mese}
                    </option>
                  ))}
                </select>
                <select
                  value={liquidateMonth.getFullYear()}
                  onChange={(e) =>
                    setLiquidateMonth((prev) => new Date(Number(e.target.value), prev.getMonth(), 1))
                  }
                  className="h-6 rounded-full border-0 bg-transparent px-1 text-xs font-semibold outline-none hover:bg-emerald-100"
                  title="Scegli anno"
                >
                  {ANNI.map((anno) => (
                    <option key={anno} value={anno}>
                      {anno}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => shiftLiquidateMonth(1)}
                className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-emerald-100"
                title="Mese successivo"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex overflow-hidden rounded-full border border-border bg-secondary p-0.5">
              <button
                onClick={() => setView("provvigioni")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  view === "provvigioni"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Euro className="h-3.5 w-3.5" />
                Provvigioni
              </button>
              <button
                onClick={() => setView("montante")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  view === "montante"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Montante
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => {
            const t = toneStyles[c.tone];
            const value = view === "provvigioni" ? c.provvigioni : c.montante;
            const montante = c.montante;
            const provvigioni = c.provvigioni;
            return (
              <div
                key={c.key}
                className={cn(
                  "rounded-2xl p-5 ring-1 transition hover:-translate-y-0.5 hover:shadow-md",
                  t.bg,
                  t.ring,
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet className={cn("h-4 w-4", t.text)} />
                    <span className={cn("text-[11px] font-bold uppercase tracking-wider", t.text)}>
                      {c.label}
                    </span>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", t.badge)}>
                    {c.count} {c.count === 1 ? "pratica" : "pratiche"}
                  </span>
                </div>
                <div className={cn("text-3xl font-bold tracking-tight", t.text)}>
                  {fmt(value)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{view === "provvigioni" ? "Provvigioni totali" : "Montante totali"}</span>
                  {c.live ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      LIVE
                    </span>
                  ) : (
                    <span className="capitalize">{monthLabel}</span>
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-card/70 p-3 text-xs">
                  <div className="mb-1 font-bold text-foreground">Riepilogo</div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Montante Lordo:</span>
                    <span className="font-semibold text-foreground">{fmt(montante)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provvigioni:</span>
                    <span className={cn("rounded-md px-1.5 font-bold", t.chip)}>{fmt(provvigioni)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Promemoria */}
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div className="flex items-center justify-between gap-3 bg-orange-500 px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20">
                <ListChecks className="h-4 w-4" />
              </div>
              <div>
                <div className="text-base font-bold">Promemoria</div>
                <div className="text-xs text-white/85">
                  {activities.filter((a) => !a.completed).length} da fare
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold transition",
                showCompleted ? "bg-white text-orange-600" : "bg-white/20 hover:bg-white/30"
              )}
              title={showCompleted ? "Mostra da fare" : "Mostra completati"}
            >
              {activities.filter((a) => a.completed).length} completati
            </button>
          </div>
          <div className="p-5">
            <ReminderDialog
              open={reminderOpen}
              onOpenChange={setReminderOpen}
              contacts={contacts}
              onCreated={refreshActivities}
            />
            {(showCompleted ? activities.filter((a) => a.completed) : activities.filter((a) => !a.completed)).length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="text-base font-semibold text-foreground">
                  {showCompleted ? "Nessun completato" : "Tutto fatto!"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {showCompleted ? "Non hai promemoria completati" : "Nessun promemoria in sospeso"}
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {(showCompleted ? activities.filter((a) => a.completed) : activities.filter((a) => !a.completed)).slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      title="Segna come completato"
                      checked={!!a.completed}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded-full border-border text-primary accent-primary focus:ring-primary"
                      onChange={async (e) => {
                        const next = e.target.checked;
                        const { error } = await supabase
                          .from("activities")
                          .update({ completed: next })
                          .eq("id", a.id);
                        if (error) toast.error("Errore nell'aggiornare");
                        else {
                          toast.success(next ? "Promemoria completato" : "Promemoria ripristinato");
                          refreshActivities();
                        }
                      }}
                    />
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <ListChecks className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate font-semibold text-foreground", a.completed && "line-through text-muted-foreground")}>{a.title}</div>
                      {a.contact_id && contacts[a.contact_id] && (
                        <div className={cn("truncate text-xs text-muted-foreground", a.completed && "line-through")}>{contacts[a.contact_id]}</div>
                      )}
                    </div>
                    {a.due_date && (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                        {new Date(a.due_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title="Rimanda"
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Rimanda
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <CalendarPicker
                            mode="single"
                            selected={a.due_date ? new Date(a.due_date) : undefined}
                            onSelect={async (d) => {
                              if (!d) return;
                              const prev = a.due_date ? new Date(a.due_date) : new Date();
                              d.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                              const { error } = await supabase
                                .from("activities")
                                .update({ due_date: d.toISOString() })
                                .eq("id", a.id);
                              if (error) toast.error("Errore nel rimandare");
                              else {
                                toast.success("Promemoria rimandato");
                                refreshActivities();
                              }
                            }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <button
                        type="button"
                        title="Elimina promemoria"
                        onClick={async () => {
                          const { error } = await supabase.from("activities").delete().eq("id", a.id);
                          if (error) toast.error("Errore nell'eliminare");
                          else {
                            toast.success("Promemoria eliminato");
                            refreshActivities();
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Elimina
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Attività Recenti */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Attività Recenti</h2>
          <p className="mb-4 text-sm text-muted-foreground">Appuntamenti e lead da contattare</p>

          <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <Calendar className="h-3.5 w-3.5" />
            APPUNTAMENTI — {activities.length}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary/40" />
              Nessun appuntamento programmato
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {activities.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    to="/attivita"
                    className="flex items-center gap-3 py-3 transition hover:bg-secondary/40 -mx-2 px-2 rounded-lg"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{a.title}</div>
                      {a.contact_id && contacts[a.contact_id] && (
                        <div className="truncate text-xs text-muted-foreground">{contacts[a.contact_id]}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-muted-foreground">
                        {a.due_date
                          ? new Date(a.due_date).toLocaleDateString("it-IT", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pipeline Lead - full status list */}
      <PipelineLeadSection />

      {/* Report fonte lead */}
      <LeadSourceReport totalLeads={(deals ?? []).length} />

      {/* Google Business Profile */}
      <GoogleBusinessSection />

      {/* Ads reports */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FacebookAdsCard />
        <GoogleAdsCard />
      </div>
    </div>
  );
}

/* ---------------- Pipeline Lead ---------------- */

import { LEAD_STAGES, type LeadStageKey } from "@/lib/leads-store";

const STAGE_STYLES: Record<LeadStageKey, { bg: string; faded?: boolean }> = {
  nuovo_da_chiamare: { bg: "bg-[#6c8fd1] text-white" },
  appuntamento_telefonico: { bg: "bg-[#5dc6c6] text-white" },
  tentativo_1: { bg: "bg-[#cbc3e6] text-slate-700", faded: true },
  tentativo_2: { bg: "bg-[#cbc3e6] text-slate-700", faded: true },
  tentativo_3: { bg: "bg-[#cbc3e6] text-slate-700", faded: true },
  non_reperibili: { bg: "bg-[#9ca3af] text-white" },
  non_fattibili: { bg: "bg-[#f08585] text-white" },
  appuntamento_futuro: { bg: "bg-[#f5c451] text-slate-900" },
  richiesta_documenti: { bg: "bg-[#f0a23a] text-white" },
  documenti_non_inviati: { bg: "bg-[#f5d3b0] text-slate-700", faded: true },
  preventivo_da_inviare: { bg: "bg-[#c79de3] text-white" },
  preventivo_inviato: { bg: "bg-[#a155c9] text-white" },
  sollecito_risposta: { bg: "bg-[#e6cfb8] text-slate-700", faded: true },
  in_trattativa: { bg: "bg-[#e0b03a] text-slate-900" },
  persa: { bg: "bg-[#e54848] text-white" },
  accettato: { bg: "bg-[#3ea36b] text-white" },
};

const MESI_IT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

// Parse "01 giu 26 17:00" → Date
function parseCreatedLabel(label?: string | null): Date | null {
  if (!label) return null;
  const m = label.toLowerCase().match(/^(\d{1,2})\s+([a-z]{3})\.?\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MESI_IT.indexOf(m[2].slice(0, 3));
  if (mon < 0) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const hh = m[4] ? Number(m[4]) : 0;
  const mm = m[5] ? Number(m[5]) : 0;
  return new Date(year, mon, day, hh, mm);
}

function PipelineLeadSection() {
  const { leads } = useLeadsStore();
  const now = new Date();
  const [mode, setMode] = useState<"mese" | "intervallo" | "tutto">("tutto");
  const [month, setMonth] = useState<number>(now.getMonth());
  const [year, setYear] = useState<number>(now.getFullYear());
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => now.toISOString().slice(0, 10));

  const inRange = (d: Date | null) => {
    if (!d) return mode === "tutto";
    if (mode === "tutto") return true;
    if (mode === "mese") return d.getFullYear() === year && d.getMonth() === month;
    const f = new Date(from);
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    return d >= f && d <= t;
  };

  const filtered = useMemo(
    () => leads.filter((l) => inRange(parseCreatedLabel(l.createdLabel))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, mode, month, year, from, to],
  );

  const counts = useMemo(() => {
    const map = {} as Record<LeadStageKey, number>;
    for (const s of LEAD_STAGES) map[s.key] = 0;
    for (const l of filtered) map[l.stage] = (map[l.stage] ?? 0) + 1;
    return map;
  }, [filtered]);

  const totals = filtered.length;
  const won = counts.accettato ?? 0;
  const rate = totals ? (won / totals) * 100 : 0;

  // riavvia animazione quando cambia il filtro
  const animKey = `${mode}-${month}-${year}-${from}-${to}`;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">Pipeline Lead</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex overflow-hidden rounded-full border border-border bg-secondary p-0.5">
            {(["mese", "intervallo", "tutto"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold capitalize transition",
                  mode === k
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k}
              </button>
            ))}
          </div>

          {mode === "mese" && (
            <div className="flex items-center gap-2 animate-fade-in">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold capitalize"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2000, i).toLocaleDateString("it-IT", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold"
              >
                {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {mode === "intervallo" && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <span>Stato Lead</span>
        <span>Numero</span>
      </div>

      <div key={animKey} className="space-y-2">
        {LEAD_STAGES.map((s, i) => {
          const style = STAGE_STYLES[s.key];
          const count = counts[s.key] ?? 0;
          const faded = style.faded || count === 0;
          return (
            <Link
              key={s.key}
              to="/lead"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
              className="flex items-stretch gap-3 animate-fade-in transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.01]"
            >
              <div
                className={cn(
                  "flex flex-1 items-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition",
                  style.bg,
                  faded && "opacity-70",
                )}
              >
                {s.label}
              </div>
              <div className="grid w-16 place-items-center rounded-lg border border-border/60 bg-secondary/40 text-sm font-bold text-foreground transition-colors">
                <span key={count} className="inline-block animate-scale-in">{count}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-3">
        <span className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          Tasso di Conversione Globale
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-emerald-700">
            {won} completati su {totals} totali
          </span>
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">
            {rate.toFixed(2)}%
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Report sulla fonte dei lead ---------------- */

function LeadSourceReport({ totalLeads }: { totalLeads: number }) {
  const rows = [
    { source: "Totale", lead: 3, valore: "€0,00", aperta: 3, vinta: 0, persa: 0, abbandonato: 0, win: "0.00%", bold: true },
    { source: "Lead Banca", lead: 1, valore: "€0,00", aperta: 1, vinta: 0, persa: 0, abbandonato: 0, win: "0.00%" },
    { source: "META ADS", lead: 1, valore: "€0,00", aperta: 1, vinta: 0, persa: 0, abbandonato: 0, win: "0.00%" },
    { source: "Segnalazione", lead: 1, valore: "€0,00", aperta: 1, vinta: 0, persa: 0, abbandonato: 0, win: "0.00%" },
  ];

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Report sulla fonte dei lead</h2>
          <div className="mt-2 text-4xl font-extrabold text-foreground">{totalLeads || 3}</div>
          <div className="text-xs text-muted-foreground">lead totali registrati nel CRM</div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex overflow-hidden rounded-full border border-border bg-secondary p-0.5">
            <button className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm">Mese</button>
            <button className="rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground">Intervallo</button>
          </div>
          <select className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
            <option>Giugno</option>
          </select>
          <select className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
            <option>2026</option>
          </select>
          <select className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
            <option>Tutte le fonti</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="py-2 text-left">Fonte</th>
              <th className="py-2 text-right">Totale lead</th>
              <th className="py-2 text-right">Valori totali</th>
              <th className="py-2 text-right">Aperta</th>
              <th className="py-2 text-right">Vinta</th>
              <th className="py-2 text-right">Persa</th>
              <th className="py-2 text-right">Abbandonato</th>
              <th className="py-2 text-right">% di vittorie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r) => (
              <tr key={r.source} className={cn("text-foreground", r.bold && "font-semibold")}>
                <td className="py-3 text-left">{r.source}</td>
                <td className="py-3 text-right">{r.lead}</td>
                <td className="py-3 text-right">{r.valore}</td>
                <td className="py-3 text-right">{r.aperta}</td>
                <td className="py-3 text-right text-emerald-600">{r.vinta}</td>
                <td className="py-3 text-right text-rose-600">{r.persa}</td>
                <td className="py-3 text-right">{r.abbandonato}</td>
                <td className="py-3 text-right font-bold">{r.win}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- Google Business ---------------- */

function GoogleBusinessSection() {
  const metrics = [
    { label: "Visualizzazioni totali", value: 0 },
    { label: "Ricerche (desktop e dispositivi mobili)", value: 0 },
    { label: "Conversazioni", value: 0 },
    { label: "Visite del sito web", value: 0 },
    { label: "Mappe (desktop e dispositivi mobili)", value: 0 },
    { label: "Prenotazioni", value: 0 },
    { label: "Chiamate", value: 0 },
  ];
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Profilo Google Business</h2>
          <p className="text-xs text-muted-foreground">(Ultimi 30 giorni)</p>
        </div>
      </div>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Google Business Profile non collegato. I dati mostrati sono placeholder. Configura le credenziali API nelle impostazioni.
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-3xl font-bold text-foreground">{m.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Facebook Ads ---------------- */

function FacebookAdsCard() {
  return _FacebookAdsCard();
}

function ReminderDialog({
  open,
  onOpenChange,
  contacts,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: Record<string, string>;
  onCreated: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState("09:00");
  const [contactId, setContactId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setDueDate(undefined);
    setDueTime("09:00");
    setContactId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Inserisci un titolo");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      toast.error("Sessione scaduta");
      setSaving(false);
      return;
    }
    let dueIso: string | null = null;
    if (dueDate) {
      const [h, m] = dueTime.split(":").map(Number);
      const d = new Date(dueDate);
      d.setHours(h || 0, m || 0, 0, 0);
      dueIso = d.toISOString();
    }
    const { error } = await supabase.from("activities").insert({
      user_id: uid,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueIso,
      contact_id: contactId || null,
      type: "task",
      completed: false,
    });
    setSaving(false);
    if (error) {
      toast.error("Errore nel salvataggio: " + error.message);
      return;
    }
    toast.success("Promemoria creato");
    reset();
    onOpenChange(false);
    await onCreated();
  };

  const contactList = Object.entries(contacts);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button className="mb-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-muted-foreground transition hover:border-primary hover:text-primary">
          <Plus className="h-4 w-4" />
          Aggiungi promemoria...
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo promemoria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titolo *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Richiamare cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {dueDate ? dueDate.toLocaleDateString("it-IT") : "Seleziona"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={dueDate}
                    onSelect={(d) => { setDueDate(d); setPickerOpen(false); }}
                    initialFocus
                    className="pointer-events-auto p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ora</label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>
          {contactList.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contatto (opzionale)</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Nessuno</option>
                {contactList.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Dettagli..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea promemoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function _FacebookAdsCard() {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#1877f2] text-white text-sm font-bold">f</div>
          <h3 className="text-base font-bold text-foreground">Report di Facebook Ads</h3>
        </div>
        <button className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">Configura</button>
      </div>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        ⚠️ Facebook Ads non collegato. I dati mostrati sono esempi. Configura il token di accesso nelle impostazioni.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Clic totali</div>
          <div className="text-2xl font-bold text-foreground">826</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Spesa totale</div>
          <div className="text-2xl font-bold text-foreground">€ 535,98</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">CPC</div>
          <div className="text-2xl font-bold text-emerald-600">€ 0,65</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">CTR</div>
          <div className="text-2xl font-bold text-emerald-600">1,63%</div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Google Ads ---------------- */

function GoogleAdsCard() {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white border border-border text-sm font-bold text-[#4285f4]">G</div>
          <h3 className="text-base font-bold text-foreground">Report di Google Ads</h3>
        </div>
        <button className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">Configura</button>
      </div>
      <div className="grid place-items-center py-10 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-secondary text-muted-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div className="mb-1 font-semibold text-foreground">Google Ads non configurato</div>
        <p className="mb-4 max-w-sm text-xs text-muted-foreground">
          Collega il tuo account Google Ads per visualizzare clic, impressioni, spesa e conversioni in tempo reale.
        </p>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
          Collega Google Ads
        </button>
      </div>
    </section>
  );
}