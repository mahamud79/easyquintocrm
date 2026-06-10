import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  FileText,
  BarChart3,
  Plus,
  Search,
  Pencil,
  Trash2,
  Printer,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCompagnie, type Compagnia, type Prodotto, type TipoCliente } from "@/lib/compagnie-store";

export const Route = createFileRoute("/_authenticated/assicurazioni")({
  head: () => ({ meta: [{ title: "Assicurazioni · LeadValue" }] }),
  component: AssicurazioniPage,
});

const PRODOTTI: Prodotto[] = ["Prestito Personale", "Cessione del Quinto", "Delega di Pagamento"];
const TIPI: TipoCliente[] = ["Dipendente Privato", "Dipendente Pubblico", "Pensionato"];

// Colori brand per compagnia (header confronto)
const COMP_COLOR: Record<string, string> = {
  ALLIANZ: "bg-indigo-600",
  AXA: "bg-blue-600",
  CARDIF: "bg-rose-600",
  CF: "bg-cyan-600",
  GAIIL: "bg-orange-500",
  HDI: "bg-emerald-600",
  NET: "bg-red-600",
  SOGECAP: "bg-violet-600",
};

const BANCHE_LIST = [
  "IBL BANCA",
  "BNL",
  "BPER",
  "COMPASS",
  "FINDOMESTIC",
  "INTESA SAN PAOLO",
  "UNICREDIT",
  "BANCA SISTEMA",
];

const SEGMENTI = [
  "CQS Statale/Pubblico",
  "CQS Parapubblico",
  "CQS Privato Grande",
  "CQS Privato Medio",
  "CQS Ferroviere",
  "CQS Medico Convenzionato",
  "CQS Pensionato",
  "Delega Privato",
  "Delega Statale (Difesa/Sicurezza/Soccorso)",
  "Delega Statale/Pubblico (civile)",
  "Delega Parapubblico",
  "Delega Ferroviere",
];

// ========== Confronto criteri schema ==========
type CriterioRow = { key: string; label: string; render?: (v: any) => string };
type CriterioGroup = { title: string; rows: CriterioRow[] };

const eur = (v?: number) =>
  typeof v === "number"
    ? `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
const dash = (v: any) => (v === undefined || v === null || v === "" ? "—" : String(v));

const GROUPS: CriterioGroup[] = [
  { title: "STATO", rows: [
    { key: "schemeAttivo", label: "Scheme attivo" },
    { key: "campagne", label: "Campagne attive" },
  ]},
  { title: "ETA E ANZIANITA", rows: [
    { key: "etaMinDec", label: "Eta min decorrenza" },
    { key: "etaMaxDec", label: "Eta max decorrenza" },
    { key: "etaMaxScad", label: "Eta max scadenza" },
    { key: "anzMinDel", label: "Anzianita min delibera" },
    { key: "anzMaxScadU", label: "Anzianita max scadenza U" },
    { key: "anzMaxScadD", label: "Anzianita max scadenza D" },
    { key: "datoComb", label: "Dato combinato" },
  ]},
  { title: "DURATA E MONTANTE", rows: [
    { key: "durMin", label: "Durata min" },
    { key: "durMax", label: "Durata max" },
    { key: "montMax", label: "Montante max singolo", render: eur },
    { key: "cumMax", label: "Cumulo montanti max", render: eur },
    { key: "appalti", label: "Appalti" },
    { key: "terze", label: "Terze trattenute" },
  ]},
  { title: "STRANIERI", rows: [
    { key: "soloIt", label: "Solo cittadini italiani" },
    { key: "comunitari", label: "Comunitari ammessi" },
    { key: "extracom", label: "Extracomunitari ammessi" },
    { key: "permessoIll", label: "Permesso illimitato richiesto" },
    { key: "anzResidenza", label: "Anzianita residenza Italia min" },
    { key: "anzStessoDat", label: "Anzianita servizio stesso datore min" },
    { key: "tariffaStr", label: "Tariffa stranieri dedicata" },
    { key: "montMaxStr", label: "Montante max stranieri", render: eur },
  ]},
  { title: "MALATTIA", rows: [
    { key: "gMaxNoDoc", label: "Giorni max nessuna doc" },
    { key: "gMaxDBS", label: "Giorni max con DBS" },
    { key: "gMaxRVM", label: "Giorni max con RVM" },
    { key: "certMed", label: "Certificato medico richiesto" },
  ]},
  { title: "FONDO PENSIONE", rows: [
    { key: "fpcChiusi", label: "FPC chiusi graditi" },
    { key: "fpcAperti", label: "FPC aperti graditi" },
    { key: "pip", label: "PIP graditi" },
    { key: "adesione", label: "Adesione individuale" },
    { key: "notifica", label: "Notifica obbligatoria" },
    { key: "impegnRiscatto", label: "Impegnativa riscatto" },
    { key: "tfrFpc", label: "TFR FPC computabile %" },
  ]},
];

// Dataset confronto demo (banca · segmento · compagnia → criteri)
function makeCriteri(seed: number) {
  const rnd = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  return {
    schemeAttivo: rnd(1) > 0.15 ? "Si" : "No",
    campagne: rnd(2) > 0.6 ? Math.ceil(rnd(3) * 6) : "—",
    etaMinDec: rnd(4) > 0.5 ? `${18 + Math.floor(rnd(5) * 40)}a` : "—",
    etaMaxDec: `${75 + Math.floor(rnd(6) * 10)}a`,
    etaMaxScad: `${83 + Math.floor(rnd(7) * 5)}a${rnd(8) > 0.7 ? " 6m" : ""}`,
    anzMinDel: rnd(9) > 0.4 ? `${3 + Math.floor(rnd(10) * 10)}m` : "—",
    anzMaxScadU: rnd(11) > 0.5 ? `${40 + Math.floor(rnd(12) * 5)}a` : "—",
    anzMaxScadD: rnd(13) > 0.5 ? `${40 + Math.floor(rnd(14) * 5)}a` : "—",
    datoComb: rnd(15) > 0.4 ? "62/41" : "—",
    durMin: "24m",
    durMax: "120m",
    montMax: 50000 + Math.floor(rnd(16) * 6) * 5000,
    cumMax: 60000 + Math.floor(rnd(17) * 8) * 5000,
    appalti: "No",
    terze: rnd(18) > 0.5 ? "Si" : "No",
    soloIt: rnd(19) > 0.7 ? "No" : "—",
    comunitari: rnd(20) > 0.5 ? "Si" : "—",
    extracom: rnd(21) > 0.5 ? "Si" : "—",
    permessoIll: rnd(22) > 0.5 ? "No" : "—",
    anzResidenza: rnd(23) > 0.8 ? `${3 + Math.floor(rnd(24) * 3)}a` : "—",
    anzStessoDat: rnd(25) > 0.8 ? `${3 + Math.floor(rnd(26) * 3)}a` : "—",
    tariffaStr: rnd(27) > 0.6 ? "No" : "—",
    montMaxStr: undefined,
    gMaxNoDoc: rnd(28) > 0.4 ? `${10 + Math.floor(rnd(29) * 3) * 10} gg` : "—",
    gMaxDBS: rnd(30) > 0.5 ? `${20 + Math.floor(rnd(31) * 2) * 10} gg` : "—",
    gMaxRVM: rnd(32) > 0.6 ? `${30} gg` : "—",
    certMed: rnd(33) > 0.5 ? "No" : "—",
    fpcChiusi: "—",
    fpcAperti: "—",
    pip: "—",
    adesione: "—",
    notifica: "—",
    impegnRiscatto: "—",
    tfrFpc: "—",
  } as Record<string, any>;
}

// ============ Page ============
function AssicurazioniPage() {
  const [tab, setTab] = useState("compagnie");
  const [items, setItems] = useCompagnie();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
          <ShieldCheck className="h-6 w-6 text-violet-600" />
          Assicurazioni
        </h1>
        <p className="text-sm text-muted-foreground">
          Compagnie, criteri assuntivi e confronto tra prodotti.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto bg-transparent p-0 border-b border-border w-full justify-start rounded-none gap-2">
          <TabsTrigger
            value="compagnie"
            className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 gap-2"
          >
            <ShieldCheck className="h-4 w-4" /> Compagnie
            <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-bold text-emerald-700">
              {items.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="criteri"
            className="data-[state=active]:border-b-2 data-[state=active]:border-sky-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 gap-2"
          >
            <FileText className="h-4 w-4" /> Criteri Assuntivi
          </TabsTrigger>
          <TabsTrigger
            value="confronto"
            className="data-[state=active]:border-b-2 data-[state=active]:border-amber-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 gap-2"
          >
            <BarChart3 className="h-4 w-4" /> Confronto Assicurativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compagnie" className="mt-6">
          <CompagnieTab items={items} setItems={setItems} />
        </TabsContent>
        <TabsContent value="criteri" className="mt-6">
          <CriteriTab compagnie={items} />
        </TabsContent>
        <TabsContent value="confronto" className="mt-6">
          <ConfrontoTab compagnie={items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Compagnie Tab ============
function CompagnieTab({
  items,
  setItems,
}: {
  items: Compagnia[];
  setItems: (items: Compagnia[]) => void;
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Compagnia | null>(null);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return [...items]
      .filter((c) =>
        !s
          ? true
          : c.nome.toLowerCase().includes(s) ||
            c.codice.toLowerCase().includes(s) ||
            (c.note ?? "").toLowerCase().includes(s),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items, q]);

  const handleDelete = (id: string) => {
    setItems(items.filter((p) => p.id !== id));
    toast.success("Compagnia eliminata");
  };

  const handleSave = (c: Compagnia) => {
    const exists = items.some((p) => p.id === c.id);
    setItems(exists ? items.map((p) => (p.id === c.id ? c : p)) : [...items, c]);
    toast.success("Compagnia salvata");
    setEditing(null);
  };

  const handleNew = () =>
    setEditing({
      id: crypto.randomUUID(),
      nome: "",
      codice: "",
      prodotti: [],
      tipiCliente: [],
    });

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="h-5 w-5 text-violet-600" />
          Compagnie assicurative
        </h2>
        <Button onClick={handleNew} className="bg-indigo-700 hover:bg-indigo-700/90">
          <Plus className="h-4 w-4" /> Nuova compagnia
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca nome, codice o note…"
          className="pl-9 h-11"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Nome ▲</th>
              <th className="px-3 py-2 font-medium">Codice</th>
              <th className="px-3 py-2 font-medium">Prodotti</th>
              <th className="px-3 py-2 font-medium">Tipi cliente</th>
              <th className="px-3 py-2 text-right font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border/60 hover:bg-secondary/40">
                <td className="px-3 py-3 font-bold tracking-wide">{c.nome}</td>
                <td className="px-3 py-3 text-muted-foreground">{c.codice}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.prodotti.map((p) => (
                      <span
                        key={p}
                        className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.tipiCliente.map((t) => (
                      <span
                        key={t}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs font-medium",
                          t === "Dipendente Privato" &&
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                          t === "Dipendente Pubblico" &&
                            "border-amber-200 bg-amber-50 text-amber-700",
                          t === "Pensionato" &&
                            "border-violet-200 bg-violet-50 text-violet-700",
                        )}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing({ ...c })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(c.id)}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nessuna compagnia trovata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>1-{filtered.length} di {filtered.length}</span>
        <span>1 / 1</span>
      </div>

      {editing && (
        <EditDialog
          value={editing}
          isNew={!items.some((i) => i.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function EditDialog({
  value,
  isNew,
  onClose,
  onSave,
}: {
  value: Compagnia;
  isNew: boolean;
  onClose: () => void;
  onSave: (c: Compagnia) => void;
}) {
  const [v, setV] = useState<Compagnia>(value);

  const toggle = <K extends keyof Compagnia>(field: K, item: any) => {
    setV((prev) => {
      const arr = prev[field] as any[];
      const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
      return { ...prev, [field]: next };
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuova compagnia" : `Modifica ${value.nome}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-1.5">
            <Label>Codice</Label>
            <Input value={v.codice} onChange={(e) => setV({ ...v, codice: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-2">
            <Label>Prodotti</Label>
            <div className="flex flex-wrap gap-2">
              {PRODOTTI.map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                    v.prodotti.includes(p)
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-input",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={v.prodotti.includes(p)}
                    onChange={() => toggle("prodotti", p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipi cliente</Label>
            <div className="flex flex-wrap gap-2">
              {TIPI.map((t) => (
                <label
                  key={t}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                    v.tipiCliente.includes(t)
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-input",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={v.tipiCliente.includes(t)}
                    onChange={() => toggle("tipiCliente", t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <textarea
              value={v.note ?? ""}
              onChange={(e) => setV({ ...v, note: e.target.value })}
              className="min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button
            disabled={!v.nome.trim()}
            onClick={() => onSave({ ...v, codice: v.codice || v.nome })}
            className="bg-indigo-700 hover:bg-indigo-700/90"
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Criteri Assuntivi Tab ============
function CriteriTab({ compagnie }: { compagnie: Compagnia[] }) {
  const [banca, setBanca] = useState(BANCHE_LIST[0]);
  const [segmento, setSegmento] = useState(SEGMENTI[3]);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.toLowerCase().trim();
    return compagnie.filter(
      (c) => !s || c.nome.toLowerCase().includes(s) || c.codice.toLowerCase().includes(s),
    );
  }, [compagnie, q]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-bold">Criteri Assuntivi Strutturati</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Configura regole banca × compagnia × segmento per il motore di analisi busta paga.
      </p>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs text-muted-foreground">Banca mandante</Label>
          <select
            value={banca}
            onChange={(e) => setBanca(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {BANCHE_LIST.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Segmento</Label>
          <select
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {SEGMENTI.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Filtra compagnia</Label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome o codice…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {banca} · {segmento}
          </div>
          <span className="text-xs text-muted-foreground">{list.length} compagnie</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Compagnia</th>
              <th className="px-3 py-2 text-center font-medium">Attiva</th>
              <th className="px-3 py-2 text-center font-medium">Criteri</th>
              <th className="px-3 py-2 text-center font-medium">Stranieri</th>
              <th className="px-3 py-2 text-center font-medium">Malattia</th>
              <th className="px-3 py-2 text-center font-medium">Fondo Pens.</th>
              <th className="px-3 py-2 text-center font-medium">Campagne</th>
              <th className="px-3 py-2 text-center font-medium">Scheda</th>
              <th className="px-3 py-2 text-right font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c, i) => {
              const cr = makeCriteri(c.nome.length + i + segmento.length);
              const attiva = cr.schemeAttivo === "Si";
              return (
                <tr key={c.id} className="border-b border-border/60 hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="font-bold">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">({c.codice})</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold",
                        attiva ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                      )}
                    >
                      {attiva ? "✓ Si" : "No"}
                    </span>
                  </td>
                  <Dot on={attiva} />
                  <Dot on={cr.soloIt !== "—" || cr.comunitari !== "—"} />
                  <Dot on={cr.gMaxNoDoc !== "—"} />
                  <Dot on={(i + c.nome.length) % 3 === 0} />
                  <td className="px-3 py-3 text-center text-sm">{cr.campagne === "—" ? "—" : cr.campagne}</td>
                  <td className="px-3 py-3 text-center">
                    <button className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100">
                      <FileText className="h-3 w-3" /> Vedi
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button className="text-xs font-medium text-indigo-600 hover:underline">
                      Modifica
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

function Dot({ on }: { on: boolean }) {
  return (
    <td className="px-3 py-3 text-center">
      <span
        className={cn(
          "inline-block h-2.5 w-2.5 rounded-full",
          on ? "bg-emerald-500" : "bg-muted",
        )}
      />
    </td>
  );
}

// ============ Confronto Assicurativo ============
function ConfrontoTab({ compagnie }: { compagnie: Compagnia[] }) {
  const [banca, setBanca] = useState(BANCHE_LIST[0]);
  const [segmento, setSegmento] = useState(SEGMENTI[2]);
  const [q, setQ] = useState("");

  const cols = useMemo(() => {
    const s = q.toLowerCase().trim();
    return compagnie.filter(
      (c) => !s || c.nome.toLowerCase().includes(s) || c.codice.toLowerCase().includes(s),
    );
  }, [compagnie, q]);

  const dataByComp = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    cols.forEach((c, i) => {
      m[c.id] = makeCriteri(c.nome.length + i + segmento.length + banca.length);
    });
    return m;
  }, [cols, segmento, banca]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-bold">Confronto Assicurativo</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Confronto tabellare dei criteri assuntivi tra le compagnie attive per banca e segmento selezionato.
      </p>

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <div>
          <Label className="text-xs text-muted-foreground">Banca mandante</Label>
          <select
            value={banca}
            onChange={(e) => setBanca(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {BANCHE_LIST.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Segmento / prodotto</Label>
          <select
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {SEGMENTI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Filtra compagnia</Label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome o codice…" className="pl-9" />
          </div>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" /> Mostra inattivi
        </label>
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Stampa
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Confronto {banca} · {segmento}
        </div>
        <span className="text-xs text-muted-foreground">{cols.length} compagnie</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[220px] bg-card px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Criterio
              </th>
              {cols.map((c) => (
                <th
                  key={c.id}
                  className={cn(
                    "min-w-[120px] px-3 py-3 text-center text-xs font-bold uppercase text-white",
                    COMP_COLOR[c.codice] ?? "bg-slate-600",
                  )}
                >
                  <div className="text-sm">{c.nome}</div>
                  <div className="text-[10px] opacity-80">{c.codice}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <Fragment key={g.title}>
                <tr className="bg-secondary/50">
                  <td colSpan={cols.length + 1} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-foreground">
                    {g.title}
                  </td>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="sticky left-0 bg-card px-4 py-2 text-muted-foreground">{r.label}</td>
                    {cols.map((c) => {
                      const raw = dataByComp[c.id]?.[r.key];
                      const text = r.render ? r.render(raw) : dash(raw);
                      const isYes = text === "Si";
                      const isNo = text === "No";
                      return (
                        <td key={c.id} className="px-3 py-2 text-center">
                          <span
                            className={cn(
                              "inline-block min-w-[40px] rounded-md px-2 py-0.5 text-xs font-semibold",
                              isYes && "bg-emerald-50 text-emerald-700",
                              isNo && "bg-rose-50 text-rose-700",
                              !isYes && !isNo && "text-foreground",
                            )}
                          >
                            {text}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-center text-xs text-muted-foreground">
        Confronto generato il {new Date().toLocaleDateString("it-IT")} · Banca {banca} · {segmento}
      </div>
    </div>
  );
}