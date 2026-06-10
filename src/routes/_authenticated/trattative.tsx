import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Handshake, Search, Trophy, XCircle, Mail, Phone, Clock } from "lucide-react";
import { useLeadsStore, LEAD_STAGES, type LeadStageKey } from "@/lib/leads-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trattative")({
  head: () => ({ meta: [{ title: "Trattative · LeadValue" }] }),
  component: TrattativePage,
});

const TRATT_STAGES: LeadStageKey[] = ["preventivo_inviato", "in_trattativa"];

const stageMeta = (key: LeadStageKey) => LEAD_STAGES.find((s) => s.key === key)!;

function TrattativePage() {
  const { leads, moveLead } = useLeadsStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | LeadStageKey>("all");

  const trattative = useMemo(
    () => leads.filter((l) => TRATT_STAGES.includes(l.stage)),
    [leads],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return trattative.filter((l) => {
      if (filter !== "all" && l.stage !== filter) return false;
      if (!term) return true;
      return (
        l.name.toLowerCase().includes(term) ||
        (l.email ?? "").toLowerCase().includes(term) ||
        (l.phone ?? "").toLowerCase().includes(term) ||
        (l.company ?? "").toLowerCase().includes(term)
      );
    });
  }, [trattative, q, filter]);

  const counts = {
    preventivo_inviato: trattative.filter((l) => l.stage === "preventivo_inviato").length,
    in_trattativa: trattative.filter((l) => l.stage === "in_trattativa").length,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow">
            <Handshake className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-foreground">Trattative</h1>
            <p className="text-sm text-muted-foreground">Lead in fase di preventivo e trattativa</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
              filter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            Totale: {trattative.length}
          </button>
          <button
            onClick={() => setFilter("preventivo_inviato")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              filter === "preventivo_inviato" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100",
            )}
          >
            📄 Preventivo Inviato <span className="opacity-80">{counts.preventivo_inviato}</span>
          </button>
          <button
            onClick={() => setFilter("in_trattativa")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              filter === "in_trattativa" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
            )}
          >
            🤝 In Trattativa <span className="opacity-80">{counts.in_trattativa}</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome, cognome, email, telefono, azienda, città..."
          className="w-full rounded-xl border border-border/60 bg-card py-3 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-primary"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/40 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left">Nominativo</th>
                <th className="px-4 py-3 text-left">Contatti</th>
                <th className="px-4 py-3 text-left">Prodotto</th>
                <th className="px-4 py-3 text-left">Stato</th>
                <th className="px-4 py-3 text-left">Aggiornato</th>
                <th className="px-4 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const s = stageMeta(l.stage);
                return (
                  <tr key={l.id} className="border-b border-border/40 transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link to="/lead/$id" params={{ id: l.id }} className="group flex items-center gap-3">
                        <div className={cn("grid h-10 w-10 place-items-center rounded-full text-xs font-bold text-white shadow", l.avatarColor)}>
                          {l.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary">{l.name}</div>
                          {l.company && <div className="text-xs text-muted-foreground">{l.company}</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {l.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {l.phone}
                          </div>
                        )}
                        {l.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" /> {l.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">N/D</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", s.pill)}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {l.createdLabel}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => moveLead(l.id, "accettato")}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          <Trophy className="h-3.5 w-3.5" /> Vinta
                        </button>
                        <button
                          onClick={() => moveLead(l.id, "persa")}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Persa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nessuna trattativa trovata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}