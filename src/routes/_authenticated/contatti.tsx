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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Mail, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contatti")({
  component: ContattiPage,
});

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: "nuovo" | "qualificato" | "cliente" | "perso";
  source: string | null;
  notes: string | null;
  created_at: string;
};

const statusColors: Record<Contact["status"], string> = {
  nuovo: "bg-primary/15 text-primary border-primary/30",
  qualificato: "bg-warning/15 text-warning border-warning/30",
  cliente: "bg-success/15 text-success border-success/30",
  perso: "bg-muted text-muted-foreground border-border",
};

function ContattiPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setContacts((data ?? []) as Contact[]);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (form: Omit<Contact, "id" | "created_at">) => {
    if (!user) return;
    const { error } = await supabase.from("contacts").insert({ ...form, user_id: user.id });
    if (error) {
      toast.error("Impossibile salvare", { description: error.message });
      return;
    }
    toast.success("Contatto aggiunto");
    setOpen(false);
    load();
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Contatto eliminato");
      load();
    }
  };

  const filtered = contacts.filter((c) => {
    const q = query.toLowerCase();
    return (
      !q ||
      c.full_name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Contatti</h1>
          <p className="text-sm text-muted-foreground">Gestisci i tuoi lead e clienti</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo contatto</Button>
          </DialogTrigger>
          <ContactDialog onSubmit={onCreate} />
        </Dialog>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome, email o azienda…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {contacts.length === 0 ? "Nessun contatto ancora. Aggiungine uno per iniziare." : "Nessun risultato."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <article key={c.id} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-foreground">{c.full_name}</div>
                  {c.company && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{c.company}</span>
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={statusColors[c.status]}>
                  {c.status}
                </Badge>
              </div>
              <div className="space-y-1.5 text-sm">
                {c.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => onDelete(c.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactDialog({ onSubmit }: { onSubmit: (data: Omit<Contact, "id" | "created_at">) => void | Promise<void> }) {
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Contact["status"]>("nuovo");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ full_name, email: email || null, phone: phone || null, company: company || null, source: source || null, notes: notes || null, status });
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Nuovo contatto</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome e cognome *</Label>
          <Input required value={full_name} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label>Telefono</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Azienda</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Stato</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Contact["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nuovo">Nuovo</SelectItem>
                <SelectItem value="qualificato">Qualificato</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="perso">Perso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2"><Label>Fonte</Label><Input placeholder="es. Referral, LinkedIn…" value={source} onChange={(e) => setSource(e.target.value)} /></div>
        <div className="space-y-2"><Label>Note</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <DialogFooter><Button type="submit">Salva contatto</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}