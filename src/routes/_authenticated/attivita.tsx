import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Phone, Mail, Users as UsersIcon, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attivita")({
  component: AttivitaPage,
});

type ActType = "chiamata" | "email" | "meeting" | "task";
type Activity = {
  id: string;
  type: ActType;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  contact_id: string | null;
};
type Contact = { id: string; full_name: string };

const typeIcons: Record<ActType, React.ComponentType<{ className?: string }>> = {
  chiamata: Phone,
  email: Mail,
  meeting: UsersIcon,
  task: ListChecks,
};

function AttivitaPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [a, c] = await Promise.all([
      supabase.from("activities").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("contacts").select("id, full_name").order("full_name"),
    ]);
    if (a.error) toast.error(a.error.message);
    else setItems((a.data ?? []) as Activity[]);
    if (!c.error) setContacts((c.data ?? []) as Contact[]);
  };

  useEffect(() => { load(); }, []);

  const create = async (form: Omit<Activity, "id" | "completed">) => {
    if (!user) return;
    const { error } = await supabase.from("activities").insert({ ...form, user_id: user.id });
    if (error) toast.error(error.message);
    else {
      toast.success("Attività creata");
      setOpen(false);
      load();
    }
  };

  const toggle = async (id: string, completed: boolean) => {
    const { error } = await supabase.from("activities").update({ completed }).eq("id", id);
    if (!error) load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (!error) load();
  };

  const pending = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Attività</h1>
          <p className="text-sm text-muted-foreground">Pianifica chiamate, email, meeting e task</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nuova attività</Button>
          </DialogTrigger>
          <ActivityDialog contacts={contacts} onSubmit={create} />
        </Dialog>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Da fare ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Nessuna attività in sospeso.</div>
        ) : (
          <ul className="space-y-2">
            {pending.map((a) => <Row key={a.id} a={a} contacts={contacts} onToggle={toggle} onDelete={del} />)}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Completate ({done.length})</h2>
          <ul className="space-y-2 opacity-60">
            {done.map((a) => <Row key={a.id} a={a} contacts={contacts} onToggle={toggle} onDelete={del} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ a, contacts, onToggle, onDelete }: { a: Activity; contacts: Contact[]; onToggle: (id: string, v: boolean) => void; onDelete: (id: string) => void }) {
  const Icon = typeIcons[a.type];
  const contact = contacts.find((c) => c.id === a.contact_id);
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <Checkbox checked={a.completed} onCheckedChange={(v) => onToggle(a.id, Boolean(v))} className="mt-1" />
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{a.title}</div>
        {a.description && <div className="mt-0.5 text-sm text-muted-foreground">{a.description}</div>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {a.due_date && <span>📅 {new Date(a.due_date).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</span>}
          {contact && <span>👤 {contact.full_name}</span>}
          <span className="capitalize">• {a.type}</span>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(a.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

function ActivityDialog({ contacts, onSubmit }: { contacts: Contact[]; onSubmit: (a: Omit<Activity, "id" | "completed">) => void }) {
  const [type, setType] = useState<ActType>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due_date, setDue] = useState("");
  const [contact_id, setContactId] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type,
      title,
      description: description || null,
      due_date: due_date ? new Date(due_date).toISOString() : null,
      contact_id: contact_id || null,
    });
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Nuova attività</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chiamata">Chiamata</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Scadenza</Label><Input type="datetime-local" value={due_date} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label>Titolo *</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Contatto</Label>
          <Select value={contact_id} onValueChange={setContactId}>
            <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
            <SelectContent>
              {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Descrizione</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <DialogFooter><Button type="submit">Salva</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}