import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Plus, Search, Trash2, RotateCcw, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OPTION_LISTS,
  type OptionListKey,
  useOptionList,
  setOptionList,
  resetOptionList,
} from "@/lib/option-lists-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/impostazioni")({
  head: () => ({ meta: [{ title: "Impostazioni · LeadValue" }] }),
  component: ImpostazioniPage,
});

function ImpostazioniPage() {
  const [active, setActive] = useState<OptionListKey>(OPTION_LISTS[0].key);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      OPTION_LISTS.filter(
        (l) =>
          !q.trim() ||
          l.label.toLowerCase().includes(q.toLowerCase()) ||
          l.description.toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  );

  const activeDef = OPTION_LISTS.find((l) => l.key === active)!;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ListChecks className="h-7 w-7 text-violet-500" />
            Impostazioni
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci i menu a tendina del CRM. Aggiungi, modifica o rimuovi le voci utilizzate in tutta l'applicazione.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* List of lists */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Liste configurabili</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca lista…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-2">
            <nav className="flex flex-col">
              {filtered.map((l) => {
                const isActive = l.key === active;
                return (
                  <button
                    key={l.key}
                    onClick={() => setActive(l.key)}
                    className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive ? "bg-violet-50 text-violet-900 font-medium" : "hover:bg-muted"
                    }`}
                  >
                    {l.label}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-3">Nessuna lista trovata.</p>
              )}
            </nav>
          </CardContent>
        </Card>

        {/* Editor */}
        <OptionListEditor key={activeDef.key} listKey={activeDef.key} />
      </div>
    </div>
  );
}

function OptionListEditor({ listKey }: { listKey: OptionListKey }) {
  const def = OPTION_LISTS.find((l) => l.key === listKey)!;
  const items = useOptionList(listKey);
  const [newItem, setNewItem] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filter, setFilter] = useState("");

  const visible = useMemo(
    () =>
      items
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => !filter.trim() || v.toLowerCase().includes(filter.toLowerCase())),
    [items, filter],
  );

  function add() {
    const v = newItem.trim();
    if (!v) return;
    if (items.some((x) => x.toLowerCase() === v.toLowerCase())) {
      toast.error("Questa voce esiste già");
      return;
    }
    setOptionList(listKey, [...items, v]);
    setNewItem("");
    toast.success("Voce aggiunta");
  }

  function remove(index: number) {
    setOptionList(listKey, items.filter((_, i) => i !== index));
    toast.success("Voce rimossa");
  }

  function startEdit(index: number, current: string) {
    setEditIndex(index);
    setEditValue(current);
  }

  function confirmEdit() {
    if (editIndex === null) return;
    const v = editValue.trim();
    if (!v) {
      toast.error("Il valore non può essere vuoto");
      return;
    }
    if (items.some((x, i) => i !== editIndex && x.toLowerCase() === v.toLowerCase())) {
      toast.error("Esiste già una voce con questo nome");
      return;
    }
    const next = items.slice();
    next[editIndex] = v;
    setOptionList(listKey, next);
    setEditIndex(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditIndex(null);
    setEditValue("");
  }

  function reset() {
    if (!confirm(`Ripristinare le voci predefinite di "${def.label}"? Le modifiche andranno perse.`)) return;
    resetOptionList(listKey);
    toast.success("Lista ripristinata ai valori predefiniti");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            {def.label}
            <Badge variant="secondary">{items.length} voci</Badge>
          </CardTitle>
          <CardDescription>{def.description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1" /> Predefiniti
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nuova voce…"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          />
          <Button onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Aggiungi
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtra voci…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="border rounded-md divide-y">
          {visible.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nessuna voce. Aggiungi la prima usando il campo qui sopra.
            </div>
          )}
          {visible.map(({ v, i }) => (
            <div
              key={`${i}-${v}`}
              className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50"
            >
              {editIndex === i ? (
                <>
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmEdit(); }
                      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                    }}
                    className="h-8"
                  />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={confirmEdit}>
                      <Check className="h-4 w-4 text-emerald-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm flex-1">{v}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(i, v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Le modifiche sono salvate localmente e vengono applicate immediatamente ai menu a tendina del CRM.
        </p>
      </CardContent>
    </Card>
  );
}