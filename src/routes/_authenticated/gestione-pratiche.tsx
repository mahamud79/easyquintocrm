import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  PRATICA_STAGES,
  praticaMontanteLordo,
  type Pratica,
  type PraticaPriorita,
  type PraticaStageKey,
  type PraticaTipo,
  usePraticheStore,
} from "@/lib/pratiche-store";
import { clientiStore } from "@/lib/clienti-store";
import { useClientiStore } from "@/lib/clienti-store";
import { useLeadsStore } from "@/lib/leads-store";
import { useCompagnie } from "@/lib/compagnie-store";
import { aziendeStore } from "@/lib/aziende-store";

export const Route = createFileRoute("/_authenticated/gestione-pratiche")({
  head: () => ({ meta: [{ title: "Gestione Pratiche · LeadValue" }] }),
  component: GestionePratichePage,
});

type EditState =
  | { mode: "new"; stage: PraticaStageKey }
  | { mode: "edit"; pratica: Pratica }
  | null;

const euroFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const parseEuroValue = (value: number | string | undefined | null) => {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = value.replace(/[^\d,.-]/g, "").trim();
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const separator = lastComma > lastDot ? "," : lastDot > -1 ? "." : null;
  const digitsAfterSeparator = separator
    ? raw.length - raw.lastIndexOf(separator) - 1
    : 0;
  const hasOtherSeparator = separator === "," ? lastDot > -1 : lastComma > -1;
  const decimalSeparator =
    separator && (hasOtherSeparator || digitsAfterSeparator !== 3)
      ? separator
      : null;

  const normalized = decimalSeparator
    ? raw
        .replace(new RegExp(`\\${decimalSeparator === "," ? "." : ","}`, "g"), "")
        .replace(decimalSeparator, ".")
    : raw.replace(/[.,]/g, "");

  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
};

const fmtEuro = (n: number | string | undefined | null) =>
  euroFormatter.format(parseEuroValue(n));

function GestionePratichePage() {
  const { pratiche, movePratica, deletePratica, updatePratica, addPratica } = usePraticheStore();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditState>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<PraticaStageKey | null>(null);
  const [liqAsk, setLiqAsk] = useState<{ id: string; data: string } | null>(null);

  const askMove = (id: string, stage: PraticaStageKey) => {
    if (stage === "liquidata") {
      setLiqAsk({ id, data: new Date().toISOString().slice(0, 10) });
    } else {
      movePratica(id, stage);
    }
  };

  const filtered = useMemo(() => {
    if (!query) return pratiche;
    const q = query.toLowerCase();
    return pratiche.filter((p) =>
      `${p.nomePratica} ${p.cliente} ${p.telefono ?? ""} ${p.numeroPratica ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [pratiche, query]);

  const byStage = useMemo(() => {
    const map = new Map<PraticaStageKey, Pratica[]>();
    PRATICA_STAGES.forEach((s) => map.set(s.key, []));
    filtered.forEach((p) => map.get(p.stage)?.push(p));
    return map;
  }, [filtered]);

  const totalProvvigione = filtered.reduce((acc, p) => acc + (p.provvigione ?? 0), 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Top header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1 text-base font-semibold">
            <FileText className="h-4 w-4" />
            Gestione Pratiche — Cessione del Quinto
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-xs">{filtered.length} pratiche</Badge>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
            €{fmtEuro(totalProvvigione)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca pratica..."
              className="h-9 w-64 rounded-full pl-9"
            />
          </div>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setEditing({ mode: "new", stage: "attesa_doc" })}
          >
            <Plus className="h-4 w-4" /> Nuova Pratica
          </Button>
        </div>
      </header>

      {/* Board */}
      <div className="flex flex-1 gap-3 overflow-x-auto bg-muted/30 p-4">
        {PRATICA_STAGES.map((stage) => {
          const items = byStage.get(stage.key) ?? [];
          const total = items.reduce((acc, x) => acc + (x.provvigione ?? 0), 0);
          const isOver = dragOver === stage.key;
          return (
            <div
              key={stage.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage.key);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage.key ? null : s))}
              onDrop={() => {
                if (draggingId) askMove(draggingId, stage.key);
                setDraggingId(null);
                setDragOver(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl",
                isOver && "ring-2 ring-primary/40",
              )}
            >
              <div className={cn("rounded-t-xl border-t-4 bg-card px-3 py-2", stage.border)}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">{stage.label}</div>
                  <button
                    type="button"
                    title="Nuova pratica"
                    onClick={() => setEditing({ mode: "new", stage: stage.key })}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {items.length} Pratiche <span className="text-emerald-600">€{fmtEuro(total)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {items.map((p) => (
                  <PraticaCard
                    key={p.id}
                    pratica={p}
                    onDragStart={() => setDraggingId(p.id)}
                    onDragEnd={() => setDraggingId(null)}
                    dragging={draggingId === p.id}
                    onMove={(s) => askMove(p.id, s)}
                    onEdit={() => setEditing({ mode: "edit", pratica: p })}
                    onDelete={() => deletePratica(p.id)}
                    onLost={() => movePratica(p.id, "respinta")}
                  />
                ))}
                {items.length === 0 && (
                  <div className="flex flex-col items-center gap-2 rounded-md px-3 py-10 text-center text-xs text-muted-foreground">
                    <FileText className="h-6 w-6 opacity-40" />
                    Nessuna pratica
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer pagination strip (visual only) */}
      <div className="flex items-center justify-end gap-1 border-t border-border bg-card px-4 py-1">
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <PraticaDialog
        key={editing?.mode === "edit" ? editing.pratica.id : editing?.mode === "new" ? `new-${editing.stage}` : "closed"}
        state={editing}
        onClose={() => setEditing(null)}
        onSave={(values) => {
          const aziendaName = (values.azienda ?? "").trim();
          if (aziendaName && !aziendeStore.findByName(aziendaName)) {
            aziendeStore.add({ nome: aziendaName });
          }
          if (editing?.mode === "edit") {
            updatePratica(editing.pratica.id, {
              numeroPratica: values.numeroPratica ?? editing.pratica.numeroPratica,
              numeroPraticaBanca: values.numeroPraticaBanca ?? editing.pratica.numeroPraticaBanca,
              compagniaAssicurativa: values.compagniaAssicurativa ?? editing.pratica.compagniaAssicurativa,
            });
          } else if (editing?.mode === "new") {
            addPratica({
              nomePratica: values.nomePratica ?? "Nuova pratica",
              cliente: values.cliente ?? "",
              telefono: values.telefono ?? null,
              azienda: values.azienda ?? null,
              tipo: (values.tipo as PraticaTipo) ?? "CQS",
              numeroPratica: values.numeroPratica ?? null,
              importo: values.importo ?? 0,
              provvigione: values.provvigione ?? 0,
              stage: (values.stage as PraticaStageKey) ?? editing.stage,
              priorita: values.priorita ?? null,
              note: values.note ?? "",
              numeroPraticaBanca: values.numeroPraticaBanca ?? null,
              compagniaAssicurativa: values.compagniaAssicurativa ?? null,
              prodotto: "Cessione del Quinto",
              banca: values.banca ?? null,
              durata: values.durata ?? null,
              rata: values.rata ?? null,
            });
          }
          setEditing(null);
        }}
      />

      <Dialog open={!!liqAsk} onOpenChange={(o) => !o && setLiqAsk(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Data di liquidazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Inserisci la data effettiva di liquidazione (utile per pratiche storiche).
            </p>
            <Input
              type="date"
              value={liqAsk?.data ?? ""}
              onChange={(e) => setLiqAsk((s) => (s ? { ...s, data: e.target.value } : s))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiqAsk(null)}>Annulla</Button>
            <Button
              onClick={() => {
                if (liqAsk) movePratica(liqAsk.id, "liquidata", liqAsk.data);
                setLiqAsk(null);
              }}
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PraticaCard({
  pratica,
  onDragStart,
  onDragEnd,
  dragging,
  onMove,
  onEdit,
  onDelete,
  onLost,
}: {
  pratica: Pratica;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
  onMove: (s: PraticaStageKey) => void;
  onEdit: () => void;
  onDelete: () => void;
  onLost: () => void;
}) {
  const navigate = useNavigate();
  const montanteLordo = praticaMontanteLordo(pratica);
  const goToScheda = () => {
    const slug =
      pratica.clienteId ||
      `cliente_pratica_${pratica.cliente
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")}`;
    clientiStore.ensure({
      id: slug,
      name: pratica.cliente,
      phone: pratica.telefono,
    });
    navigate({ to: "/clienti/$id", params: { id: slug } });
  };
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        dragging && "opacity-50",
      )}
    >
      <div className="text-sm font-semibold text-foreground">{pratica.nomePratica}</div>
      <dl className="mt-2 space-y-1 text-xs">
        <Row label="Cliente" value={
          <button
            type="button"
            onClick={goToScheda}
            onMouseDown={(e) => e.stopPropagation()}
            draggable={false}
            className="text-primary hover:underline"
          >
            {pratica.cliente}
          </button>
        } />
        {pratica.azienda && <Row label="Azienda" value={pratica.azienda} />}
        <Row label="Telefono" value={pratica.telefono ?? "—"} />
        <Row label="Tipo" value={pratica.tipo} />
        <Row label="N. Pratica" value={pratica.numeroPratica ?? "—"} />
        <Row
          label="Montante lordo"
          value={montanteLordo ? `€${fmtEuro(montanteLordo)}` : "—"}
        />
        <Row
          label="Provvigione"
          value={
            pratica.provvigione ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                €{fmtEuro(pratica.provvigione)}
              </span>
            ) : (
              "—"
            )
          }
        />
      </dl>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
        <div className="flex items-center gap-1">
          <StageMenu currentStage={pratica.stage} onChange={onMove} />
          <IconButton title="Segnala come persa" onClick={onLost}>
            <Flag className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <div className="flex items-center gap-1">
          <IconButton title="Modifica" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton title="Elimina" onClick={onDelete} className="hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}

function IconButton({
  children,
  title,
  className,
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      className={cn("rounded p-1 hover:bg-muted transition", className)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

function StageMenu({
  currentStage,
  onChange,
}: {
  currentStage: PraticaStageKey;
  onChange: (s: PraticaStageKey) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded p-1 hover:bg-muted" title="Cambia fase">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
          Cambia fase
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRATICA_STAGES.map((s) => (
          <DropdownMenuItem
            key={s.key}
            onClick={() => onChange(s.key)}
            className={cn(s.key === currentStage && "font-semibold text-primary")}
          >
            {s.key === currentStage && "✓ "}
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type PraticaDialogValues = Partial<Pratica>;

function PraticaDialog({
  state,
  onClose,
  onSave,
}: {
  state: EditState;
  onClose: () => void;
  onSave: (values: PraticaDialogValues) => void;
}) {
  const open = !!state;
  const isEdit = state?.mode === "edit";
  const { clienti } = useClientiStore();
  const { leads } = useLeadsStore();

  // Trova cliente/lead collegato per pre-compilare i campi noti
  const linked = useMemo(() => {
    if (state?.mode !== "edit") return { cli: null, lead: null };
    const p = state.pratica;
    const cli =
      (p.clienteId && clienti.find((c) => c.id === p.clienteId)) ||
      clienti.find((c) => c.name.toLowerCase() === (p.cliente || "").toLowerCase()) ||
      (p.telefono && clienti.find((c) => c.phone === p.telefono)) ||
      null;
    const lead =
      leads.find((l) => l.name.toLowerCase() === (p.cliente || "").toLowerCase()) ||
      (p.telefono ? leads.find((l) => (l.phone ?? "") === p.telefono) : null) ||
      null;
    return { cli, lead };
  }, [state, clienti, leads]);

  const base: PraticaDialogValues =
    state?.mode === "edit"
      ? state.pratica
      : { stage: state?.mode === "new" ? state.stage : "attesa_doc", tipo: "CQS" };

  const initCliente = state?.mode === "edit"
    ? (base.cliente || linked.cli?.name || linked.lead?.name || "")
    : (base.cliente ?? "");
  const initTelefono = state?.mode === "edit"
    ? (base.telefono || linked.cli?.phone || linked.lead?.phone || "")
    : "";
  const initAzienda = state?.mode === "edit"
    ? (base.azienda || linked.cli?.azienda || linked.lead?.azienda || "")
    : "";
  const initBanca = state?.mode === "edit"
    ? (base.banca || linked.cli?.banca || "")
    : (base.banca ?? "");

  const [cliente, setCliente] = useState(initCliente);
  const [telefono, setTelefono] = useState(initTelefono);
  const [azienda, setAzienda] = useState(initAzienda);
  const [stage, setStage] = useState<PraticaStageKey>((base.stage as PraticaStageKey) ?? "attesa_doc");
  const [tipo, setTipo] = useState<PraticaTipo>((base.tipo as PraticaTipo) ?? "CQS");
  const [importo, setImporto] = useState<string>(String(base.importo ?? ""));
  const [provvigione, setProvvigione] = useState<string>(String(base.provvigione ?? ""));
  const [nomePratica, setNomePratica] = useState(base.nomePratica ?? "");
  const [priorita, setPriorita] = useState<PraticaPriorita>(base.priorita ?? null);
  const [note, setNote] = useState(base.note ?? "");
  const [numeroPratica, setNumeroPratica] = useState(base.numeroPratica ?? "");
  const [numeroPraticaBanca, setNumeroPraticaBanca] = useState(base.numeroPraticaBanca ?? "");
  const [compagniaAssicurativa, setCompagniaAssicurativa] = useState(base.compagniaAssicurativa ?? "");
  const [banca, setBanca] = useState(initBanca);
  const [durata, setDurata] = useState<string>(base.durata != null ? String(base.durata) : "");
  const [rata, setRata] = useState<string>(base.rata != null ? String(base.rata) : "");
  const montanteLordo = parseEuroValue(rata) * parseEuroValue(durata);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {state?.mode === "edit" ? "Modifica Pratica" : "Nuova Pratica"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isEdit ? (
            <>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <div className="font-semibold text-foreground">{cliente || "Cliente non indicato"}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Telefono: <b className="text-foreground">{telefono || "—"}</b></span>
                  <span>Azienda: <b className="text-foreground">{azienda || "—"}</b></span>
                  <span>Banca: <b className="text-foreground">{banca || "—"}</b></span>
                  <span>Rata: <b className="text-foreground">{rata ? `€${fmtEuro(rata)}` : "—"}</b></span>
                  <span>Durata: <b className="text-foreground">{durata ? `${durata} mesi` : "—"}</b></span>
                  <span>Montante lordo: <b className="text-foreground">{montanteLordo ? `€${fmtEuro(montanteLordo)}` : "—"}</b></span>
                </div>
              </div>
              <Field label="Numero Pratica">
                <Input value={numeroPratica} onChange={(e) => setNumeroPratica(e.target.value)} placeholder="Es. P12345" />
              </Field>
              <Field label="Compagnia Assicurativa">
                <Input list="compagnie-list" value={compagniaAssicurativa} onChange={(e) => setCompagniaAssicurativa(e.target.value)} placeholder="Inizia a digitare..." />
                <CompagnieDatalist />
              </Field>
            </>
          ) : (
            <>
              <Field label="Cliente *">
                <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome cliente" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={<>Telefono</>}>
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+39…" />
                </Field>
                <Field label={<>Azienda</>}>
                  <Input value={azienda} onChange={(e) => setAzienda(e.target.value)} placeholder="Datore di lavoro" />
                </Field>
              </div>
              <Field label="Step / Fase">
                <select value={stage} onChange={(e) => setStage(e.target.value as PraticaStageKey)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {PRATICA_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Tipo">
                <select value={tipo} onChange={(e) => setTipo(e.target.value as PraticaTipo)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="CQS">CQS</option>
                  <option value="DELEGA_PAGAMENTO">DELEGA_PAGAMENTO</option>
                  <option value="PRESTITO_PERSONALE">PRESTITO_PERSONALE</option>
                  <option value="MUTUO">MUTUO</option>
                </select>
              </Field>
              <Field label="Montante lordo (€)"><Input value={montanteLordo ? fmtEuro(montanteLordo) : ""} readOnly className="bg-muted" /></Field>
              <Field label={<>Provvigione (€) <span className="text-muted-foreground">(opzionale)</span></>}><Input type="number" value={provvigione} onChange={(e) => setProvvigione(e.target.value)} /></Field>
              <Field label="Nome Pratica"><Input value={nomePratica} onChange={(e) => setNomePratica(e.target.value)} /></Field>
              <Field label="Priorità">
                <select value={priorita ?? ""} onChange={(e) => setPriorita((e.target.value || null) as PraticaPriorita)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Seleziona...</option>
                  <option value="bassa">Bassa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </Field>
              <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note sulla pratica..." rows={3} /></Field>
              <Field label={<>Numero Pratica <span className="text-muted-foreground">(interno)</span></>}><Input value={numeroPratica} onChange={(e) => setNumeroPratica(e.target.value)} placeholder="Es. P12345" /></Field>
              <Field label={<>N. Pratica Banca <span className="text-muted-foreground">(opzionale)</span></>}><Input value={numeroPraticaBanca} onChange={(e) => setNumeroPraticaBanca(e.target.value)} placeholder="Es. 1234567" /></Field>
              <Field label={<>Banca mandante <span className="text-muted-foreground">(opzionale)</span></>}><Input value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="Es. BIBANCA" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={<>Durata (mesi)</>}><Input type="number" value={durata} onChange={(e) => setDurata(e.target.value)} /></Field>
                <Field label={<>Rata (€)</>}><Input type="number" step="0.01" value={rata} onChange={(e) => setRata(e.target.value)} /></Field>
              </div>
              <Field label={<>Compagnia Assicurativa <span className="text-muted-foreground">(opzionale)</span></>}><Input list="compagnie-list" value={compagniaAssicurativa} onChange={(e) => setCompagniaAssicurativa(e.target.value)} placeholder="Inizia a digitare..." /><CompagnieDatalist /></Field>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button
            onClick={() =>
              onSave({
                cliente,
                telefono: telefono || null,
                azienda: azienda || null,
                stage,
                tipo,
                importo: montanteLordo || Number(importo) || 0,
                provvigione: Number(provvigione) || 0,
                nomePratica,
                priorita,
                note,
                numeroPratica: numeroPratica || null,
                numeroPraticaBanca: numeroPraticaBanca || null,
                compagniaAssicurativa: compagniaAssicurativa || null,
                banca: banca || null,
                durata: durata === "" ? null : Number(durata),
                rata: rata === "" ? null : Number(rata),
              })
            }
          >
            {state?.mode === "edit" ? "Aggiorna" : "Crea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function CompagnieDatalist() {
  const [items] = useCompagnie();
  return (
    <datalist id="compagnie-list">
      {items.map((c) => (
        <option key={c.id} value={c.nome} />
      ))}
    </datalist>
  );
}