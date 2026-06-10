import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Filter, Mail, Phone, Search, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useClientiStore, type Cliente } from "@/lib/clienti-store";
import { useLeadsStore } from "@/lib/leads-store";

export const Route = createFileRoute("/_authenticated/clienti/")({
  head: () => ({ meta: [{ title: "Clienti Acquisiti · LeadValue" }] }),
  component: ClientiPage,
});

const bancaToneClass: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function ClientiPage() {
  const { clienti } = useClientiStore();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clienti;
    return clienti.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q),
    );
  }, [clienti, query]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Clienti Acquisiti</h1>
            <p className="text-xs text-muted-foreground">Portafoglio clienti con pratiche liquidate</p>
          </div>
        </div>
        <div className="rounded-md border border-border px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">TOTALE</span>{" "}
          <span className="ml-1 font-semibold text-foreground">{clienti.length}</span>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-border bg-card px-6 py-3">
        <div className="relative flex-1 max-w-2xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome, cognome, email, telefono, azienda, città..."
            className="h-10 pl-10"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" /> Filtro
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-muted/30 px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-3">Nominativo</div>
          <div className="col-span-3">Contatti</div>
          <div className="col-span-2">Prodotto / Stato</div>
          <div className="col-span-2">Banca mandante</div>
          <div className="col-span-2 text-right">Data rinnovo</div>
        </div>

        <ul className="divide-y divide-border bg-card">
          {filtered.map((c) => (
            <ClienteRow key={c.id} c={c} />
          ))}
          {filtered.length === 0 && (
            <li className="px-6 py-12 text-center text-sm text-muted-foreground">Nessun cliente trovato.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function ClienteRow({ c }: { c: Cliente }) {
  const navigate = useNavigate();
  const { findOrCreateLeadByContact } = useLeadsStore();
  const goToScheda = () => {
    const leadId = findOrCreateLeadByContact({
      name: c.name,
      phone: c.phone,
      email: c.email,
      source: "cliente-acquisito",
      stage: "accettato",
    });
    navigate({ to: "/lead/$id", params: { id: leadId } });
  };
  return (
    <li>
      <button
        type="button"
        onClick={goToScheda}
        className="grid w-full grid-cols-12 items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="col-span-3 flex items-center gap-3 min-w-0">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", c.avatarColor)}>
            {c.initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
            <div className="truncate text-xs text-muted-foreground">📍 {c.city}</div>
          </div>
        </div>

        <div className="col-span-3 space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{c.phone}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{c.email}</span>
          </div>
        </div>

        <div className="col-span-2 space-y-1">
          <div className="text-xs text-foreground">{c.prodotto}</div>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">● LIQUIDATO</Badge>
        </div>

        <div className="col-span-2">
          {c.banca && c.bancaTone ? (
            <Badge variant="outline" className={cn("font-semibold", bancaToneClass[c.bancaTone])}>
              {c.banca}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        <div className="col-span-2 flex items-center justify-end gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarIcon className="h-3 w-3" />
            {c.dataRinnovo ?? "N/D"}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </button>
    </li>
  );
}