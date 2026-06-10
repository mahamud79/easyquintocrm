import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Landmark, Pencil, Trash2, Upload, Plus, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePraticheStore } from "@/lib/pratiche-store";
import { bancheStore, useBanche, type Banca as StoredBanca } from "@/lib/banche-store";

export const Route = createFileRoute("/_authenticated/banche")({
  head: () => ({ meta: [{ title: "Banche · LeadValue" }] }),
  component: BanchePage,
});

type Tipologia = "BANCA" | "FINANZIARIA" | "";
type Convenzione = "ATTIVA" | "SOSPESA" | "CHIUSA";

type Banca = {
  id: string;
  nome: string;
  tipologia: Tipologia;
  convenzione: Convenzione;
  clienti: number;
  telefono?: string;
  email?: string;
  referente?: string;
  sitoWeb?: string;
  mailPec?: string;
  citta?: string;
  cap?: string;
  note?: string;
};

const SEED_UNUSED: Banca[] = [
  { id: "1", nome: "ADV FINANCE S.P.A.", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "2", nome: "AGOS", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 7 },
  { id: "3", nome: "ALTRA BANCA", tipologia: "", convenzione: "ATTIVA", clienti: 1 },
  { id: "4", nome: "AVVERA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 9 },
  { id: "5", nome: "BANCA CENTRO EMILIA SPA", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "6", nome: "BANCA DI BOLOGNA", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "7", nome: "BANCA ETICA", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "8", nome: "BANCA GENERALI", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "9", nome: "BANCA POPOLARE PUGLIESE", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "10", nome: "BANCA PROGETTO", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "11", nome: "BANCA SELLA", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "12", nome: "BANCA SISTEMA", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "13", nome: "BANCO DESIO", tipologia: "", convenzione: "ATTIVA", clienti: 0 },
  { id: "14", nome: "BCC", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "15", nome: "BCP", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "16", nome: "BIBANCA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "17", nome: "BNL", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "18", nome: "BNT", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "19", nome: "BPER Banca", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0, mailPec: "bper@pec.gruppobper.it" },
  { id: "20", nome: "BPM", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "21", nome: "CAPITALFIN", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "22", nome: "COFIDIS", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "23", nome: "COMPASS", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 8 },
  { id: "24", nome: "CREDITIS", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "25", nome: "DEUTSCHE BANK S.P.A.", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "26", nome: "DYNAMICA RETAIL", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "27", nome: "FIDES", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "28", nome: "FIDITALIA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0, mailPec: "servizioclienticqs@fiditalia.it" },
  { id: "29", nome: "FIGENPA S.P.A.", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "30", nome: "FINCONTINUO", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "31", nome: "FINDOMESTIC", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 14 },
  { id: "32", nome: "FINECO", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "33", nome: "FINGENPA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "34", nome: "FUCINO", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "35", nome: "IBL BANCA", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "36", nome: "ING DIRECT", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "37", nome: "INTESA SAN PAOLO", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "38", nome: "ITALCREDI", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "39", nome: "MEDIOLANUM", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "40", nome: "MPS", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "41", nome: "PITAGORA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "42", nome: "PRESTITALIA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "43", nome: "PREXTA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "44", nome: "SANTANDER", tipologia: "BANCA", convenzione: "ATTIVA", clienti: 0 },
  { id: "45", nome: "SIGLA CREDIT", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "46", nome: "SPEFIN", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "47", nome: "TIM FIN", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "48", nome: "UNICREDIT", tipologia: "", convenzione: "ATTIVA", clienti: 1 },
  { id: "49", nome: "VIVIBANCA", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
  { id: "50", nome: "YOUNITED", tipologia: "FINANZIARIA", convenzione: "ATTIVA", clienti: 0 },
];

function emptyBanca(): Banca {
  return {
    id: crypto.randomUUID(),
    nome: "",
    tipologia: "BANCA",
    convenzione: "ATTIVA",
    clienti: 0,
  };
}

function TipologiaBadge({ value }: { value: Tipologia }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const styles =
    value === "BANCA"
      ? "bg-sky-100 text-sky-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide", styles)}>
      {value}
    </span>
  );
}

function ConvenzioneBadge({ value }: { value: Convenzione }) {
  const styles: Record<Convenzione, string> = {
    ATTIVA: "bg-emerald-100 text-emerald-700",
    SOSPESA: "bg-amber-100 text-amber-700",
    CHIUSA: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide", styles[value])}>
      {value}
    </span>
  );
}

function BanchePage() {
  const { pratiche } = usePraticheStore();
  const storedItems = useBanche();
  const items = useMemo<Banca[]>(
    () => storedItems.map((b) => ({ ...b, clienti: 0 } as Banca)),
    [storedItems],
  );
  const clientiCountByBanca = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of pratiche) {
      const key = (p.banca ?? "").trim().toLowerCase();
      if (!key) continue;
      const id = p.clienteId || p.cliente?.trim().toLowerCase() || p.id;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(id);
    }
    return map;
  }, [pratiche]);
  const getClientiCount = (nome: string) =>
    clientiCountByBanca.get(nome.trim().toLowerCase())?.size ?? 0;
  const [query, setQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<"" | Tipologia>("");
  const [filterConv, setFilterConv] = useState<"" | Convenzione>("");
  const [editing, setEditing] = useState<Banca | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map((b) => ({ ...b, clienti: getClientiCount(b.nome) }))
      .filter((b) => (filterTipo ? b.tipologia === filterTipo : true))
      .filter((b) => (filterConv ? b.convenzione === filterConv : true))
      .filter((b) =>
        q
          ? [b.nome, b.citta, b.referente, b.email, b.mailPec]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          : true,
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items, query, filterTipo, filterConv, clientiCountByBanca]);

  const openNew = () => {
    setEditing(emptyBanca());
    setIsNew(true);
  };

  const openEdit = (b: Banca) => {
    setEditing({ ...b });
    setIsNew(false);
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast.error("Inserisci il nome della banca");
      return;
    }
    const { clienti: _ignored, ...rest } = editing;
    bancheStore.upsert(rest as StoredBanca);
    toast.success(isNew ? "Banca aggiunta" : "Banca aggiornata");
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    bancheStore.remove(id);
    toast.success("Banca eliminata");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Banche</h1>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {items.length} Banche
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Import non ancora disponibile")}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Aggiungi Banca
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <button className="border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary">
          Tutto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as "" | Tipologia)}
            className="h-9 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm"
          >
            <option value="">Tipologia: Tutto</option>
            <option value="BANCA">Banca</option>
            <option value="FINANZIARIA">Finanziaria</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative">
          <select
            value={filterConv}
            onChange={(e) => setFilterConv(e.target.value as "" | Convenzione)}
            className="h-9 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm"
          >
            <option value="">Convenzione: Tutto</option>
            <option value="ATTIVA">Attiva</option>
            <option value="SOSPESA">Sospesa</option>
            <option value="CHIUSA">Chiusa</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca banca, città, referente..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Nome Banca</TableHead>
              <TableHead className="text-center">Clienti</TableHead>
              <TableHead>Tipologia</TableHead>
              <TableHead>Convenzione</TableHead>
              <TableHead>Mail PEC</TableHead>
              <TableHead>Note / Prodotti</TableHead>
              <TableHead className="w-20 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Nessuna banca trovata
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <input type="checkbox" className="h-4 w-4 rounded border-input" />
                  </TableCell>
                  <TableCell className="font-semibold">{b.nome}</TableCell>
                  <TableCell className="text-center">
                    {b.clienti > 0 ? (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-bold text-violet-700">
                        {b.clienti}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell><TipologiaBadge value={b.tipologia} /></TableCell>
                  <TableCell><ConvenzioneBadge value={b.convenzione} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.mailPec || "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {b.note || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              {isNew ? "Aggiungi Banca" : "Modifica Banca"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome Banca / Istituto *</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  placeholder="Es. BANCA SELLA"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipologia</Label>
                  <select
                    value={editing.tipologia}
                    onChange={(e) => setEditing({ ...editing, tipologia: e.target.value as Tipologia })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="BANCA">BANCA</option>
                    <option value="FINANZIARIA">FINANZIARIA</option>
                    <option value="">—</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stato Convenzione</Label>
                  <select
                    value={editing.convenzione}
                    onChange={(e) => setEditing({ ...editing, convenzione: e.target.value as Convenzione })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="ATTIVA">ATTIVA</option>
                    <option value="SOSPESA">SOSPESA</option>
                    <option value="CHIUSA">CHIUSA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Telefono</Label>
                  <Input
                    value={editing.telefono ?? ""}
                    onChange={(e) => setEditing({ ...editing, telefono: e.target.value })}
                    placeholder="+39 02 1234567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={editing.email ?? ""}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    placeholder="info@banca.it"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Referente</Label>
                  <Input
                    value={editing.referente ?? ""}
                    onChange={(e) => setEditing({ ...editing, referente: e.target.value })}
                    placeholder="Nome referente"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sito Web</Label>
                  <Input
                    value={editing.sitoWeb ?? ""}
                    onChange={(e) => setEditing({ ...editing, sitoWeb: e.target.value })}
                    placeholder="https://www.banca.it"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Mail PEC</Label>
                <Input
                  value={editing.mailPec ?? ""}
                  onChange={(e) => setEditing({ ...editing, mailPec: e.target.value })}
                  placeholder="pec@banca.it"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Città</Label>
                  <Input
                    value={editing.citta ?? ""}
                    onChange={(e) => setEditing({ ...editing, citta: e.target.value })}
                    placeholder="Milano"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CAP</Label>
                  <Input
                    value={editing.cap ?? ""}
                    onChange={(e) => setEditing({ ...editing, cap: e.target.value })}
                    placeholder="20100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Note operative</Label>
                <Textarea
                  rows={3}
                  value={editing.note ?? ""}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                  placeholder="Note, condizioni speciali, contatti..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={handleSave}>{isNew ? "Aggiungi" : "Aggiorna"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}