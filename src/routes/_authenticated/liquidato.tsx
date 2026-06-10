import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, ChevronDown, ChevronRight, Landmark, Trash2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { liquidataMontanteLordo, useLiquidatoStore, type LiquidataRow } from "@/lib/liquidato-store";
import { usePraticheStore } from "@/lib/pratiche-store";
import { formatEuroIT, parseItNumber } from "@/lib/format-eur";

export const Route = createFileRoute("/_authenticated/liquidato")({
  head: () => ({ meta: [{ title: "Liquidato · LeadValue" }] }),
  component: LiquidatoPage,
});

const BANCHE = [
  "AVVERA","BANCA GENERALI","BANCA POPOLARE PUGLIESE","BANCA PROGETTO","BANCA SELLA",
  "BANCA SISTEMA","BANCO DESIO","BCC","BCP","BIBANCA","BNL","BNT","BPER Banca","BPM",
  "CAPITALFIN","COFIDIS","COMPASS","CREDITIS","DEUTSCHE BANK S.P.A.","DYNAMICA RETAIL",
  "FIDES","FIDITALIA","IBL BANCA",
];

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const fmtEuro = (n: number | string | null) => formatEuroIT(n);
const fmtData = (iso: string) => {
  const d = new Date(iso);
  const m = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"][d.getMonth()];
  return `${String(d.getDate()).padStart(2,"0")} ${m} ${d.getFullYear()}`;
};

function prodottoBadge(p: LiquidataRow["prodotto"]) {
  const map: Record<LiquidataRow["prodotto"], string> = {
    CQS: "bg-emerald-100 text-emerald-700",
    Prestito: "bg-amber-100 text-amber-700",
    delega_pagamento: "bg-indigo-100 text-indigo-700",
    Mutuo: "bg-sky-100 text-sky-700",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", map[p])}>{p}</span>;
}

function LiquidatoPage() {
  const { rows: allRows, setBanca, setDataLiq, setRata, setDurata, removeRow } = useLiquidatoStore();
  const { pratiche } = usePraticheStore();
  // Mostra solo le pratiche effettivamente presenti in gestione-pratiche con stage "liquidata"
  const liquidatePraticheIds = useMemo(
    () => new Set(pratiche.filter((p) => p.stage === "liquidata").map((p) => `liq-${p.id}`)),
    [pratiche],
  );
  const rows = useMemo(
    () => allRows.filter((r) => liquidatePraticheIds.has(r.id)),
    [allRows, liquidatePraticheIds],
  );
  const [precedentiOpen, setPrecedentiOpen] = useState(true);

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth()}`;

  const grouped = useMemo(() => {
    const map = new Map<string, LiquidataRow[]>();
    for (const r of rows) {
      const d = new Date(r.dataLiq);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries())
      .map(([k, items]) => {
        const [y, m] = k.split("-").map(Number);
        return { key: k, year: y, month: m, items: items.sort((a,b) => b.dataLiq.localeCompare(a.dataLiq)) };
      })
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [rows]);

  const totale = useMemo(() => rows.reduce((s, r) => s + (parseItNumber(r.provvigione) ?? 0), 0), [rows]);
  const mesiCount = grouped.length;

  const currentGroup = grouped.find((g) => g.key === currentKey) ?? grouped[0];
  const previousGroups = grouped.filter((g) => g !== currentGroup);

  const updateBanca = (id: string, banca: string) => setBanca(id, banca);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
          <Banknote className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liquidato</h1>
          <p className="text-sm text-muted-foreground">Pratiche liquidate e provvigioni maturate</p>
        </div>
      </div>

      {/* Totale */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-90">
          <TrendingUp className="h-4 w-4" /> Totale provvigioni all time
        </div>
        <div className="mt-2 text-4xl font-bold tabular-nums">{fmtEuro(totale)}</div>
        <div className="mt-1 text-sm opacity-90">{mesiCount} {mesiCount === 1 ? "mese" : "mesi"}</div>
      </div>

      {/* Mese corrente */}
      {currentGroup && <MonthBlock group={currentGroup} highlight onBanca={updateBanca} onDelete={removeRow} onData={setDataLiq} onRata={setRata} onDurata={setDurata} />}

      {/* Mesi precedenti */}
      {previousGroups.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setPrecedentiOpen((v) => !v)}
            className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {precedentiOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Mesi precedenti
          </button>
          {precedentiOpen && (
            <div className="space-y-4">
              {previousGroups.map((g) => (
                <MonthBlock key={g.key} group={g} onBanca={updateBanca} onDelete={removeRow} onData={setDataLiq} onRata={setRata} onDurata={setDurata} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MonthBlock({
  group,
  highlight = false,
  onBanca,
  onDelete,
  onData,
  onRata,
  onDurata,
}: {
  group: { key: string; year: number; month: number; items: LiquidataRow[] };
  highlight?: boolean;
  onBanca: (id: string, banca: string) => void;
  onDelete: (id: string) => void;
  onData: (id: string, dataLiq: string) => void;
  onRata: (id: string, rata: number | null) => void;
  onDurata: (id: string, durata: number | null) => void;
}) {
  const total = group.items.reduce((s, r) => s + (parseItNumber(r.provvigione) ?? 0), 0);
  const label = `${MESI[group.month]} ${group.year}`;
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", highlight && "ring-1 ring-emerald-200")}>
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <div className="text-lg font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">
            {group.items.length} {group.items.length === 1 ? "pratica liquidata" : "pratiche liquidate"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {highlight ? "Totale provvigioni" : "Totale"}
          </div>
          <div className="text-xl font-bold text-emerald-600 tabular-nums">{fmtEuro(total)}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2 text-left">Cognome</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Prodotto</th>
              <th className="px-3 py-2 text-left">Banca mandante</th>
              <th className="px-3 py-2 text-left">Data liq.</th>
              <th className="px-3 py-2 text-right">Rata</th>
              <th className="px-3 py-2 text-right">Durata</th>
              <th className="px-3 py-2 text-right">Montante Lordo</th>
              <th className="px-3 py-2 text-right">Provvigione</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((r) => {
              const montanteLordo = liquidataMontanteLordo(r);
              return (
                <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium">{r.cognome}</td>
                  <td className="px-3 py-3">{r.nome}</td>
                  <td className="px-3 py-3">{prodottoBadge(r.prodotto)}</td>
                  <td className="px-3 py-3">
                    {r.banca ? (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        {r.banca}
                      </span>
                    ) : (
                      <select
                        defaultValue=""
                        onChange={(e) => onBanca(r.id, e.target.value)}
                        className="rounded-md border border-dashed border-amber-400 bg-amber-50/40 px-2 py-1 text-xs font-medium text-amber-700 outline-none hover:bg-amber-50"
                        title="Clicca per assegnare banca"
                      >
                        <option value="">🏦 Assegna</option>
                        {BANCHE.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <input
                      type="date"
                      value={r.dataLiq}
                      onChange={(e) => onData(r.id, e.target.value)}
                      className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-border focus:border-primary focus:outline-none"
                      title={fmtData(r.dataLiq)}
                    />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <input
                      type="number"
                      step="0.01"
                      value={r.rata ?? ""}
                      onChange={(e) => onRata(r.id, e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="—"
                      className="w-24 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right text-xs hover:border-border focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                    <input
                      type="number"
                      value={r.durata ?? ""}
                      onChange={(e) => onDurata(r.id, e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="—"
                      className="w-16 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right text-xs hover:border-border focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 tabular-nums">
                      {fmtEuro(montanteLordo || null)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 tabular-nums">
                      {fmtEuro(r.provvigione)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// silence unused import warning if Landmark is removed later
void Landmark;
