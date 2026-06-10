import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

type Stage = "lead" | "qualificato" | "proposta" | "negoziazione" | "vinto" | "perso";
type Deal = {
  id: string;
  title: string;
  value: number;
  stage: Stage;
  contact_id: string | null;
  expected_close_date: string | null;
  notes: string | null;
};
type Contact = { id: string; full_name: string };

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "lead", label: "Lead", color: "border-t-muted-foreground/40" },
  { key: "qualificato", label: "Qualificato", color: "border-t-primary" },
  { key: "proposta", label: "Proposta", color: "border-t-warning" },
  { key: "negoziazione", label: "Negoziazione", color: "border-t-accent-yellow" },
  { key: "vinto", label: "Vinto", color: "border-t-success" },
  { key: "perso", label: "Perso", color: "border-t-destructive" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function PipelinePage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);

  const load = async () => {
    const [d, c] = await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("contacts").select("id, full_name").order("full_name"),
    ]);
    if (d.error) toast.error(d.error.message);
    else setDeals((d.data ?? []) as Deal[]);
    if (!c.error) setContacts((c.data ?? []) as Contact[]);
  };

  useEffect(() => {
    load();
  }, []);

  const createDeal = async (form: { title: string; value: number; stage: Stage; contact_id: string | null; expected_close_date: string | null; notes: string | null }) => {
    if (!user) return;
    const { error } = await supabase.from("deals").insert({ ...form, user_id: user.id });
    if (error) toast.error(error.message);
    else {
      toast.success("Deal aggiunto");
      setOpen(false);
      load();
    }
  };

  const moveDeal = async (id: string, dir: -1 | 1) => {
    const deal = deals.find((x) => x.id === id);
    if (!deal) return;
    const idx = STAGES.findIndex((s) => s.key === deal.stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    const { error } = await supabase.from("deals").update({ stage: next.key }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteDeal = async (id: string) => {
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const handleDrop = async (stage: Stage) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (!id) return;
    const deal = deals.find((x) => x.id === id);
    if (!deal || deal.stage === stage) return;
    const prev = deals;
    setDeals((curr) => curr.map((d) => (d.id === id ? { ...d, stage } : d)));
    const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setDeals(prev);
    }
  };

  const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.full_name;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Trascina i deal lungo le fasi della trattativa</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo deal</Button>
          </DialogTrigger>
          <DealDialog contacts={contacts} onSubmit={createDeal} />
        </Dialog>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((s) => {
          const items = deals.filter((d) => d.stage === s.key);
          const total = items.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
          const isOver = dragOverStage === s.key;
          return (
            <section
              key={s.key}
              onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== s.key) setDragOverStage(s.key); }}
              onDragLeave={() => { if (dragOverStage === s.key) setDragOverStage(null); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(s.key); }}
              className={`rounded-2xl border border-t-4 bg-card p-4 shadow-sm transition ${s.color} ${isOver ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{s.label}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span>
              </div>
              <div className="mb-3 text-xs text-muted-foreground">{fmt(total)}</div>
              <div className="space-y-2">
                {items.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={(e) => { setDraggingId(d.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                    className={`group cursor-grab rounded-xl border bg-background p-3 active:cursor-grabbing ${draggingId === d.id ? "opacity-50" : ""}`}
                  >
                    <div className="mb-1 line-clamp-2 text-sm font-semibold text-foreground">{d.title}</div>
                    {d.contact_id && (
                      <div className="mb-2 text-xs text-muted-foreground">{contactName(d.contact_id)}</div>
                    )}
                    <div className="mb-2 text-base font-bold text-primary">{fmt(Number(d.value ?? 0))}</div>
                    <div className="flex items-center justify-between gap-1 opacity-60 transition group-hover:opacity-100">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveDeal(d.id, -1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveDeal(d.id, 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteDeal(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DealDialog({ contacts, onSubmit }: { contacts: Contact[]; onSubmit: (d: { title: string; value: number; stage: Stage; contact_id: string | null; expected_close_date: string | null; notes: string | null }) => void }) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("0");
  const [stage, setStage] = useState<Stage>("lead");
  const [contact_id, setContactId] = useState<string>("");
  const [expected_close_date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      value: Number(value) || 0,
      stage,
      contact_id: contact_id || null,
      expected_close_date: expected_close_date || null,
      notes: notes || null,
    });
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Nuovo deal</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>Titolo *</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Valore (€)</Label><Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Fase</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Contatto</Label>
          <Select value={contact_id} onValueChange={setContactId}>
            <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
            <SelectContent>
              {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Data chiusura prevista</Label><Input type="date" value={expected_close_date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-2"><Label>Note</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <DialogFooter><Button type="submit">Salva deal</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}