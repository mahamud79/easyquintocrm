import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Package, Search, Phone, Mail, ExternalLink, ArrowUpDown, Calendar, Trash2 } from "lucide-react";
import { useLiquidatoStore } from "@/lib/liquidato-store";
import { usePraticheStore } from "@/lib/pratiche-store";
import { useClientiStore, clientiStore } from "@/lib/clienti-store";
import { computeMagazzinoRow, fmtMonthYear, type MagazzinoRow } from "@/lib/magazzino-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/magazzino")({
  head: () => ({ meta: [{ title: "Magazzino · LeadValue" }] }),
  component: MagazzinoPage,
});

type Filter = "tutti" | "cqs" | "delega";

const fmtEur = (n: number) =>
  n.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

const PRODOTTO_LABEL: Record<MagazzinoRow["prodotto"], string> = {
  CQS: "CQS",
  delega_pagamento: "Delega",
  Prestito: "Prestito",
  Mutuo: "Mutuo",
};

const PRODOTTO_TONE: Record<MagazzinoRow["prodotto"], string> = {
  CQS: "bg-violet-100 text-violet-700",
  delega_pagamento: "bg-amber-100 text-amber-700",
  Prestito: "bg-sky-100 text-sky-700",
  Mutuo: "bg-emerald-100 text-emerald-700",
};

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-indigo-100 text-indigo-700",
  "bg-fuchsia-100 text-fuchsia-700",
];
const avatarTone = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};

function badgeTone(gg: number): string {
  if (gg <= 150) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function MagazzinoPage() {
  const { rows: liqRows, removeRow } = useLiquidatoStore();
  const { pratiche } = usePraticheStore();
  const { clienti } = useClientiStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("tutti");
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const today = useMemo(() => new Date(), []);

  const praticaByLiqId = useMemo(() => {
    const m = new Map<string, (typeof pratiche)[number]>();
    for (const p of pratiche) m.set(`liq-${p.id}`, p);
    return m;
  }, [pratiche]);

  const clienteByName = useMemo(() => {
    const m = new Map<string, (typeof clienti)[number]>();
    for (const c of clienti) m.set(c.name.toLowerCase(), c);
    return m;
  }, [clienti]);

  const rows = useMemo(() => {
    return liqRows
      .filter((r) => !!r.dataLiq) // tutte le liquidate (decorrenza calcolata dalla data liq.)
      .map((r) => {
        const pratica = praticaByLiqId.get(r.id);
        const cliente = pratica?.clienteId
          ? clienti.find((c) => c.id === pratica.clienteId)
          : clienteByName.get(`${r.nome} ${r.cognome}`.toLowerCase());
        return computeMagazzinoRow(
          {
            ...r,
            banca: r.banca ?? pratica?.banca ?? cliente?.banca ?? null,
            rata: r.rata ?? pratica?.rata ?? null,
            durata: r.durata ?? pratica?.durata ?? null,
          },
          pratica?.telefono ?? cliente?.phone ?? null,
          today,
        );
      });
  }, [liqRows, praticaByLiqId, clienti, clienteByName, today]);

  const getClienteForRow = (r: MagazzinoRow) => {
    const pratica = praticaByLiqId.get(r.id);
    const byId = pratica?.clienteId ? clienti.find((c) => c.id === pratica.clienteId) : undefined;
    return byId ?? clienteByName.get(`${r.nome} ${r.cognome}`.toLowerCase()) ?? null;
  };

  const openSchedaCliente = (r: MagazzinoRow) => {
    const pratica = praticaByLiqId.get(r.id);
    const existing = getClienteForRow(r);
    const id = existing?.id ?? pratica?.clienteId ?? `cliente_mag_${`${r.nome}_${r.cognome}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    clientiStore.ensure({ id, name: `${r.nome} ${r.cognome}`.trim(), phone: r.telefono ?? existing?.phone, email: existing?.email });
    navigate({ to: "/clienti/$id", params: { id } });
  };

  const callCliente = (r: MagazzinoRow) => {
    const phone = r.telefono ?? getClienteForRow(r)?.phone;
    if (phone) window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
    else openSchedaCliente(r);
  };

  const mailCliente = (r: MagazzinoRow) => {
    const email = getClienteForRow(r)?.email;
    if (email) window.location.href = `mailto:${email}`;
    else openSchedaCliente(r);
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === "cqs") out = out.filter((r) => r.prodotto === "CQS");
    else if (filter === "delega") out = out.filter((r) => r.prodotto === "delega_pagamento");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (r) =>
          `${r.cognome} ${r.nome}`.toLowerCase().includes(q) ||
          (r.telefono ?? "").includes(q) ||
          (r.banca ?? "").toLowerCase().includes(q),
      );
    }
    return [...out].sort((a, b) => {
      const da = a.dataRinnovabilita?.getTime() ?? Infinity;
      const db = b.dataRinnovabilita?.getTime() ?? Infinity;
      return sortDir === "asc" ? da - db : db - da;
    });
  }, [rows, filter, query, sortDir]);

  const inRinnovi = filtered.filter((r) => r.passaInRinnovi);
  const inMagazzino = filtered.filter((r) => !r.passaInRinnovi);

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Magazzino</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} pratiche</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/60 bg-card p-0.5">
            {(["tutti", "cqs", "delega"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "tutti" ? "Tutti" : f === "cqs" ? "CQS" : "Delega"}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca cliente..."
              className="w-64 pl-9"
            />
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-2 py-3 text-left">Tipo</th>
                <th className="px-2 py-3 text-left">Banca</th>
                <th className="px-2 py-3 text-right">Rata</th>
                <th className="px-2 py-3 text-right">Durata</th>
                <th className="px-2 py-3 text-left">Decorrenza</th>
                <th className="px-2 py-3 text-right">Rate res.</th>
                <th className="px-2 py-3 text-right">Cap. residuo</th>
                <th className="px-2 py-3 text-left">
                  <button
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Rinnovabile
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-2 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {[...inMagazzino, ...inRinnovi].length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    Nessuna pratica in magazzino. Le pratiche liquidate appariranno qui automaticamente.
                  </td>
                </tr>
              )}
              {[...inMagazzino, ...inRinnovi].map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t border-border/40 transition-colors hover:bg-secondary/30",
                    r.passaInRinnovi && "bg-amber-50/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("grid h-9 w-9 place-items-center rounded-full text-xs font-bold", avatarTone(`${r.nome}${r.cognome}`))}>
                        {(r.cognome[0] ?? "") + (r.nome[0] ?? "")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">
                          {r.cognome} {r.nome}
                        </div>
                        {r.telefono && <div className="text-xs text-muted-foreground">{r.telefono}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", PRODOTTO_TONE[r.prodotto])}>
                      {PRODOTTO_LABEL[r.prodotto]}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-foreground/80">{r.banca ?? "—"}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{fmtEur(r.rata)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{r.durata}</td>
                  <td className="px-2 py-3 text-foreground/80">{fmtMonthYear(r.decorrenza)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{r.rateResidue}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{fmtEur(r.capitaleResiduo)}</td>
                  <td className="px-2 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium", badgeTone(r.giorniAllaRinnovabilita))}>
                      <Calendar className="h-3 w-3" />
                      {fmtMonthYear(r.dataRinnovabilita)}
                      <span className="text-[10px] opacity-70">({r.giorniAllaRinnovabilita}gg)</span>
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Chiama" onClick={() => callCliente(r)}>
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Email" onClick={() => mailCliente(r)}>
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Apri scheda" onClick={() => openSchedaCliente(r)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Elimina dal magazzino"
                        onClick={() => {
                          if (confirm(`Eliminare ${r.cognome} ${r.nome} dal magazzino?`)) removeRow(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-border/40 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
            Le pratiche evidenziate passeranno automaticamente nella pagina Rinnovi quando mancano 3 mesi alla data di rinnovabilità.
          </div>
        )}
      </div>
    </div>
  );
}