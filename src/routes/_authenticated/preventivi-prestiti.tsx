import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Plus, ChevronLeft, ChevronRight, Search, Trash2, Settings, Save, Check } from "lucide-react";
import { useClientiStore, type Cliente } from "@/lib/clienti-store";
import { usePreventiviStore } from "@/lib/preventivi-store";
import {
  BANCHE_PRESTITI,
  CATEGORIE_LAVORATORE,
  calcRata,
  type BancaPrestito,
  type CategoriaLavoratore,
  type TabellaTAN,
} from "@/lib/prestiti-tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/preventivi-prestiti")({
  head: () => ({ meta: [{ title: "Preventivi Prestiti · LeadValue" }] }),
  component: PreventiviPrestitiPage,
});

const fmtEur = (n: number) =>
  n.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

function EuroInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>("");
  const display = focused
    ? raw
    : value > 0
      ? value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })
      : "";
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={display}
        onFocus={() => {
          setFocused(true);
          setRaw(value > 0 ? String(value).replace(".", ",") : "");
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d,.-]/g, "");
          setRaw(v);
          const normalized = v.replace(/\./g, "").replace(",", ".");
          onChange(Number(normalized) || 0);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span>
    </div>
  );
}

type Step = 1 | 2 | 3;

function PreventiviPrestitiPage() {
  const { preventivi, removePreventivo } = usePreventiviStore();
  const [wizardOpen, setWizardOpen] = useState(false);
  const list = preventivi.filter((p) => p.categoria === "prestiti");

  if (wizardOpen) {
    return <Wizard onClose={() => setWizardOpen(false)} />;
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Preventivi Prestiti</h1>
            <p className="text-sm text-muted-foreground">Simulatore prestiti personali</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings className="h-4 w-4" /> Impostazioni
          </Button>
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" /> Nuovo preventivo
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-2 py-3 text-left">Cliente</th>
              <th className="px-2 py-3 text-left">Banca</th>
              <th className="px-2 py-3 text-right">Importo</th>
              <th className="px-2 py-3 text-right">Provv.</th>
              <th className="px-2 py-3 text-left">Stato</th>
              <th className="px-2 py-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Nessun preventivo. Clicca "Nuovo preventivo".
                </td>
              </tr>
            )}
            {list.map((p) => (
              <tr key={p.id} className="border-t border-border/40 hover:bg-secondary/30">
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(p.data).toLocaleDateString("it-IT")}
                </td>
                <td className="px-2 py-3 font-medium">{p.nome}</td>
                <td className="px-2 py-3 text-foreground/80">{p.prodotto}</td>
                <td className="px-2 py-3 text-right tabular-nums">{fmtEur(p.importo)}</td>
                <td className="px-2 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmtEur(p.provvigione)}</td>
                <td className="px-2 py-3">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Preventivo</span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => removePreventivo(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------- Wizard -----------------

function Wizard({ onClose }: { onClose: () => void }) {
  const { clienti } = useClientiStore();
  const { addPreventivo } = usePreventiviStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [banca, setBanca] = useState<BancaPrestito | null>(null);
  const [categoria, setCategoria] = useState<CategoriaLavoratore>("Dipendente Privato");
  const [tabella, setTabella] = useState<TabellaTAN | null>(null);
  const [importo, setImporto] = useState<number>(10000);
  const [durata, setDurata] = useState<number>(60);
  const [polizzaCodice, setPolizzaCodice] = useState<string>("nessuna");
  const [spese, setSpese] = useState<number>(0);
  const [rataDesiderata, setRataDesiderata] = useState<string>("");

  const steps = [
    { n: 1, label: "Cliente" },
    { n: 2, label: "Banca + categoria" },
    { n: 3, label: "Preventivo" },
  ] as const;

  const canNext1 = !!cliente;
  const canNext2 = !!banca;

  const tabelle = useMemo(() => (banca ? banca.tabelle[categoria] : []), [banca, categoria]);

  // Auto-select prima tabella quando si entra in step 3
  if (step === 3 && !tabella && tabelle[0]) setTimeout(() => setTabella(tabelle[0]), 0);

  const tan = tabella ? (tabella.tanMin + tabella.tanMax) / 2 : 0;
  const provvPct = tabella?.provvPct ?? 0;
  const polizza = banca?.polizze.find((p) => p.codice === polizzaCodice);
  const polizzaImporto = polizza ? importo * (polizza.costoPct / 100) : 0;
  const importoFinanziato = importo + spese + polizzaImporto;
  const rata = calcRata(importoFinanziato, tan, durata);
  const montante = rata * durata;
  const interessi = montante - importoFinanziato;
  const provvigione = montante * (provvPct / 100);
  const ristorno = provvigione * 0.5;
  const nettaAgente = provvigione - ristorno;

  const trovaDurata = () => {
    const target = parseFloat(rataDesiderata.replace(",", "."));
    if (!target || target <= 0 || !banca) return;
    for (let m = banca.durataMin; m <= banca.durataMax; m++) {
      const r = calcRata(importoFinanziato, tan, m);
      if (r <= target) {
        setDurata(m);
        return;
      }
    }
    setDurata(banca.durataMax);
    toast.info("Rata troppo bassa, impostata durata massima");
  };

  const handleSave = () => {
    if (!cliente || !banca || !tabella) return;
    addPreventivo({
      nome: cliente.name,
      tipoLead: cliente.stato === "liquidato" ? "Cliente" : "Lead",
      prodotto: banca.nome,
      data: new Date().toISOString().slice(0, 10),
      categoria: "prestiti",
      tipoPratica: "PRESTITO_PERSONALE",
      importo,
      provvigione,
      dettagli: {
        clienteId: cliente.id,
        telefonoCliente: cliente.phone,
        emailCliente: cliente.email,
        aziendaCliente: cliente.azienda,
        tipologia: categoria,
        rata,
        durata,
        tan,
        montante,
        netto: importo,
        bancaMandante: banca.nome,
        provvigionePct: provvPct,
      },
    });
    toast.success("Preventivo salvato", { description: `Aggiunto ai Preventivi Salvati per ${cliente.name}` });
    navigate({ to: "/preventivi-salvati" });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Nuovo Preventivo Prestito</h1>
        <p className="text-sm text-muted-foreground">
          Step {step} di 3 - {step === 1 ? "Seleziona cliente" : step === 2 ? "Banca e categoria lavoratore" : "Simulazione"}
        </p>
      </header>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, idx) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium",
                  active && "bg-foreground text-background",
                  done && "bg-emerald-100 text-emerald-700",
                  !active && !done && "bg-secondary text-muted-foreground",
                )}
              >
                <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold", done ? "bg-emerald-600 text-white" : active ? "bg-background/20" : "bg-muted-foreground/20")}>
                  {done ? <Check className="h-3 w-3" /> : s.n}
                </span>
                {s.label}
              </div>
              {idx < steps.length - 1 && (
                <div className={cn("h-0.5 w-12", done ? "bg-emerald-500" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && <Step1 cliente={cliente} setCliente={setCliente} clienti={clienti} />}
      {step === 2 && (
        <Step2
          banca={banca}
          setBanca={(b) => {
            setBanca(b);
            setTabella(null);
          }}
          categoria={categoria}
          setCategoria={setCategoria}
        />
      )}
      {step === 3 && cliente && banca && (
        <Step3
          cliente={cliente}
          banca={banca}
          categoria={categoria}
          tabelle={tabelle}
          tabella={tabella}
          setTabella={setTabella}
          importo={importo}
          setImporto={setImporto}
          durata={durata}
          setDurata={setDurata}
          polizzaCodice={polizzaCodice}
          setPolizzaCodice={setPolizzaCodice}
          spese={spese}
          setSpese={setSpese}
          rataDesiderata={rataDesiderata}
          setRataDesiderata={setRataDesiderata}
          trovaDurata={trovaDurata}
          tan={tan}
          rata={rata}
          importoFinanziato={importoFinanziato}
          montante={montante}
          interessi={interessi}
          provvigione={provvigione}
          ristorno={ristorno}
          nettaAgente={nettaAgente}
          onSave={handleSave}
        />
      )}

      <div className="mt-6 flex items-center justify-between">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
            <ChevronLeft className="h-4 w-4" /> Indietro
          </Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>← Annulla</Button>
        )}
        {step < 3 && (
          <Button
            disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            Avanti <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Step 1
function Step1({
  cliente, setCliente, clienti,
}: {
  cliente: Cliente | null;
  setCliente: (c: Cliente) => void;
  clienti: Cliente[];
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return clienti.slice(0, 50);
    const s = q.trim().toLowerCase();
    return clienti.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.phone.includes(s)).slice(0, 50);
  }, [q, clienti]);
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Seleziona cliente</h3>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome, email, telefono..." className="pl-9" />
      </div>
      <div className="max-h-96 overflow-y-auto rounded-lg border border-border/40">
        {filtered.map((c) => {
          const sel = cliente?.id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCliente(c)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-secondary/40",
                sel && "bg-emerald-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.stato === "liquidato" ? "Cliente" : "Lead"} · {c.email} · {c.phone}
                  {c.birthDate ? ` · nato ${c.birthDate}` : ""}
                </div>
              </div>
              {sel && <Check className="h-4 w-4 text-emerald-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 2
function Step2({
  banca, setBanca, categoria, setCategoria,
}: {
  banca: BancaPrestito | null;
  setBanca: (b: BancaPrestito) => void;
  categoria: CategoriaLavoratore;
  setCategoria: (c: CategoriaLavoratore) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Banca e categoria lavoratore</h3>
      <div className="mb-2 text-sm font-medium text-muted-foreground">Banca mandante</div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BANCHE_PRESTITI.map((b) => {
          const sel = banca?.id === b.id;
          const totTab = Object.values(b.tabelle)["0"].length;
          return (
            <button
              key={b.id}
              onClick={() => setBanca(b)}
              className={cn(
                "flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-colors",
                sel ? "border-emerald-500 bg-emerald-50" : "border-border hover:border-foreground/30",
              )}
            >
              <div>
                <div className="font-semibold text-foreground">{b.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {totTab} tabelle · {b.polizze.length} polizze · {b.durataMin}-{b.durataMax}m
                </div>
              </div>
              {sel && <Check className="h-5 w-5 text-emerald-600" />}
            </button>
          );
        })}
      </div>

      <div className="mb-2 text-sm font-medium text-muted-foreground">Categoria lavoratore cliente</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {CATEGORIE_LAVORATORE.map((c) => {
          const sel = categoria === c;
          return (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={cn(
                "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors",
                sel ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border hover:border-foreground/30",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 3
type Step3Props = {
  cliente: Cliente;
  banca: BancaPrestito;
  categoria: CategoriaLavoratore;
  tabelle: TabellaTAN[];
  tabella: TabellaTAN | null;
  setTabella: (t: TabellaTAN) => void;
  importo: number;
  setImporto: (n: number) => void;
  durata: number;
  setDurata: (n: number) => void;
  polizzaCodice: string;
  setPolizzaCodice: (c: string) => void;
  spese: number;
  setSpese: (n: number) => void;
  rataDesiderata: string;
  setRataDesiderata: (s: string) => void;
  trovaDurata: () => void;
  tan: number;
  rata: number;
  importoFinanziato: number;
  montante: number;
  interessi: number;
  provvigione: number;
  ristorno: number;
  nettaAgente: number;
  onSave: () => void;
};

function Step3(p: Step3Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Simulazione preventivo</h3>
          <p className="text-sm text-muted-foreground">
            {p.banca.nome} · {p.categoria}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">Cliente:</div>
          <div className="font-semibold">{p.cliente.name}</div>
        </div>
      </div>

      <div className="mb-2 text-sm font-medium text-foreground">Tabella (scegli e confronta)</div>
      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-5">
        {p.tabelle.map((t) => {
          const sel = p.tabella?.codice === t.codice;
          return (
            <button
              key={t.codice}
              onClick={() => p.setTabella(t)}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-left transition-colors",
                sel ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40",
              )}
            >
              <div className="text-sm font-bold">{t.codice}</div>
              <div className="text-[11px] opacity-80">
                TAN {t.tanMin}-{t.tanMax}% · Provv {t.provvPct}%
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Importo richiesto</label>
            <EuroInput value={p.importo} onChange={(n) => p.setImporto(n)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Durata: {p.durata} mesi <span className="text-muted-foreground">({(p.durata / 12).toFixed(1)} anni)</span>
            </label>
            <Slider
              min={p.banca.durataMin}
              max={p.banca.durataMax}
              step={6}
              value={[p.durata]}
              onValueChange={(v) => p.setDurata(v[0])}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{p.banca.durataMin}m</span>
              <span>{p.banca.durataMax}m</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Trova durata per rata desiderata</label>
            <div className="flex gap-2">
              <Input
                placeholder="es. 180"
                value={p.rataDesiderata}
                onChange={(e) => p.setRataDesiderata(e.target.value)}
              />
              <Button onClick={p.trovaDurata} className="bg-foreground hover:bg-foreground/90">
                Trova
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Spese istruttoria <span className="text-xs text-muted-foreground">(da config banca)</span>
            </label>
            <Input
              type="number"
              value={p.spese}
              onChange={(e) => p.setSpese(Number(e.target.value) || 0)}
            />
            <div className="mt-1 text-xs text-muted-foreground">Aggiunte al capitale</div>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Polizza CPI</div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={p.polizzaCodice === "nessuna"}
                  onChange={() => p.setPolizzaCodice("nessuna")}
                />
                Nessuna polizza
              </label>
              {p.banca.polizze.map((pol) => (
                <label key={pol.codice} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={p.polizzaCodice === pol.codice}
                    onChange={() => p.setPolizzaCodice(pol.codice)}
                  />
                  {pol.nome} <span className="text-xs text-muted-foreground">({pol.costoPct}%)</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-900 p-5 text-white">
            <div className="text-xs uppercase tracking-wide opacity-70">Rata mensile</div>
            <div className="text-4xl font-bold tabular-nums">{fmtEur(p.rata)}</div>
            <div className="mt-1 text-xs opacity-80">
              TAN {p.tan.toFixed(2)}% · TAEG {p.tan.toFixed(2)}% (indicativo)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 p-3">
              <div className="text-xs text-muted-foreground">Netto al cliente</div>
              <div className="text-lg font-bold text-emerald-700 tabular-nums">{fmtEur(p.importo)}</div>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <div className="text-xs text-muted-foreground">Importo finanziato</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(p.importoFinanziato)}</div>
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border/60 p-3 text-sm">
            <Row label="Spese istruttoria" value={fmtEur(p.spese)} />
            <Row label="Montante (totale pagato)" value={fmtEur(p.montante)} />
            <Row label="Interessi totali" value={fmtEur(p.interessi)} />
          </div>

          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Provvigione agente</div>
            <div className="text-2xl font-bold text-amber-700 tabular-nums">
              {fmtEur(p.provvigione)}
              <span className="ml-1 text-xs font-normal text-amber-700/70">
                ({(p.tabella?.provvPct ?? 0).toFixed(2)}% monte interessi)
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 text-xs">
              <div>Ristorno sub-agente (50%)</div>
              <div className="text-right font-semibold tabular-nums">{fmtEur(p.ristorno)}</div>
              <div>Netta agente</div>
              <div className="text-right font-semibold tabular-nums">{fmtEur(p.nettaAgente)}</div>
            </div>
          </div>

          <Button onClick={p.onSave} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" size="lg">
            <Save className="h-4 w-4" /> Salva preventivo
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}