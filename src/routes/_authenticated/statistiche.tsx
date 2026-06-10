import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Users, MessageCircle, Calendar, Building2, Target, Euro, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLeadsStore } from "@/lib/leads-store";
import { liquidataMontanteLordo, useLiquidatoStore } from "@/lib/liquidato-store";
import { praticaMontanteLordo, usePraticheStore } from "@/lib/pratiche-store";
import { formatEuroIT, parseItNumber } from "@/lib/format-eur";

export const Route = createFileRoute("/_authenticated/statistiche")({
  head: () => ({ meta: [{ title: "Statistiche · LeadValue" }] }),
  component: StatistichePage,
});

const eur = (n: number | string | null | undefined) => formatEuroIT(parseItNumber(n) ?? 0);

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
};

function StatistichePage() {
  const { leads } = useLeadsStore();
  const { rows: allLiquidate } = useLiquidatoStore();
  const { pratiche } = usePraticheStore();
  // Solo le pratiche gestite da me, presenti in gestione-pratiche con stage "liquidata"
  const liquidate = useMemo(() => {
    const ids = new Set(
      pratiche.filter((p) => p.stage === "liquidata").map((p) => `liq-${p.id}`),
    );
    return allLiquidate.filter((r) => ids.has(r.id));
  }, [allLiquidate, pratiche]);
  const [showCharts, setShowCharts] = useState(false);

  const totals = useMemo(() => {
    const liquidateCount = liquidate.length;
    const montanteTotale = liquidate.reduce((s, r) => s + liquidataMontanteLordo(r), 0);
    const provvigioniTot = liquidate.reduce((s, r) => s + (parseItNumber(r.provvigione) ?? 0), 0);
    return { liquidateCount, montanteTotale, provvigioniTot };
  }, [liquidate]);

  const kpi = useMemo(() => {
    const nuovi = leads.length;
    const contattati = leads.filter((l) => l.stage !== "nuovo_da_chiamare").length;
    const preventivi = leads.filter((l) =>
      ["preventivo_inviato", "sollecito_risposta", "in_trattativa", "accettato"].includes(l.stage),
    ).length;
    const vinti = leads.filter((l) => l.stage === "accettato").length;
    const persi = leads.filter((l) => l.stage === "persa").length;
    const abbandonati = leads.filter((l) => ["non_reperibili", "non_fattibili"].includes(l.stage)).length;
    const pipelineAperta = pratiche
      .filter((p) => p.stage !== "liquidata" && p.stage !== "passate")
      .reduce((s, p) => s + praticaMontanteLordo(p), 0);
    const valoreMedio = totals.liquidateCount > 0 ? totals.montanteTotale / totals.liquidateCount : 0;
    return { nuovi, contattati, preventivi, vinti, persi, abbandonati, pipelineAperta, valoreMedio };
  }, [leads, pratiche, totals]);

  const perFonte = useMemo(() => {
    const map = new Map<string, { fonte: string; lead: number; vinti: number }>();
    for (const l of leads) {
      const f = l.source || "Non specificata";
      const cur = map.get(f) ?? { fonte: f, lead: 0, vinti: 0 };
      cur.lead += 1;
      if (l.stage === "accettato") cur.vinti += 1;
      map.set(f, cur);
    }
    return [...map.values()].sort((a, b) => b.lead - a.lead);
  }, [leads]);

  const mensile = useMemo(() => {
    const months = new Map<string, { liquidate: number; caricate: number; montante: number; provv: number }>();
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.set(monthKey(d), { liquidate: 0, caricate: 0, montante: 0, provv: 0 });
    }
    for (const r of liquidate) {
      const k = r.dataLiq.slice(0, 7);
      const cur = months.get(k);
      if (!cur) continue;
      cur.liquidate += 1;
      cur.montante += liquidataMontanteLordo(r);
      cur.provv += parseItNumber(r.provvigione) ?? 0;
    }
    for (const p of pratiche) {
      if (p.stage === "caricata" || p.stage === "deliberata") {
        const k = monthKey(new Date());
        const cur = months.get(k);
        if (cur) cur.caricate += 1;
      }
    }
    return [...months.entries()].reverse().map(([k, v]) => ({ key: k, label: monthLabel(k), ...v }));
  }, [liquidate, pratiche]);

  const annuale = useMemo(() => {
    const years = new Map<string, { liquidate: number; montante: number; provv: number }>();
    for (const r of liquidate) {
      const y = r.dataLiq.slice(0, 4);
      const cur = years.get(y) ?? { liquidate: 0, montante: 0, provv: 0 };
      cur.liquidate += 1;
      cur.montante += liquidataMontanteLordo(r);
      cur.provv += parseItNumber(r.provvigione) ?? 0;
      years.set(y, cur);
    }
    return [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [liquidate]);

  const perBanca = useMemo(() => {
    const map = new Map<string, { banca: string; pratiche: number; montante: number; provv: number }>();
    for (const r of liquidate) {
      const b = r.banca || "Non assegnata";
      const cur = map.get(b) ?? { banca: b, pratiche: 0, montante: 0, provv: 0 };
      cur.pratiche += 1;
      cur.montante += liquidataMontanteLordo(r);
      cur.provv += parseItNumber(r.provvigione) ?? 0;
      map.set(b, cur);
    }
    return [...map.values()].sort((a, b) => b.provv - a.provv);
  }, [liquidate]);

  const leadMensile = useMemo(() => {
    const months = new Map<string, { nuovi: number; convertiti: number; persi: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.set(monthKey(d), { nuovi: 0, convertiti: 0, persi: 0 });
    }
    for (const l of leads) {
      const k = monthKey(new Date());
      const cur = months.get(k);
      if (!cur) continue;
      cur.nuovi += 1;
      if (l.stage === "accettato") cur.convertiti += 1;
      if (l.stage === "persa") cur.persi += 1;
    }
    return [...months.entries()].reverse().map(([k, v]) => ({ key: k, label: monthLabel(k), ...v }));
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <BarChart3 className="h-7 w-7 text-rose-500" /> Statistiche
          </h1>
          <p className="text-sm text-muted-foreground">Analisi numerica delle performance</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setShowCharts((v) => !v)}>
          <TrendingUp className="h-4 w-4" />
          {showCharts ? "Nascondi grafici" : "Grafici"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BigStat label="Pratiche liquidate" value={String(totals.liquidateCount)} gradient="from-emerald-400 to-teal-500" />
        <BigStat label="Montante totale" value={eur(totals.montanteTotale)} gradient="from-sky-500 to-blue-600" />
        <BigStat label="Provvigioni totali" value={eur(totals.provvigioniTot)} gradient="from-violet-500 to-purple-600" />
      </div>

      <Tabs defaultValue="kpi">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="kpi" className="gap-1"><Target className="h-3.5 w-3.5" /> KPI Commerciali</TabsTrigger>
          <TabsTrigger value="comunicazione" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> Comunicazione</TabsTrigger>
          <TabsTrigger value="mensile" className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> Mensile</TabsTrigger>
          <TabsTrigger value="annuale" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Annuale</TabsTrigger>
          <TabsTrigger value="banca" className="gap-1"><Building2 className="h-3.5 w-3.5" /> Per Banca</TabsTrigger>
          <TabsTrigger value="lead" className="gap-1"><Users className="h-3.5 w-3.5" /> Lead & Conversioni</TabsTrigger>
        </TabsList>

        <TabsContent value="kpi" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MiniStat label="Nuovi lead" value={kpi.nuovi} hint="nel periodo" icon={Users} tone="sky" />
            <MiniStat label="Lead contattati" value={kpi.contattati} hint={`${pct(kpi.contattati, kpi.nuovi)}% dei lead`} icon={MessageCircle} tone="violet" />
            <MiniStat label="Preventivi inviati" value={kpi.preventivi} hint={`${pct(kpi.preventivi, kpi.contattati)}% dei contattati`} icon={Euro} tone="amber" />
            <MiniStat label="Vinti" value={kpi.vinti} hint={`${pct(kpi.vinti, kpi.preventivi)}% dei preventivi`} icon={TrendingUp} tone="emerald" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <Euro className="h-4 w-4" /> VALORI ECONOMICI
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Pipeline aperta (preventivi in corso)" value={eur(kpi.pipelineAperta)} valueClass="text-rose-600 font-semibold" />
                  <Row label="Valore medio pratica vinta" value={eur(kpi.valoreMedio)} valueClass="text-emerald-600 font-semibold" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-600">
                  <Clock className="h-4 w-4" /> TEMPI MEDI DEL CICLO
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Lead → Primo preventivo" value="—" valueClass="text-foreground font-semibold" />
                  <Row label="Preventivo → Chiusura" value="—" valueClass="text-foreground font-semibold" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-rose-200/60">
              <CardContent className="p-5">
                <div className="text-sm font-semibold text-rose-600">PERSI</div>
                <div className="mt-1 text-3xl font-bold">{kpi.persi}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200/60">
              <CardContent className="p-5">
                <div className="text-sm font-semibold text-amber-600">ABBANDONATI</div>
                <div className="mt-1 text-3xl font-bold">{kpi.abbandonati}</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 text-sm font-semibold">Conversione per Fonte Lead</div>
              <Table headers={["Fonte", "Lead", "Vinti", "Win rate"]}>
                {perFonte.length === 0 ? (
                  <Empty cols={4} />
                ) : (
                  perFonte.map((r) => (
                    <tr key={r.fonte} className="border-t">
                      <td className="py-2 font-medium">{r.fonte}</td>
                      <td className="py-2 text-sky-600 font-semibold">{r.lead}</td>
                      <td className="py-2 text-emerald-600 font-semibold">{r.vinti}</td>
                      <td className="py-2 text-amber-600 font-semibold">{pct(r.vinti, r.lead)}%</td>
                    </tr>
                  ))
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comunicazione" className="mt-4">
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              I dati di comunicazione (chiamate, WhatsApp, email) verranno aggregati qui non appena le interazioni saranno tracciate.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mensile" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <Table headers={["Mese", "Liquidate", "Caricate", "Montante tot.", "Provvigioni tot.", "Montante medio", "Provv. media"]}>
                {mensile.map((m) => {
                  const mm = m.liquidate ? m.montante / m.liquidate : 0;
                  const pm = m.liquidate ? m.provv / m.liquidate : 0;
                  return (
                    <tr key={m.key} className="border-t">
                      <td className="py-2 font-medium">{m.label}</td>
                      <td className="py-2 text-sky-600 font-semibold">{m.liquidate}</td>
                      <td className="py-2">{m.caricate}</td>
                      <td className="py-2">{eur(m.montante)}</td>
                      <td className="py-2 text-rose-600 font-semibold">{eur(m.provv)}</td>
                      <td className="py-2">{eur(mm)}</td>
                      <td className="py-2">{eur(pm)}</td>
                    </tr>
                  );
                })}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annuale" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <Table headers={["Anno", "Liquidate", "Montante", "Provvigioni"]}>
                {annuale.length === 0 ? (
                  <Empty cols={4} />
                ) : (
                  annuale.map(([y, v]) => (
                    <tr key={y} className="border-t">
                      <td className="py-2 font-medium">{y}</td>
                      <td className="py-2 text-sky-600 font-semibold">{v.liquidate}</td>
                      <td className="py-2">{eur(v.montante)}</td>
                      <td className="py-2 text-rose-600 font-semibold">{eur(v.provv)}</td>
                    </tr>
                  ))
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banca" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <Table headers={["Banca", "Pratiche", "Montante", "Provvigioni"]}>
                {perBanca.length === 0 ? (
                  <Empty cols={4} />
                ) : (
                  perBanca.map((r) => (
                    <tr key={r.banca} className="border-t">
                      <td className="py-2 font-medium">{r.banca}</td>
                      <td className="py-2 text-sky-600 font-semibold">{r.pratiche}</td>
                      <td className="py-2">{eur(r.montante)}</td>
                      <td className="py-2 text-rose-600 font-semibold">{eur(r.provv)}</td>
                    </tr>
                  ))
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lead" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <Table headers={["Mese", "Nuovi lead", "Convertiti", "Persi", "% Conversione"]}>
                {leadMensile.map((m) => (
                  <tr key={m.key} className="border-t">
                    <td className="py-2 font-medium">{m.label}</td>
                    <td className="py-2 text-sky-600 font-semibold">{m.nuovi}</td>
                    <td className="py-2 text-emerald-600 font-semibold">{m.convertiti}</td>
                    <td className="py-2 text-rose-600 font-semibold">{m.persi}</td>
                    <td className="py-2 text-amber-600 font-semibold">{pct(m.convertiti, m.nuovi)}%</td>
                  </tr>
                ))}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showCharts && (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="PROVVIGIONI PER MESE" tone="violet" data={mensile.map((m) => ({ label: m.label, value: m.provv }))} fmt={eur} />
          <ChartCard title="MONTANTE PER MESE" tone="sky" data={mensile.map((m) => ({ label: m.label, value: m.montante }))} fmt={eur} />
          <ChartCard title="NUOVI LEAD PER MESE" tone="blue" data={leadMensile.map((m) => ({ label: m.label, value: m.nuovi }))} fmt={(n) => String(n)} />
          <ChartCard title="LEAD CONVERTITI PER MESE" tone="emerald" data={leadMensile.map((m) => ({ label: m.label, value: m.convertiti }))} fmt={(n) => String(n)} />
        </div>
      )}
    </div>
  );
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 1000) / 10;
}

function BigStat({ label, value, gradient }: { label: string; value: string; gradient: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-md`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "sky" | "violet" | "amber" | "emerald";
}) {
  const toneMap = {
    sky: "bg-sky-100 text-sky-600",
    violet: "bg-violet-100 text-violet-600",
    amber: "bg-amber-100 text-amber-600",
    emerald: "bg-emerald-100 text-emerald-600",
  } as const;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`grid h-8 w-8 place-items-center rounded-lg ${toneMap[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 text-3xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="pb-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-8 text-center text-sm text-muted-foreground">
        Nessun dato disponibile
      </td>
    </tr>
  );
}

function ChartCard({
  title,
  tone,
  data,
  fmt,
}: {
  title: string;
  tone: "violet" | "sky" | "blue" | "emerald";
  data: { label: string; value: number }[];
  fmt: (n: number) => string;
}) {
  const fills = {
    violet: "#8b5cf6",
    sky: "#0ea5e9",
    blue: "#3b82f6",
    emerald: "#10b981",
  } as const;
  const text = {
    violet: "text-violet-600",
    sky: "text-sky-600",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
  } as const;
  const hasData = data.some((d) => d.value > 0);
  return (
    <Card>
      <CardContent className="p-5">
        <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${text[tone]}`}>
          <TrendingDown className="h-3.5 w-3.5 rotate-180" /> {title}
        </div>
        {!hasData ? (
          <div className="grid h-56 place-items-center text-xs text-muted-foreground">
            Nessun dato disponibile
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} width={70} />
                <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="value" fill={fills[tone]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}