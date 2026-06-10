import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  RefreshCw,
  Phone,
  Mail,
  ExternalLink,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  CalendarDays,
  X,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useRinnoviStore,
  type Rinnovo,
  type RinnovoStato,
} from "@/lib/rinnovi-store";

export const Route = createFileRoute("/_authenticated/rinnovi")({
  head: () => ({ meta: [{ title: "Rinnovi · LeadValue" }] }),
  component: RinnoviPage,
});

type ColDef = { key: RinnovoStato; title: string; accent: string };
const COLUMNS: ColDef[] = [
  { key: "da_contattare", title: "Da Contattare", accent: "bg-sky-500" },
  { key: "contattato", title: "Contattato", accent: "bg-amber-500" },
  { key: "interessato", title: "Interessato", accent: "bg-violet-500" },
  { key: "non_interessato", title: "Non Interessato", accent: "bg-rose-500" },
  { key: "rinnovato", title: "Rinnovato", accent: "bg-emerald-500" },
];

const STATO_LABEL: Record<RinnovoStato, string> = {
  da_contattare: "Da Contattare",
  contattato: "Contattato",
  interessato: "Interessato",
  non_interessato: "Non Interessato",
  rinnovato: "Rinnovato",
};

function formatEuro(n: number) {
  return `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`;
}

function RinnoviPage() {
  const { rinnovi, setStato, hide } = useRinnoviStore();
  const [filter, setFilter] = useState<"Tutti" | "CQS" | "Delega">("Tutti");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rinnovi.filter((r) => {
      if (filter !== "Tutti" && r.tipo !== filter) return false;
      if (!q) return true;
      return (
        r.nome.toLowerCase().includes(q) ||
        r.cognome.toLowerCase().includes(q) ||
        r.banca.toLowerCase().includes(q)
      );
    });
  }, [rinnovi, filter, query]);

  const byColumn = useMemo(() => {
    const map: Record<RinnovoStato, Rinnovo[]> = {
      da_contattare: [],
      contattato: [],
      interessato: [],
      non_interessato: [],
      rinnovato: [],
    };
    filtered.forEach((r) => map[r.stato].push(r));
    return map;
  }, [filtered]);

  const current = selected ? rinnovi.find((r) => r.id === selected) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-2 rounded-full border-border/60 bg-card px-3 py-1.5 text-sm font-semibold">
            <RefreshCw className="h-4 w-4 text-primary" />
            Rinnovi
          </Badge>
          <Badge className="rounded-full bg-primary/15 text-primary hover:bg-primary/15">
            {filtered.length} rinnovi
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/60 bg-card p-0.5">
            {(["Tutti", "CQS", "Delega"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === opt
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca cliente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-56 bg-card pl-9"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pagination chevrons */}
      <div className="flex justify-end gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Board */}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = byColumn[col.key];
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
                <div className={cn("h-1 w-full", col.accent)} />
                <div className="px-4 py-3">
                  <div className="text-sm font-semibold text-foreground">{col.title}</div>
                  <div className="text-xs text-muted-foreground">{items.length} clienti</div>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="grid h-32 place-items-center rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center gap-1.5 opacity-60">
                    <RefreshCw className="h-5 w-5" />
                    Nessun rinnovo
                  </div>
                </div>
              ) : (
                items.map((r) => (
                  <RinnovoCard
                    key={r.id}
                    rinnovo={r}
                    onOpen={() => setSelected(r.id)}
                    onHide={() => hide(r.id)}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Detail drawer */}
      {current && (
        <DetailDrawer
          rinnovo={current}
          onClose={() => setSelected(null)}
          onChangeStato={(s) => setStato(current.id, s)}
          onHide={() => {
            hide(current.id);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function RinnovoCard({
  rinnovo,
  onOpen,
  onHide,
}: {
  rinnovo: Rinnovo;
  onOpen: () => void;
  onHide: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-foreground">
          {rinnovo.cognome} {rinnovo.nome}
        </div>
        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
          {rinnovo.tipo}
        </Badge>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Rata</dt>
          <dd className="font-medium text-foreground">{formatEuro(rinnovo.rata)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Durata</dt>
          <dd className="font-medium text-foreground">{rinnovo.durataMesi} mesi</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Banca</dt>
          <dd className="font-medium text-foreground">{rinnovo.banca}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-700">
          <CalendarDays className="h-3.5 w-3.5" />
          Rinnovabile
        </div>
        <div className="text-xs font-semibold text-violet-700">{rinnovo.dataRinnovabilita}</div>
      </div>

      <TooltipProvider>
        <div
          className="mt-3 flex items-center justify-between border-t border-border/60 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={`tel:${rinnovo.telefono}`} className="rounded-md p-1.5 hover:bg-secondary hover:text-foreground">
                  <Phone className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Chiama</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={`mailto:${rinnovo.email}`} className="rounded-md p-1.5 hover:bg-secondary hover:text-foreground">
                  <Mail className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Email</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onOpen} className="rounded-md p-1.5 hover:bg-secondary hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Apri dettaglio</TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onHide}
                className="rounded-md p-1.5 text-rose-500 opacity-0 transition-opacity hover:bg-rose-50 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Nascondi dai rinnovi</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

function DetailDrawer({
  rinnovo,
  onClose,
  onChangeStato,
  onHide,
}: {
  rinnovo: Rinnovo;
  onClose: () => void;
  onChangeStato: (s: RinnovoStato) => void;
  onHide: () => void;
}) {
  const navigate = useNavigate();
  const clienteId = rinnovo.clienteId ?? rinnovo.id;
  const waNumber = rinnovo.telefono.replace(/[^\d]/g, "");

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RefreshCw className="h-4 w-4 text-primary" />
            Dettaglio Rinnovo
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={cn("grid h-12 w-12 place-items-center rounded-full text-base font-bold text-white", rinnovo.avatarColor)}>
              {rinnovo.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">
                {rinnovo.nome} {rinnovo.cognome}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {rinnovo.telefono} · {rinnovo.email}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</div>
              <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                {rinnovo.tipo}
              </Badge>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stato</div>
              <Select value={rinnovo.stato} onValueChange={(v) => onChangeStato(v as RinnovoStato)}>
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {STATO_LABEL[c.key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
              <CalendarDays className="h-4 w-4" />
              Data Rinnovabilità
            </div>
            <div className="text-sm font-semibold text-violet-700">{rinnovo.dataRinnovabilita}</div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dati finanziari
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              {[
                ["Rata mensile", formatEuro(rinnovo.rata)],
                ["Durata", `${rinnovo.durataMesi} mesi`],
                ["Decorrenza", rinnovo.decorrenza],
                ["Banca", rinnovo.banca],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm",
                    i % 2 ? "bg-secondary/40" : "bg-card",
                  )}
                >
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 px-5 py-3">
          <Button
            className="flex-1 gap-2"
            onClick={() => navigate({ to: "/clienti/$id", params: { id: clienteId } })}
          >
            <ExternalLink className="h-4 w-4" />
            Apri Scheda
          </Button>
          <Button
            asChild
            className="flex-1 gap-2 bg-emerald-500 text-white hover:bg-emerald-600"
          >
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
          <Button variant="outline" size="icon" onClick={onHide} className="text-rose-500 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </aside>
    </div>
  );
}
