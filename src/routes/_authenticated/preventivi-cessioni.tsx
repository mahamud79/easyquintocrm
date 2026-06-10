import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, ChevronRight, ChevronLeft, Search, AlertTriangle } from "lucide-react";
import { useClientiStore } from "@/lib/clienti-store";
import { usePreventiviStore } from "@/lib/preventivi-store";
import { BANCHE_NOMI } from "@/lib/banche-list";
import { liquidatoActions } from "@/lib/liquidato-store";
import { useLeadsStore } from "@/lib/leads-store";
import { usePraticheStore } from "@/lib/pratiche-store";
import { clientiStore } from "@/lib/clienti-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatEuroIT, formatPctIT } from "@/lib/format-eur";

export const Route = createFileRoute("/_authenticated/preventivi-cessioni")({
  head: () => ({ meta: [{ title: "Preventivi Cessioni · LeadValue" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    clienteId: typeof s.clienteId === "string" ? s.clienteId : undefined,
  }),
  component: PreventiviCessioniPage,
});

// ---------- Types & helpers ----------

type Step = 1 | 2 | 3 | 4;

type DatiCliente = {
  clienteId: string | null;
  bancaMandante: string;
  nome: string;
  sesso: "Maschio" | "Femmina";
  dataNascita: string;
  dataAssunzione: string;
  tipologia: "Dipendente Pubblico" | "Dipendente Privato" | "Pensionato" | "Statale";
  settoreAtc: string;
  regione: string;
  mensilita: 12 | 13 | 14;
  tfrAzienda: number;
  tfrFondo: number;
};

type Impegno = {
  id: string;
  tipo: "CQS" | "PRESTITO_PERSONALE" | "DELEGAZIONE";
  banca: string;
  rata: number;
  dataDecorrenza: string;
  dataScadenza: string;
  daEstinguere: boolean;
};

type CalcoloInput = {
  tipoOperazione: "Cessione del Quinto" | "Delegazione di Pagamento";
  durata: 24 | 36 | 48 | 60 | 72 | 84 | 96 | 108 | 120;
  rataDesiderata: number;
  tan: number;
  provvigionePct: number;
  provvigioneEur: number;
  spese: number;
  rinnovo: boolean;
};

const BANCHE = BANCHE_NOMI;

const REGIONI = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana",
  "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

// Add. regionale per regione (semplificato, valore medio %)
const ADD_REGIONALE: Record<string, number> = {
  Lombardia: 1.74, Lazio: 1.73, Campania: 2.03, Piemonte: 1.62,
  Veneto: 1.23, "Emilia-Romagna": 1.43, Toscana: 1.42, Sicilia: 1.7,
  Puglia: 1.33, Liguria: 1.73, Sardegna: 1.23, Calabria: 1.73, Marche: 1.23,
  Abruzzo: 1.73, Umbria: 1.23, Basilicata: 1.23, Molise: 1.73,
  "Friuli-Venezia Giulia": 1.23, "Trentino-Alto Adige": 1.23,
  "Valle d'Aosta": 1.23,
};

const TIPOLOGIE: DatiCliente["tipologia"][] = [
  "Dipendente Privato", "Dipendente Pubblico", "Pensionato", "Statale",
];

const SETTORI_ATC = ["Statale", "Para-Statale", "Pubblico", "Privato", "Cooperativa", "Pensionato INPS"];

const fmtEur = (n: number) => formatEuroIT(n);
const fmtPct = (n: number) => formatPctIT(n);

// Euro input formattato con separatori migliaia e decimali
function EuroInput({
  value, onChange, placeholder, className,
}: { value: number; onChange: (n: number) => void; placeholder?: string; className?: string }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>("");
  // Formatta con separatori delle migliaia (formato IT) — implementazione manuale
  // per garantire il punto delle migliaia anche dove l'ICU non ha dati it-IT (SSR/Worker).
  const formatLive = (s: string) => {
    if (!s) return "";
    const neg = s.startsWith("-");
    const body = neg ? s.slice(1) : s;
    const [intPart, decPart] = body.split(",");
    const intFmt = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const out = decPart !== undefined ? `${intFmt},${decPart}` : intFmt;
    return neg ? `-${out}` : out;
  };
  const formatNumber = (n: number) => {
    if (!isFinite(n) || n === 0) return "";
    const fixed = Math.abs(n).toFixed(2); // "1234.56"
    const [i, d] = fixed.split(".");
    return `${n < 0 ? "-" : ""}${formatLive(i)},${d}`;
  };
  const display = focused ? formatLive(raw) : formatNumber(value);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
      <Input
        inputMode="decimal"
        value={display}
        placeholder={placeholder ?? "0,00"}
        className={cn("pl-7 tabular-nums", className)}
        onFocus={() => {
          setFocused(true);
          if (value > 0) {
            const fixed = value.toFixed(2);
            const [i, d] = fixed.split(".");
            setRaw(`${i},${d}`);
          } else {
            setRaw("");
          }
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          // Mantieni solo cifre, separatori e segno; rimuovi i punti (migliaia) e usa la virgola come decimale
          const cleaned = e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "");
          setRaw(cleaned);
          const n = Number(cleaned.replace(",", "."));
          onChange(isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}

function calcReddito(lordoMensile: number, regione: string, mensilita: number) {
  const inps = lordoMensile * 0.135;
  const imponibile = lordoMensile - inps;
  // IRPEF mensile approssimata su imponibile annuo (mensilita)
  const imponibileAnnuo = imponibile * mensilita;
  let irpefAnnua = 0;
  if (imponibileAnnuo <= 28000) irpefAnnua = imponibileAnnuo * 0.23;
  else if (imponibileAnnuo <= 50000) irpefAnnua = 28000 * 0.23 + (imponibileAnnuo - 28000) * 0.35;
  else irpefAnnua = 28000 * 0.23 + 22000 * 0.35 + (imponibileAnnuo - 50000) * 0.43;
  const irpefMensile = irpefAnnua / mensilita;
  const addRegPct = ADD_REGIONALE[regione] ?? 1.23;
  const addReg = (imponibile * addRegPct) / 100;
  const addCom = imponibile * 0.008;
  // Detrazioni lavoro dipendente (semplificate)
  let detrazioniAnnue = 0;
  if (imponibileAnnuo <= 15000) detrazioniAnnue = 1955;
  else if (imponibileAnnuo <= 28000) detrazioniAnnue = 1910 + 1190 * ((28000 - imponibileAnnuo) / 13000);
  else if (imponibileAnnuo <= 50000) detrazioniAnnue = 1910 * ((50000 - imponibileAnnuo) / 22000);
  const detrazioniMensili = Math.max(0, detrazioniAnnue / mensilita);
  const nettoMensile = imponibile - irpefMensile - addReg - addCom + detrazioniMensili;
  const nettoAnnuo = nettoMensile * mensilita;
  const nettoIn12 = nettoAnnuo / 12;
  const quotaCedibile = nettoIn12 / 5;
  return {
    inps, imponibile, irpefMensile, addReg, addRegPct, addCom,
    detrazioniMensili, nettoMensile, nettoAnnuo, nettoIn12, quotaCedibile,
  };
}

// Montante from rata, tan annuo, n mesi (rata costante - ammortamento francese)
function montanteDaRata(rata: number, tanAnnuo: number, mesi: number) {
  if (rata <= 0 || mesi <= 0) return 0;
  const i = tanAnnuo / 100 / 12;
  if (i === 0) return rata * mesi;
  return rata * (1 - Math.pow(1 + i, -mesi)) / i;
}

// Mappa un cliente del DB sui campi del form preventivo
function applyClienteToDati(d: DatiCliente, c: ReturnType<typeof useClientiStore>["clienti"][number]): DatiCliente {
  const tl = (c.tipoLavoro ?? "").toLowerCase();
  const tipologia: DatiCliente["tipologia"] =
    tl.includes("pubblic") ? "Dipendente Pubblico"
    : tl.includes("statal") ? "Statale"
    : tl.includes("pension") ? "Pensionato"
    : tl.includes("privat") ? "Dipendente Privato"
    : d.tipologia;
  const sesso: DatiCliente["sesso"] = (c.sex ?? "").toUpperCase().startsWith("F") ? "Femmina" : "Maschio";
  // Accetta sia il formato "italiano" (1.234,56) sia il formato decimale puro (1234.56)
  const num = (s?: string) => {
    if (!s) return 0;
    const raw = String(s).replace(/[^\d,.\-]/g, "");
    if (!raw) return 0;
    let normalized: string;
    if (raw.includes(",")) {
      // formato IT: i "." sono separatori delle migliaia, la "," è decimale
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      // nessuna virgola: il "." è il separatore decimale
      normalized = raw;
    }
    const n = Number(normalized);
    return isFinite(n) ? n : 0;
  };
  return {
    ...d,
    clienteId: c.id,
    nome: c.name,
    sesso,
    dataNascita: c.birthDate ?? d.dataNascita,
    dataAssunzione: c.dataAssunzione ?? d.dataAssunzione,
    tipologia,
    settoreAtc: c.settoreAtc && c.settoreAtc.trim() ? c.settoreAtc : d.settoreAtc,
    tfrAzienda: num(c.tfrAzienda) || d.tfrAzienda,
    tfrFondo: num(c.tfrFondo) || d.tfrFondo,
  };
}

// ---------- Page ----------

function PreventiviCessioniPage() {
  const { clienti } = useClientiStore();
  const { addPreventivo } = usePreventiviStore();
  const { leads } = useLeadsStore();
  const { pratiche } = usePraticheStore();
  const navigate = useNavigate();
  const { clienteId: prefillId } = Route.useSearch();
  const [step, setStep] = useState<Step>(1);

  // Solo clienti effettivamente collegati a un lead o a una pratica.
  // I record orfani (es. "aaa" di prova) non devono comparire nella ricerca,
  // e li ripuliamo dallo store all'avvio.
  const validClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of leads) ids.add(l.id);
    for (const p of pratiche) {
      if (p.clienteId) ids.add(p.clienteId);
    }
    return ids;
  }, [leads, pratiche]);

  const clientiCensiti = useMemo(
    () => clienti.filter((c) => validClientIds.has(c.id)),
    [clienti, validClientIds],
  );

  useEffect(() => {
    // Cleanup one-shot: rimuove clienti orfani che non risultano in
    // nessun lead o pratica (record fantasma da test).
    const orphans = clienti.filter((c) => !validClientIds.has(c.id));
    if (orphans.length === 0) return;
    for (const o of orphans) clientiStore.remove(o.id);
  }, [clienti, validClientIds]);

  const [dati, setDati] = useState<DatiCliente>({
    clienteId: null, bancaMandante: "", nome: "", sesso: "Maschio",
    dataNascita: "", dataAssunzione: "", tipologia: "Dipendente Privato",
    settoreAtc: "Statale", regione: "Lazio", mensilita: 12,
    tfrAzienda: 0, tfrFondo: 0,
  });

  useEffect(() => {
    if (!prefillId) return;
    const c = clienti.find((x) => x.id === prefillId);
    if (!c) return;
    setDati((d) => applyClienteToDati(d, c));
  }, [prefillId, clienti]);

  const [lordo, setLordo] = useState<number>(0);
  const [impegni, setImpegni] = useState<Impegno[]>([]);
  const [calc, setCalc] = useState<CalcoloInput>({
    tipoOperazione: "Cessione del Quinto", durata: 120, rataDesiderata: 0,
    tan: 4, provvigionePct: 3, provvigioneEur: 0, spese: 0, rinnovo: false,
  });
  const [rating, setRating] = useState<number>(0);

  const reddito = useMemo(() => calcReddito(lordo, dati.regione, dati.mensilita), [lordo, dati.regione, dati.mensilita]);

  const totRateNonEstinte = impegni.filter((i) => !i.daEstinguere).reduce((s, i) => s + i.rata, 0);
  const totRateDaEstinguere = impegni.filter((i) => i.daEstinguere).reduce((s, i) => s + i.rata, 0);
  const rataMaxDisponibile = Math.max(0, reddito.quotaCedibile - totRateNonEstinte);

  // Montante = valore attuale delle rate al TAN indicato (ammortamento francese)
  const montante = montanteDaRata(calc.rataDesiderata, calc.tan, calc.durata);
  const montanteLordo = calc.rataDesiderata * calc.durata;
  const provvigioneCalc = calc.provvigioneEur > 0 ? calc.provvigioneEur : montanteLordo * (calc.provvigionePct / 100);
  const nettoCliente = Math.max(0, montante - provvigioneCalc - calc.spese - totRateDaEstinguere);
  const sogliaIndebitamento = reddito.nettoIn12 > 0 ? ((calc.rataDesiderata + totRateNonEstinte) / reddito.nettoIn12) * 100 : 0;

  // TFR-based montante massimo (semplificazione: TFR totale × durata anni)
  const tfrTotale = dati.tfrAzienda + dati.tfrFondo;
  // Montante massimo da rating assicurativo: rating (1–6) × TFR disponibile (azienda + fondo)
  const montanteMassimo = tfrTotale > 0 && rating > 0 ? tfrTotale * rating : 0;

  const canNext1 = !!dati.nome && !!dati.dataNascita && !!dati.regione;
  const canNext2 = lordo > 0;

  const handleSave = () => {
    if (!dati.nome) {
      toast.error("Inserisci il nome del cliente");
      return;
    }
    const clienteCollegato = dati.clienteId ? clienti.find((c) => c.id === dati.clienteId) : null;

    // Riporta in Magazzino tutti gli impegni NON estinti, così seguono
    // il flusso di conteggio tempistiche per il rinnovo.
    const parts = (dati.nome || "").trim().split(/\s+/);
    const cognome = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? "—");
    const nome = parts.length > 1 ? parts.slice(0, -1).join(" ") : "—";
    const tipoToProdotto: Record<Impegno["tipo"], "CQS" | "Prestito" | "delega_pagamento"> = {
      CQS: "CQS",
      PRESTITO_PERSONALE: "Prestito",
      DELEGAZIONE: "delega_pagamento",
    };
    impegni
      .filter((i) => !i.daEstinguere && i.dataDecorrenza && i.dataScadenza)
      .forEach((i) => {
        // accetta sia "yyyy-MM" (nuovo) sia "yyyy-MM-dd" (legacy)
        const [dy, dm] = i.dataDecorrenza.split("-").map(Number);
        const [sy, sm] = i.dataScadenza.split("-").map(Number);
        // inclusivo: da gen 2025 a dic 2034 = 120 rate
        let durata = (sy - dy) * 12 + (sm - dm) + 1;
        if (durata < 0) durata = 0;
        // dataLiq = decorrenza - 1 mese (magazzino-utils riaggiunge 1 mese).
        // Calcolo manuale per evitare shift di fuso (toISOString usa UTC).
        const month0 = (dm || 1) - 1; // 0-based
        const liqYear = month0 === 0 ? dy - 1 : dy;
        const liqMonth = month0 === 0 ? 12 : month0; // 1-based
        const dataLiq = `${liqYear}-${String(liqMonth).padStart(2, "0")}-01`;
        liquidatoActions.addRow({
          id: `imp-${i.id}`,
          cognome,
          nome,
          prodotto: tipoToProdotto[i.tipo],
          banca: i.banca || null,
          dataLiq,
          rata: i.rata || null,
          durata,
          netto: null,
          provvigione: 0,
        });
      });

    addPreventivo({
      nome: dati.nome,
      tipoLead: "Lead",
      prodotto: calc.tipoOperazione,
      data: new Date().toISOString().slice(0, 10),
      categoria: "cessioni",
      tipoPratica: calc.tipoOperazione === "Cessione del Quinto" ? "CQS" : "DELEGA_PAGAMENTO",
      importo: montanteLordo,
      provvigione: provvigioneCalc,
      dettagli: {
        clienteId: dati.clienteId ?? undefined,
        telefonoCliente: clienteCollegato?.phone,
        emailCliente: clienteCollegato?.email,
        aziendaCliente: clienteCollegato?.azienda,
        sesso: dati.sesso,
        dataNascita: dati.dataNascita,
        dataAssunzione: dati.dataAssunzione,
        tipologia: dati.tipologia,
        regione: dati.regione,
        settoreAtc: dati.settoreAtc,
        mensilita: dati.mensilita,
        lordoMensile: lordo,
        nettoMensile: reddito.nettoMensile,
        quotaCedibile: reddito.quotaCedibile,
        sogliaIndebitamento,
        rata: calc.rataDesiderata,
        durata: calc.durata,
        tan: calc.tan,
        montante: montanteLordo,
        netto: nettoCliente,
        bancaMandante: dati.bancaMandante,
        provvigionePct: calc.provvigionePct,
        impegni: impegni.map((i) => ({
          id: i.id,
          tipo: i.tipo,
          banca: i.banca,
          rata: i.rata,
          dataDecorrenza: i.dataDecorrenza,
          dataScadenza: i.dataScadenza,
          daEstinguere: i.daEstinguere,
        })),
      },
    });
    toast.success("Preventivo salvato", { description: `Aggiunto ai Preventivi Salvati per ${dati.nome}` });
    navigate({ to: "/preventivi-salvati" });
  };

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: "Dati Cliente" },
    { n: 2, label: "Reddito" },
    { n: 3, label: "Impegni" },
    { n: 4, label: "Calcolo" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <FileText className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Nuovo Preventivo</h1>
      </header>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto">
        {steps.map((s, idx) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (done ? setStep(s.n) : null)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer",
                  !active && !done && "bg-secondary text-muted-foreground",
                )}
              >
                <span className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold",
                  active && "bg-primary-foreground/20",
                  done && "bg-emerald-600 text-white",
                  !active && !done && "bg-muted-foreground/20",
                )}>
                  {done ? "✓" : s.n}
                </span>
                {s.label}
              </button>
              {idx < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        {step === 1 && (
          <Step1 dati={dati} setDati={setDati} clienti={clientiCensiti} />
        )}
        {step === 2 && (
          <Step2 lordo={lordo} setLordo={setLordo} reddito={reddito} mensilita={dati.mensilita} regione={dati.regione} />
        )}
        {step === 3 && (
          <Step3
            impegni={impegni} setImpegni={setImpegni}
            totRateNonEstinte={totRateNonEstinte}
            totRateDaEstinguere={totRateDaEstinguere}
            rataMaxDisponibile={rataMaxDisponibile}
          />
        )}
        {step === 4 && (
          <Step4
            calc={calc} setCalc={setCalc}
            dati={dati} montante={montante}
            provvigioneCalc={provvigioneCalc}
            nettoCliente={nettoCliente}
            sogliaIndebitamento={sogliaIndebitamento}
            tfrTotale={tfrTotale} montanteMassimo={montanteMassimo}
            rating={rating} setRating={setRating}
            onSave={handleSave}
          />
        )}

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ChevronLeft className="h-4 w-4" /> Indietro
            </Button>
          ) : <div />}
          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
            >
              Avanti <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm("Sei sicuro di voler annullare? I dati inseriti andranno persi.")) {
                    navigate({ to: "/preventivi-salvati" });
                  }
                }}
              >
                Annulla
              </Button>
              <Button onClick={handleSave}>Salva Preventivo</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Step 1 ----------

function Step1({ dati, setDati, clienti }: { dati: DatiCliente; setDati: (d: DatiCliente) => void; clienti: ReturnType<typeof useClientiStore>["clienti"] }) {
  const [query, setQuery] = useState("");
  const [bancaQuery, setBancaQuery] = useState(dati.bancaMandante);
  const [clienteSelected, setClienteSelected] = useState<boolean>(!!dati.clienteId);
  const [bancaSelected, setBancaSelected] = useState<boolean>(!!dati.bancaMandante);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || clienteSelected) return [];
    return clienti.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6);
  }, [query, clienti, clienteSelected]);
  const bancheMatches = useMemo(() => {
    const q = bancaQuery.trim().toLowerCase();
    if (!q || bancaSelected) return [];
    return BANCHE.filter((b) => b.toLowerCase().includes(q)).slice(0, 6);
  }, [bancaQuery, bancaSelected]);

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dati Cliente</h2>

      <div className="relative">
        <Label className="mb-1.5 block">Cerca cliente esistente</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setClienteSelected(false); }}
            placeholder="Nome, cognome o telefono..."
            className="pl-9"
          />
        </div>
        {matches.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border/60 bg-popover shadow-lg">
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setDati(applyClienteToDati(dati, c));
                  setQuery(c.name);
                  setClienteSelected(true);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
        {dati.clienteId && <div className="mt-1 text-xs text-emerald-600">✓ Collegato al cliente</div>}
      </div>

      <div className="relative">
        <Label className="mb-1.5 block">Banca Mandante</Label>
        <Input
          value={bancaQuery}
          onChange={(e) => { setBancaQuery(e.target.value); setDati({ ...dati, bancaMandante: e.target.value }); setBancaSelected(false); }}
          placeholder="Cerca banca mandante..."
        />
        {bancheMatches.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border/60 bg-popover shadow-lg">
            {bancheMatches.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => { setBancaQuery(b); setDati({ ...dati, bancaMandante: b }); setBancaSelected(true); }}
                className="flex w-full px-3 py-2 text-sm hover:bg-accent"
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Nome cliente</Label>
          <Input value={dati.nome} onChange={(e) => setDati({ ...dati, nome: e.target.value })} placeholder="Mario Rossi" />
        </div>
        <div>
          <Label className="mb-1.5 block">Sesso</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={dati.sesso}
            onChange={(e) => setDati({ ...dati, sesso: e.target.value as DatiCliente["sesso"] })}
          >
            <option>Maschio</option><option>Femmina</option>
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">Data nascita</Label>
          <Input type="date" value={dati.dataNascita} onChange={(e) => setDati({ ...dati, dataNascita: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1.5 block">Data assunzione</Label>
          <Input type="date" value={dati.dataAssunzione} onChange={(e) => setDati({ ...dati, dataAssunzione: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1.5 block">Tipologia</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={dati.tipologia}
            onChange={(e) => setDati({ ...dati, tipologia: e.target.value as DatiCliente["tipologia"] })}
          >
            {TIPOLOGIE.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">Settore ATC</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={dati.settoreAtc}
            onChange={(e) => setDati({ ...dati, settoreAtc: e.target.value })}
          >
            {SETTORI_ATC.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">Regione</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={dati.regione}
            onChange={(e) => setDati({ ...dati, regione: e.target.value })}
          >
            {REGIONI.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">N. Mensilità</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={dati.mensilita}
            onChange={(e) => setDati({ ...dati, mensilita: Number(e.target.value) as 12 | 13 | 14 })}
          >
            <option value={12}>12</option><option value={13}>13</option><option value={14}>14</option>
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">TFR Azienda (€)</Label>
          <EuroInput value={dati.tfrAzienda} onChange={(n) => setDati({ ...dati, tfrAzienda: n })} />
        </div>
        <div>
          <Label className="mb-1.5 block">TFR Fondo (€)</Label>
          <EuroInput value={dati.tfrFondo} onChange={(n) => setDati({ ...dati, tfrFondo: n })} />
        </div>
      </div>
    </div>
  );
}

// ---------- Step 2 ----------

function Step2({ lordo, setLordo, reddito, mensilita, regione }: {
  lordo: number; setLordo: (n: number) => void;
  reddito: ReturnType<typeof calcReddito>;
  mensilita: number; regione: string;
}) {
  const rows: { label: string; value: string; sign?: "+" | "-"; emphasis?: boolean; tone?: "primary" | "success" }[] = [
    { label: "Lordo mensile", value: fmtEur(lordo) },
    { label: "Contributi INPS (13.50%)", value: fmtEur(reddito.inps), sign: "-" },
    { label: "Imponibile fiscale", value: fmtEur(reddito.imponibile) },
    { label: "IRPEF mensile", value: fmtEur(reddito.irpefMensile), sign: "-" },
    { label: `Add. regionale (${regione})`, value: fmtEur(reddito.addReg), sign: "-" },
    { label: "Add. comunale (0.8%)", value: fmtEur(reddito.addCom), sign: "-" },
    { label: "Detrazioni lavoro dip.", value: fmtEur(reddito.detrazioniMensili), sign: "+" },
    { label: "Netto mensile", value: fmtEur(reddito.nettoMensile), emphasis: true, tone: "primary" },
    { label: `Netto annuo (${mensilita} mensilità)`, value: fmtEur(reddito.nettoAnnuo) },
    { label: "Netto in 12esimi", value: fmtEur(reddito.nettoIn12) },
    { label: "Quota cedibile (1/5)", value: fmtEur(reddito.quotaCedibile), emphasis: true, tone: "success" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reddito e calcolo netto</h2>

      <div className="max-w-xs">
        <Label className="mb-1.5 block">Lordo mensile stipendio (€)</Label>
        <EuroInput value={lordo} onChange={setLordo} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="bg-muted/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Dettaglio calcolo
        </div>
        <div className="divide-y divide-border/60">
          {rows.map((r) => (
            <div
              key={r.label}
              className={cn(
                "flex items-center justify-between px-4 py-2 text-sm",
                r.tone === "primary" && "bg-primary/5",
                r.tone === "success" && "bg-emerald-50",
              )}
            >
              <span className={cn(r.emphasis && "font-semibold", r.tone === "primary" && "text-primary", r.tone === "success" && "text-emerald-700")}>
                {r.label}
              </span>
              <span className={cn("tabular-nums", r.emphasis && "font-semibold", r.tone === "primary" && "text-primary", r.tone === "success" && "text-emerald-700")}>
                {r.sign === "-" ? "− " : r.sign === "+" ? "+ " : ""}{r.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Step 3 ----------

function Step3({
  impegni, setImpegni, totRateNonEstinte, totRateDaEstinguere, rataMaxDisponibile,
}: {
  impegni: Impegno[]; setImpegni: (i: Impegno[]) => void;
  totRateNonEstinte: number; totRateDaEstinguere: number; rataMaxDisponibile: number;
}) {
  const [tipo, setTipo] = useState<Impegno["tipo"]>("CQS");
  const [banca, setBanca] = useState("");
  const [bancaSel, setBancaSel] = useState(false);
  const [rata, setRata] = useState<number>(0);
  const [dataDecorrenza, setDataDecorrenza] = useState<string>("");
  const [dataScadenza, setDataScadenza] = useState<string>("");

  const bancheMatches = useMemo(() => {
    const q = banca.trim().toLowerCase();
    if (!q || bancaSel) return [];
    return BANCHE.filter((b) => b.toLowerCase().includes(q)).slice(0, 6);
  }, [banca, bancaSel]);

  const add = () => {
    if (!banca || rata <= 0) return;
    setImpegni([
      ...impegni,
      {
        id: crypto.randomUUID(),
        tipo,
        banca,
        rata,
        dataDecorrenza,
        dataScadenza,
        daEstinguere: false,
      },
    ]);
    setBanca(""); setRata(0); setDataDecorrenza(""); setDataScadenza(""); setBancaSel(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Impegni in essere</h2>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Banca</th>
              <th className="px-3 py-2 text-right">Rata</th>
              <th className="px-3 py-2 text-left">Decorrenza</th>
              <th className="px-3 py-2 text-left">Scadenza</th>
              <th className="px-3 py-2 text-center">Da estinguere</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {impegni.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Nessun impegno inserito</td></tr>
            )}
            {impegni.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 font-medium">{i.tipo}</td>
                <td className="px-3 py-2">{i.banca}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtEur(i.rata)}</td>
                <td className="px-3 py-2">
                  <Input
                    type="month"
                    value={i.dataDecorrenza}
                    onChange={(e) =>
                      setImpegni(impegni.map((x) => x.id === i.id ? { ...x, dataDecorrenza: e.target.value } : x))
                    }
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="month"
                    value={i.dataScadenza}
                    onChange={(e) =>
                      setImpegni(impegni.map((x) => x.id === i.id ? { ...x, dataScadenza: e.target.value } : x))
                    }
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <Checkbox
                    checked={i.daEstinguere}
                    onCheckedChange={(v) => setImpegni(impegni.map((x) => x.id === i.id ? { ...x, daEstinguere: !!v } : x))}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => setImpegni(impegni.filter((x) => x.id !== i.id))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-1 gap-2 border-t border-border/60 bg-muted/20 p-3 sm:grid-cols-[120px_1fr_140px_auto] sm:items-end">
          <div>
            <Label className="mb-1 block text-[11px]">Tipo</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Impegno["tipo"])}
            >
              <option value="CQS">CQS</option>
              <option value="PRESTITO_PERSONALE">Prestito Personale</option>
              <option value="DELEGAZIONE">Delegazione</option>
            </select>
          </div>
          <div className="relative">
            <Label className="mb-1 block text-[11px]">Banca</Label>
            <Input
              value={banca}
              onChange={(e) => { setBanca(e.target.value); setBancaSel(false); }}
              placeholder="Inizia a digitare..."
            />
            {bancheMatches.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-52 w-full overflow-auto rounded-md border border-border/60 bg-popover shadow-lg">
                {bancheMatches.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => { setBanca(b); setBancaSel(true); }}
                    className="flex w-full px-3 py-2 text-sm hover:bg-accent"
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="mb-1 block text-[11px]">Rata (€)</Label>
            <EuroInput value={rata} onChange={setRata} />
          </div>
          <Button onClick={add} className="w-full gap-1 sm:w-auto">
            <Plus className="h-4 w-4" /> Aggiungi
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Summary label="Rate non estinte" value={fmtEur(totRateNonEstinte)} />
        <Summary label="Rate da estinguere" value={fmtEur(totRateDaEstinguere)} />
        <Summary label="Rata max disponibile" value={fmtEur(rataMaxDisponibile)} tone="success" />
      </div>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className={cn(
      "rounded-lg border border-border/60 px-4 py-3",
      tone === "success" && "border-emerald-200 bg-emerald-50",
    )}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone === "success" && "text-emerald-700")}>
        {value}
      </div>
    </div>
  );
}

// ---------- Step 4 ----------

function Step4({
  calc, setCalc, dati, montante, provvigioneCalc, nettoCliente, sogliaIndebitamento,
  tfrTotale, montanteMassimo, rating, setRating, onSave,
}: {
  calc: CalcoloInput; setCalc: (c: CalcoloInput) => void;
  dati: DatiCliente; montante: number; provvigioneCalc: number;
  nettoCliente: number; sogliaIndebitamento: number;
  tfrTotale: number; montanteMassimo: number;
  rating: number; setRating: (n: number) => void;
  onSave: () => void;
}) {
  const isPensionato = dati.tipologia === "Pensionato";
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Calcolo preventivo</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Tipo operazione</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={calc.tipoOperazione}
            onChange={(e) => setCalc({ ...calc, tipoOperazione: e.target.value as CalcoloInput["tipoOperazione"] })}
          >
            <option>Cessione del Quinto</option>
            <option>Delegazione di Pagamento</option>
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">Durata (mesi)</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={calc.durata}
            onChange={(e) => setCalc({ ...calc, durata: Number(e.target.value) as CalcoloInput["durata"] })}
          >
            {[24, 36, 48, 60, 72, 84, 96, 108, 120].map((d) => <option key={d} value={d}>{d} mesi</option>)}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">Rata desiderata (€)</Label>
          <EuroInput value={calc.rataDesiderata} onChange={(n) => setCalc({ ...calc, rataDesiderata: n })} />
        </div>
        <div>
          <Label className="mb-1.5 block">Tasso nominale annuo (%)</Label>
          <Input type="number" step="0.01" value={calc.tan || ""} onChange={(e) => setCalc({ ...calc, tan: Number(e.target.value) || 0 })} />
        </div>
        <div>
          <Label className="mb-1.5 block">Provvigione (%)</Label>
          <Input type="number" step="0.001" value={calc.provvigionePct || ""} onChange={(e) => setCalc({ ...calc, provvigionePct: Number(e.target.value) || 0, provvigioneEur: 0 })} />
        </div>
        <div>
          <Label className="mb-1.5 block">Provvigione (€)</Label>
          <EuroInput value={calc.provvigioneEur} onChange={(n) => setCalc({ ...calc, provvigioneEur: n })} placeholder={fmtEur(provvigioneCalc)} />
        </div>
        <div>
          <Label className="mb-1.5 block">Spese (bolli, imposte, comm.)</Label>
          <EuroInput value={calc.spese} onChange={(n) => setCalc({ ...calc, spese: n })} />
        </div>
        <div className="flex items-end gap-2 pb-1.5">
          <Checkbox id="rinnovo" checked={calc.rinnovo} onCheckedChange={(v) => setCalc({ ...calc, rinnovo: !!v })} />
          <Label htmlFor="rinnovo" className="cursor-pointer">Operazione di rinnovo</Label>
        </div>
      </div>

      {!isPensionato && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          <div className="mb-2 font-medium">Montante massimo ottenibile (da rating assicurativo)</div>
          <div className="grid items-end gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block">Rating assicurativo (1–6)</Label>
              <Input
                type="number"
                min={0}
                max={6}
                step={1}
                value={rating || ""}
                onChange={(e) => {
                  const n = Number(e.target.value) || 0;
                  setRating(Math.max(0, Math.min(6, n)));
                }}
                placeholder="es. 4"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              TFR disponibile: <span className="font-semibold text-foreground">{fmtEur(tfrTotale)}</span>
              <div className="opacity-80">(TFR azienda + TFR fondo pensione)</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Montante max</div>
              <div className="text-base font-semibold tabular-nums">
                {tfrTotale <= 0
                  ? "TFR mancante"
                  : rating <= 0
                  ? "Inserisci rating"
                  : fmtEur(montanteMassimo)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Riepilogo */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Riepilogo Preventivo</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KV label="Cliente" value={dati.nome || "—"} />
          <KV label="Tipo" value={calc.tipoOperazione === "Cessione del Quinto" ? "CQS" : "DEL"} />
          <KV label="Rata" value={fmtEur(calc.rataDesiderata)} />
          <KV label="Durata" value={`${calc.durata} mesi`} />
          <KV label="Tasso" value={fmtPct(calc.tan)} />
          <KV label="Montante lordo" value={fmtEur(calc.rataDesiderata * calc.durata)} />
          <KV label="Netto cliente" value={fmtEur(nettoCliente)} />
          <KV label="Soglia indebit." value={fmtPct(sogliaIndebitamento)} />
        </div>
        {sogliaIndebitamento > 50 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Soglia indebitamento superiore al 50%
          </div>
        )}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}