import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  ClipboardList,
  Landmark,
  Upload,
  X,
  FileText,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prodotti")({
  head: () => ({ meta: [{ title: "Prodotti · LeadValue" }] }),
  component: ProdottiPage,
});

// ============== Types ==============
type Categoria = "Prestiti" | "Mutui" | "Cessione del Quinto" | "Delega" | "Assicurazioni" | "Altro";

type Caratteristica = { id: string; titolo: string; descrizione: string };
type Allegato = { id: string; nome: string; size: number };

type Prodotto = {
  id: string;
  nome: string;
  categoria: Categoria;
  descrizione?: string;
  attivo: boolean;
  caratteristiche: Caratteristica[];
  allegati: Allegato[];
};

type Mandato = {
  id: string;
  nome: string;
  banca: string;
  prodotti: string[];
  assicurazioni: string[];
};

const CATEGORIE: Categoria[] = ["Prestiti", "Mutui", "Cessione del Quinto", "Delega", "Assicurazioni", "Altro"];

const CAT_STYLE: Record<Categoria, string> = {
  Prestiti: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Mutui: "bg-sky-50 text-sky-700 border-sky-200",
  "Cessione del Quinto": "bg-amber-50 text-amber-700 border-amber-200",
  Delega: "bg-violet-50 text-violet-700 border-violet-200",
  Assicurazioni: "bg-rose-50 text-rose-700 border-rose-200",
  Altro: "bg-slate-50 text-slate-700 border-slate-200",
};

const SEED_PRODOTTI: Prodotto[] = [
  { id: "p1", nome: "Prestito Personale", categoria: "Prestiti", attivo: true, caratteristiche: [], allegati: [] },
  { id: "p2", nome: "Delegazione di Pagamento", categoria: "Delega", attivo: true, caratteristiche: [], allegati: [] },
  { id: "p3", nome: "Cessione del Quinto", categoria: "Cessione del Quinto", attivo: true, caratteristiche: [], allegati: [] },
];

const SEED_MANDATI: Mandato[] = [
  {
    id: "m1",
    nome: "Capitalfin",
    banca: "CAPITALFIN",
    prodotti: ["Cessione del Quinto", "Delegazione di Pagamento"],
    assicurazioni: ["NET", "CARDIF", "CF", "ALLIANZ", "GAIIL"],
  },
  {
    id: "m2",
    nome: "Unicredit Vecchio",
    banca: "UNICREDIT",
    prodotti: ["Cessione del Quinto", "Delegazione di Pagamento"],
    assicurazioni: ["NET", "CARDIF", "SOGECAP", "GAIIL"],
  },
];

const ALL_BANCHE = ["CAPITALFIN", "UNICREDIT", "IBL BANCA", "BNL", "BPER", "INTESA SAN PAOLO", "COMPASS", "FINDOMESTIC"];
const ALL_ASSICURAZIONI = ["ALLIANZ", "AXA", "CARDIF", "CF", "GAIIL", "HDI", "NET", "SOGECAP"];

// ============== Page ==============
function ProdottiPage() {
  const [prodotti, setProdotti] = useState<Prodotto[]>(SEED_PRODOTTI);
  const [mandati, setMandati] = useState<Mandato[]>(SEED_MANDATI);
  const [tab, setTab] = useState<"prodotti" | "mandati">("prodotti");
  const [filter, setFilter] = useState<"Tutti" | Categoria>("Tutti");

  const [editingProd, setEditingProd] = useState<Prodotto | null>(null);
  const [editingMand, setEditingMand] = useState<Mandato | null>(null);
  const [scheda, setScheda] = useState<Prodotto | null>(null);

  const attivi = prodotti.filter((p) => p.attivo).length;

  const counts = useMemo(() => {
    const c: Record<string, number> = { Tutti: prodotti.length };
    CATEGORIE.forEach((cat) => (c[cat] = prodotti.filter((p) => p.categoria === cat).length));
    return c;
  }, [prodotti]);

  const filtered = useMemo(() => {
    return filter === "Tutti" ? prodotti : prodotti.filter((p) => p.categoria === filter);
  }, [prodotti, filter]);

  const saveProdotto = (p: Prodotto) => {
    setProdotti((prev) => {
      const ex = prev.some((x) => x.id === p.id);
      return ex ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    });
    toast.success("Prodotto salvato");
    setEditingProd(null);
    setScheda(null);
  };

  const deleteProdotto = (id: string) => {
    setProdotti((p) => p.filter((x) => x.id !== id));
    toast.success("Prodotto eliminato");
  };

  const toggleAttivo = (id: string) =>
    setProdotti((p) => p.map((x) => (x.id === id ? { ...x, attivo: !x.attivo } : x)));

  const saveMandato = (m: Mandato) => {
    setMandati((prev) => {
      const ex = prev.some((x) => x.id === m.id);
      return ex ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m];
    });
    toast.success("Mandato salvato");
    setEditingMand(null);
  };

  const deleteMandato = (id: string) => {
    setMandati((p) => p.filter((x) => x.id !== id));
    toast.success("Mandato eliminato");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Package className="h-6 w-6 text-indigo-600" />
            Prodotti
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {attivi} attivi · {prodotti.length} totali · {mandati.length} mandati
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setEditingMand({
                id: crypto.randomUUID(),
                nome: "",
                banca: "",
                prodotti: [],
                assicurazioni: [],
              })
            }
          >
            <ClipboardList className="h-4 w-4" /> Mandato Banca
          </Button>
          <Button
            onClick={() =>
              setEditingProd({
                id: crypto.randomUUID(),
                nome: "",
                categoria: "Prestiti",
                attivo: true,
                caratteristiche: [],
                allegati: [],
              })
            }
            className="bg-indigo-600 hover:bg-indigo-600/90"
          >
            <Plus className="h-4 w-4" /> Nuovo prodotto
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border">
        <button
          onClick={() => setTab("prodotti")}
          className={cn(
            "border-b-2 px-1 pb-3 text-sm font-semibold transition-colors",
            tab === "prodotti" ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Prodotti ({prodotti.length})
        </button>
        <button
          onClick={() => setTab("mandati")}
          className={cn(
            "border-b-2 px-1 pb-3 text-sm font-semibold transition-colors",
            tab === "mandati" ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Mandati ({mandati.length})
        </button>
      </div>

      {tab === "prodotti" ? (
        <>
          {/* Filtri categoria */}
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Tutti" count={counts.Tutti} active={filter === "Tutti"} onClick={() => setFilter("Tutti")} />
            {CATEGORIE.map((c) => (
              <FilterChip
                key={c}
                label={c}
                count={counts[c]}
                active={filter === c}
                onClick={() => setFilter(c)}
              />
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProdottoCard
                  key={p.id}
                  prodotto={p}
                  onToggle={() => toggleAttivo(p.id)}
                  onDelete={() => deleteProdotto(p.id)}
                  onEdit={() => setEditingProd(p)}
                  onScheda={() => setScheda(p)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <MandatiList mandati={mandati} onEdit={setEditingMand} onDelete={deleteMandato} />
      )}

      {editingProd && (
        <ProdottoDialog
          value={editingProd}
          isNew={!prodotti.some((p) => p.id === editingProd.id)}
          onClose={() => setEditingProd(null)}
          onSave={saveProdotto}
        />
      )}

      {editingMand && (
        <MandatoDialog
          value={editingMand}
          isNew={!mandati.some((m) => m.id === editingMand.id)}
          prodottiDisponibili={prodotti.map((p) => p.nome)}
          onClose={() => setEditingMand(null)}
          onSave={saveMandato}
        />
      )}

      {scheda && (
        <SchedaDialog
          value={scheda}
          onClose={() => setScheda(null)}
          onSave={saveProdotto}
        />
      )}
    </div>
  );
}

// ============== Subcomponents ==============
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-border bg-card text-muted-foreground hover:bg-secondary",
      )}
    >
      {label} <span className="ml-1 text-xs opacity-70">({count})</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
      <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
      <p className="text-sm font-medium text-muted-foreground">Nessun prodotto</p>
    </div>
  );
}

function ProdottoCard({
  prodotto,
  onToggle,
  onDelete,
  onEdit,
  onScheda,
}: {
  prodotto: Prodotto;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onScheda: () => void;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-semibold",
            CAT_STYLE[prodotto.categoria],
          )}
        >
          {prodotto.categoria}
        </span>
        <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            title="Modifica"
            className="rounded-md p-1.5 hover:bg-secondary"
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onToggle}
            title={prodotto.attivo ? "Disattiva" : "Attiva"}
            className="rounded-md p-1.5 hover:bg-secondary"
          >
            {prodotto.attivo ? (
              <Eye className="h-4 w-4 text-emerald-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={onDelete}
            title="Elimina"
            className="rounded-md p-1.5 hover:bg-secondary"
          >
            <Trash2 className="h-4 w-4 text-rose-500" />
          </button>
        </div>
      </div>
      <h3 className="mb-2 text-lg font-bold">{prodotto.nome}</h3>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{prodotto.caratteristiche.length} caratteristiche</span>
        <span>·</span>
        <span>{prodotto.allegati.length} allegati</span>
      </div>
      <button
        onClick={onScheda}
        className="-mx-2 -mb-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-md px-2 py-2 text-sm font-semibold text-indigo-600 hover:bg-secondary"
      >
        Gestisci scheda prodotto
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MandatiList({
  mandati,
  onEdit,
  onDelete,
}: {
  mandati: Mandato[];
  onEdit: (m: Mandato) => void;
  onDelete: (id: string) => void;
}) {
  if (mandati.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <ClipboardList className="mb-3 h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Nessun mandato</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mandati.map((m) => (
        <div key={m.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold">{m.nome}</h3>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
                <Landmark className="h-3 w-3" /> {m.banca}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onEdit(m)} className="rounded-md p-1.5 hover:bg-secondary">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => onDelete(m.id)} className="rounded-md p-1.5 hover:bg-secondary">
                <Trash2 className="h-4 w-4 text-rose-500" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Prodotti:</span>
            {m.prodotti.map((p) => (
              <span key={p} className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                {p}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Assicurazioni:</span>
            {m.assicurazioni.map((a) => (
              <span key={a} className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                {a}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============== Dialogs ==============
function ProdottoDialog({
  value,
  isNew,
  onClose,
  onSave,
}: {
  value: Prodotto;
  isNew: boolean;
  onClose: () => void;
  onSave: (p: Prodotto) => void;
}) {
  const [v, setV] = useState<Prodotto>(value);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo prodotto" : `Modifica ${value.nome}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Es. Prestito Personale" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <select
              value={v.categoria}
              onChange={(e) => setV({ ...v, categoria: e.target.value as Categoria })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CATEGORIE.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <textarea
              value={v.descrizione ?? ""}
              onChange={(e) => setV({ ...v, descrizione: e.target.value })}
              className="min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.attivo} onChange={(e) => setV({ ...v, attivo: e.target.checked })} />
            Prodotto attivo
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button disabled={!v.nome.trim()} onClick={() => onSave(v)} className="bg-indigo-600 hover:bg-indigo-600/90">
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchedaDialog({
  value,
  onClose,
  onSave,
}: {
  value: Prodotto;
  onClose: () => void;
  onSave: (p: Prodotto) => void;
}) {
  const [v, setV] = useState<Prodotto>(value);
  const [titolo, setTitolo] = useState("");
  const [descr, setDescr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addCar = () => {
    if (!titolo.trim()) return;
    setV({
      ...v,
      caratteristiche: [...v.caratteristiche, { id: crypto.randomUUID(), titolo, descrizione: descr }],
    });
    setTitolo("");
    setDescr("");
  };

  const rmCar = (id: string) =>
    setV({ ...v, caratteristiche: v.caratteristiche.filter((c) => c.id !== id) });

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((f) => ({ id: crypto.randomUUID(), nome: f.name, size: f.size }));
    setV({ ...v, allegati: [...v.allegati, ...next] });
  };

  const rmFile = (id: string) =>
    setV({ ...v, allegati: v.allegati.filter((a) => a.id !== id) });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scheda prodotto · {value.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Caratteristiche */}
          <section>
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Caratteristiche ({v.caratteristiche.length})
            </h4>
            <div className="space-y-2">
              {v.caratteristiche.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-secondary/40 p-3">
                  <div>
                    <div className="text-sm font-semibold">{c.titolo}</div>
                    {c.descrizione && (
                      <div className="text-xs text-muted-foreground">{c.descrizione}</div>
                    )}
                  </div>
                  <button onClick={() => rmCar(c.id)} className="p-1 hover:text-rose-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo caratteristica" />
              <Input value={descr} onChange={(e) => setDescr(e.target.value)} placeholder="Descrizione (facoltativa)" />
              <Button onClick={addCar} disabled={!titolo.trim()}>
                <Plus className="h-4 w-4" /> Aggiungi
              </Button>
            </div>
          </section>

          {/* Allegati */}
          <section>
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Allegati ({v.allegati.length})
            </h4>
            <div className="space-y-2">
              {v.allegati.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/40 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium">{a.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {(a.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button onClick={() => rmFile(a.id)} className="p-1 hover:text-rose-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Carica allegati
              </Button>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Chiudi</Button>
          <Button onClick={() => onSave(v)} className="bg-indigo-600 hover:bg-indigo-600/90">
            Salva scheda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MandatoDialog({
  value,
  isNew,
  prodottiDisponibili,
  onClose,
  onSave,
}: {
  value: Mandato;
  isNew: boolean;
  prodottiDisponibili: string[];
  onClose: () => void;
  onSave: (m: Mandato) => void;
}) {
  const [v, setV] = useState<Mandato>(value);

  const toggle = (field: "prodotti" | "assicurazioni", item: string) => {
    setV((prev) => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  };

  const prodList = Array.from(new Set([...prodottiDisponibili, "Cessione del Quinto", "Delegazione di Pagamento", "Prestito Personale"]));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo mandato banca" : `Modifica ${value.nome}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome mandato *</Label>
              <Input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Es. Capitalfin" />
            </div>
            <div className="space-y-1.5">
              <Label>Banca</Label>
              <select
                value={v.banca}
                onChange={(e) => setV({ ...v, banca: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Seleziona —</option>
                {ALL_BANCHE.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prodotti</Label>
            <div className="flex flex-wrap gap-2">
              {prodList.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggle("prodotti", p)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    v.prodotti.includes(p)
                      ? "border-sky-400 bg-sky-50 text-sky-700"
                      : "border-input text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assicurazioni</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_ASSICURAZIONI.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle("assicurazioni", a)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-semibold",
                    v.assicurazioni.includes(a)
                      ? "border-rose-400 bg-rose-50 text-rose-700"
                      : "border-input text-foreground",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button
            disabled={!v.nome.trim() || !v.banca}
            onClick={() => onSave(v)}
            className="bg-indigo-600 hover:bg-indigo-600/90"
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}