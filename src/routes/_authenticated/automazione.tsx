import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Pencil,
  MessageSquare,
  Mail,
  Bell,
  Clock,
  Tag,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadPersisted, savePersisted } from "@/lib/persist";

// IMPORTATO PER LA FASE 4:
import { PRATICA_STAGES } from "@/lib/pratiche-store";

// Base triggers
type BaseTriggerType =
  | "lead_nuovo"
  | "lead_to_pratica"
  | "pratica_liquidata"
  | "appuntamento_creato"
  | "rinnovo_in_scadenza"
  | "tag_aggiunto";

// Extended trigger type to include dynamic pratiche stages
type TriggerType = BaseTriggerType | `pratica_stage_${string}`;

type ActionType =
  | "invia_whatsapp"
  | "invia_email"
  | "invia_sms"
  | "crea_attivita"
  | "notifica_interna"
  | "assegna_tag";

type Automation = {
  id: string;
  name: string;
  trigger: TriggerType;
  action: ActionType;
  delayMinutes: number;
  message: string;
  active: boolean;
  runs: number;
  createdAt: string;
};

const baseTriggerLabels: Record<BaseTriggerType, string> = {
  lead_nuovo: "Nuovo lead acquisito",
  lead_to_pratica: "Lead spostato in Gestione Pratiche",
  pratica_liquidata: "Pratica liquidata",
  appuntamento_creato: "Appuntamento creato",
  rinnovo_in_scadenza: "Rinnovo in scadenza (30gg)",
  tag_aggiunto: "Tag aggiunto al contatto",
};

const actionLabels: Record<ActionType, { label: string; icon: typeof MessageSquare }> = {
  invia_whatsapp: { label: "Invia WhatsApp", icon: MessageSquare },
  invia_email: { label: "Invia Email", icon: Mail },
  invia_sms: { label: "Invia SMS", icon: MessageSquare },
  crea_attivita: { label: "Crea attività", icon: Clock },
  notifica_interna: { label: "Notifica interna", icon: Bell },
  assegna_tag: { label: "Assegna tag", icon: Tag },
};

const STORE_KEY = "automazioni";
const loadStore = () => loadPersisted<Automation[]>(STORE_KEY, []);
const saveStore = (v: Automation[]) => savePersisted(STORE_KEY, v);

export const Route = createFileRoute("/_authenticated/automazione")({
  head: () => ({ meta: [{ title: "Automazione · LeadValue" }] }),
  component: AutomazionePage,
});

function AutomazionePage() {
  const [items, setItems] = useState<Automation[]>(() => loadStore());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);

  // Helper to get a human-readable label for any trigger (base or dynamic)
  const getTriggerLabel = (trigger: TriggerType) => {
    if (baseTriggerLabels[trigger as BaseTriggerType]) {
      return baseTriggerLabels[trigger as BaseTriggerType];
    }
    if (trigger.startsWith("pratica_stage_")) {
      const stageKey = trigger.replace("pratica_stage_", "");
      const stageName = PRATICA_STAGES.find((s) => s.key === stageKey)?.label;
      return stageName ? `Pratica: ${stageName}` : trigger;
    }
    return trigger;
  };

  const save = (next: Automation[]) => {
    setItems(next);
    saveStore(next);
  };

  const toggle = (id: string) =>
    save(items.map((i) => (i.id === id ? { ...i, active: !i.active } : i)));

  const remove = (id: string) => save(items.filter((i) => i.id !== id));

  const upsert = (a: Automation) => {
    const exists = items.some((i) => i.id === a.id);
    save(exists ? items.map((i) => (i.id === a.id ? a : i)) : [a, ...items]);
  };

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((i) => i.active).length,
      runs: items.reduce((s, i) => s + i.runs, 0),
    }),
    [items],
  );

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (a: Automation) => {
    setEditing(a);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="h-6 w-6 text-amber-500" /> Automazione
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea workflow automatici per gestire lead, pratiche e comunicazioni.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova automazione
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Totale workflow" value={stats.total} />
        <StatCard label="Attivi" value={stats.active} tone="emerald" />
        <StatCard label="Esecuzioni totali" value={stats.runs} tone="sky" />
      </div>

      <Tabs defaultValue="elenco">
        <TabsList>
          <TabsTrigger value="elenco">Elenco</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
        </TabsList>

        <TabsContent value="elenco" className="mt-4 space-y-3">
          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Zap className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nessuna automazione configurata. Creane una per iniziare.
                </p>
                <Button onClick={openNew} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Crea la prima
                </Button>
              </CardContent>
            </Card>
          ) : (
            items.map((a) => {
              const ActionIcon = actionLabels[a.action].icon;
              return (
                <Card key={a.id} className={a.active ? "" : "opacity-60"}>
                  <CardContent className="flex flex-wrap items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{a.name}</h3>
                        <Badge variant={a.active ? "default" : "secondary"}>
                          {a.active ? "Attivo" : "In pausa"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="gap-1">
                          <Play className="h-3 w-3" /> {getTriggerLabel(a.trigger)}
                        </Badge>
                        <ArrowRight className="h-3 w-3" />
                        {a.delayMinutes > 0 && (
                          <>
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" /> dopo {formatDelay(a.delayMinutes)}
                            </Badge>
                            <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                        <Badge variant="outline" className="gap-1">
                          <ActionIcon className="h-3 w-3" /> {actionLabels[a.action].label}
                        </Badge>
                        <span className="ml-auto">{a.runs} esecuzioni</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={a.active} onCheckedChange={() => toggle(a.id)} />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="template" className="mt-4 grid gap-4 md:grid-cols-2">
          {TEMPLATES.map((t) => (
            <Card key={t.name}>
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setEditing({
                      ...emptyAutomation(),
                      ...t.preset,
                    } as Automation);
                    setOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Usa template
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <AutomationDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSave={(a) => {
          upsert(a);
          setOpen(false);
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "sky";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "sky"
        ? "text-sky-600"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function emptyAutomation(): Automation {
  return {
    id: crypto.randomUUID(),
    name: "",
    trigger: "lead_nuovo",
    action: "invia_whatsapp",
    delayMinutes: 0,
    message: "",
    active: true,
    runs: 0,
    createdAt: new Date().toISOString(),
  };
}

function formatDelay(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}g`;
}

const TEMPLATES = [
  {
    name: "Benvenuto nuovo lead",
    description: "Invia un WhatsApp di benvenuto appena un nuovo lead viene acquisito.",
    preset: {
      name: "Benvenuto nuovo lead",
      trigger: "lead_nuovo",
      action: "invia_whatsapp",
      delayMinutes: 0,
      message:
        "Ciao {nome}, grazie per averci contattato! Ti risponderemo al più presto con una proposta personalizzata.",
    },
  },
  {
    name: "Follow-up dopo 24h",
    description: "Manda un promemoria email 24h dopo l'acquisizione del lead.",
    preset: {
      name: "Follow-up dopo 24h",
      trigger: "lead_nuovo",
      action: "invia_email",
      delayMinutes: 1440,
      message: "Ciao {nome}, volevo sapere se hai avuto modo di valutare la nostra proposta.",
    },
  },
  {
    name: "Aggiornamento Pratica Deliberata",
    description: "Notifica il cliente via WhatsApp quando la pratica viene deliberata.",
    preset: {
      name: "Aggiornamento Pratica Deliberata",
      trigger: "pratica_stage_deliberata",
      action: "invia_whatsapp",
      delayMinutes: 0,
      message: "Ottime notizie {nome}! La tua pratica è stata ufficialmente deliberata.",
    },
  },
  {
    name: "Ringraziamento liquidazione",
    description: "WhatsApp di ringraziamento dopo la liquidazione della pratica.",
    preset: {
      name: "Ringraziamento liquidazione",
      trigger: "pratica_liquidata",
      action: "invia_whatsapp",
      delayMinutes: 0,
      message: "Ciao {nome}, la tua pratica è stata liquidata. Grazie per la fiducia!",
    },
  },
];

function AutomationDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Automation | null;
  onSave: (a: Automation) => void;
}) {
  const [draft, setDraft] = useState<Automation>(initial ?? emptyAutomation());

  // reset when dialog opens with new initial
  useMemoReset(open, () => setDraft(initial ?? emptyAutomation()));

  const update = <K extends keyof Automation>(k: K, v: Automation[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifica automazione" : "Nuova automazione"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Es. Benvenuto nuovo lead"
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger (quando)</Label>
            <Select value={draft.trigger} onValueChange={(v) => update("trigger", v as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Eventi Standard</SelectLabel>
                  {Object.entries(baseTriggerLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectGroup>
                
                {/* INIZIO MODIFICA: Menu Stage Pratiche */}
                <SelectGroup>
                  <SelectLabel className="mt-2 border-t pt-2">Stati Gestione Pratiche</SelectLabel>
                  {PRATICA_STAGES.map((stage) => (
                    <SelectItem key={stage.key} value={`pratica_stage_${stage.key}`}>
                      Quando passa a: {stage.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {/* FINE MODIFICA */}

              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Azione</Label>
              <Select
                value={draft.action}
                onValueChange={(v) => update("action", v as ActionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(actionLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ritardo (minuti)</Label>
              <Input
                type="number"
                min={0}
                value={draft.delayMinutes}
                onChange={(e) => update("delayMinutes", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Messaggio / Contenuto</Label>
            <Textarea
              rows={4}
              value={draft.message}
              onChange={(e) => update("message", e.target.value)}
              placeholder="Usa {nome}, {cognome}, {telefono} come variabili."
            />
            <p className="text-xs text-muted-foreground">
              Variabili disponibili: <code>{"{nome}"}</code>, <code>{"{cognome}"}</code>,{" "}
              <code>{"{telefono}"}</code>
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Attivo</div>
              <div className="text-xs text-muted-foreground">
                Disattiva per sospendere l'automazione senza eliminarla.
              </div>
            </div>
            <Switch
              checked={draft.active}
              onCheckedChange={(v) => update("active", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => {
              if (!draft.name.trim()) return;
              onSave(draft);
            }}
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// helper: re-run a setter when `flag` flips to true
function useMemoReset(flag: boolean, fn: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (flag) fn();
  }, [flag]);
}