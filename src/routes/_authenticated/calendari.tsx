import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchPlacesAutocomplete } from "@/lib/places.functions";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  X,
  Pencil,
  Clock,
  MapPin,
  AlignLeft,
  User as UserIcon,
  Check,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCalendariStore,
  type CalEvent,
  type EventStatus,
} from "@/lib/calendari-store";

export const Route = createFileRoute("/_authenticated/calendari")({
  head: () => ({ meta: [{ title: "Calendari · EasyQuinto" }] }),
  component: CalendariPage,
});

const COLOR_MAP: Record<
  CalEvent["color"],
  { bg: string; border: string; text: string; dot: string }
> = {
  blue: { bg: "bg-sky-100", border: "border-sky-400", text: "text-sky-900", dot: "bg-sky-500" },
  amber: {
    bg: "bg-amber-100",
    border: "border-amber-400",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  emerald: {
    bg: "bg-emerald-100",
    border: "border-emerald-400",
    text: "text-emerald-900",
    dot: "bg-emerald-500",
  },
  rose: { bg: "bg-rose-100", border: "border-rose-400", text: "text-rose-900", dot: "bg-rose-500" },
  violet: {
    bg: "bg-violet-100",
    border: "border-violet-400",
    text: "text-violet-900",
    dot: "bg-violet-500",
  },
};

type ViewMode = "giorno" | "settimana" | "mese";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 - 20:00
const ROW_PX = 56;
const DAYS_LABELS = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];
const MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // monday = 0
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDateTime(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi);
}

function CalendariPage() {
  const { events, updateEvent, deleteEvent, addEvent } = useCalendariStore();
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [view, setView] = useState<ViewMode>("settimana");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return events.filter((e) => {
      if (onlyOverdue && !(e.end < now && e.status === "in_attesa")) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.contact?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
      );
    });
  }, [events, search, onlyOverdue]);

  const overdue = useMemo(() => {
    const now = new Date();
    return events.filter((e) => e.end < now && e.status === "in_attesa").length;
  }, [events]);

  const selected = events.find((e) => e.id === selectedId) || null;
  const editing = events.find((e) => e.id === editingId) || null;

  const removeEvent = (id: string) => {
    deleteEvent(id);
    setSelectedId(null);
    setEditingId(null);
  };
  const shiftEvent = (id: string, ms: number) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    updateEvent(id, {
      start: new Date(ev.start.getTime() + ms),
      end: new Date(ev.end.getTime() + ms),
    });
  };

  const headerLabel =
    view === "mese"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getFullYear()}`;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-3">
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Crea
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          Oggi
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAnchor(addDays(anchor, view === "mese" ? -30 : -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAnchor(addDays(anchor, view === "mese" ? 30 : 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold capitalize">{headerLabel}</h2>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={syncing}
            onClick={() => {
              setSyncing(true);
              setTimeout(() => {
                setSyncing(false);
                setLastSync(new Date());
                toast.success("Calendari sincronizzati", {
                  description: `${events.length} eventi aggiornati`,
                });
              }, 900);
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Sync…" : lastSync ? `Sync ${lastSync.getHours().toString().padStart(2, "0")}:${lastSync.getMinutes().toString().padStart(2, "0")}` : "Sync"}
          </Button>
          <Badge
            variant={onlyOverdue ? "destructive" : "outline"}
            className="cursor-pointer gap-1 select-none"
            onClick={() => {
              const next = !onlyOverdue;
              setOnlyOverdue(next);
              if (next) {
                const now = new Date();
                const overdueEvents = events
                  .filter((e) => e.end < now && e.status === "in_attesa")
                  .sort((a, b) => b.end.getTime() - a.end.getTime());
                if (overdueEvents.length > 0) {
                  setAnchor(overdueEvents[0].start);
                  setView("mese");
                }
              }
            }}
          >
            Scaduti ({overdue})
          </Badge>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca evento…"
              className="h-8 w-40 pl-7 text-sm"
            />
          </div>
          <div className="flex rounded-md border bg-muted p-0.5">
            {(["giorno", "settimana", "mese"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar mini */}
        <aside className="hidden w-60 shrink-0 border-r bg-card/40 p-4 lg:block">
          <MiniMonth anchor={anchor} onPick={(d) => setAnchor(d)} events={filtered} />
        </aside>

        {/* Calendar surface */}
        <div className="flex-1 overflow-auto">
          {view === "mese" ? (
            <MonthGrid anchor={anchor} events={filtered} onSelect={setSelectedId} />
          ) : (
            <WeekGrid
              days={view === "giorno" ? [anchor] : weekDays}
              events={filtered}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          )}
        </div>
      </div>

      {/* Event popover (rendered as centered floating card) */}
      {selected && !editingId && (
        <EventPopover
          event={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditingId(selected.id)}
          onShift={(ms) => shiftEvent(selected.id, ms)}
          onStatus={(status) => {
            updateEvent(selected.id, { status });
            setSelectedId(null);
          }}
          onDelete={() => removeEvent(selected.id)}
        />
      )}

      {/* Edit / Create modal */}
      {(editing || creating) && (
        <EventEditor
          initial={editing ?? undefined}
          defaultDate={anchor}
          onClose={() => {
            setEditingId(null);
            setCreating(false);
          }}
          onSave={(payload) => {
            if (editing) {
              updateEvent(editing.id, payload);
            } else {
              const id = String(Date.now());
              addEvent({
                id,
                color: "blue",
                status: "in_attesa",
                calendar: "principale",
                ...payload,
              } as CalEvent);
            }
            setEditingId(null);
            setCreating(false);
          }}
          onDelete={editing ? () => removeEvent(editing.id) : undefined}
        />
      )}
    </div>
  );
}

/* ---------------- Week / Day grid ---------------- */

function WeekGrid({
  days,
  events,
  onSelect,
  selectedId,
}: {
  days: Date[];
  events: CalEvent[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const today = new Date();
  const { updateEvent } = useCalendariStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const handleDrop = (targetDay: Date, dropY: number) => {
    if (!dragId) return;
    const ev = events.find((e) => e.id === dragId);
    if (ev) {
      const duration = ev.end.getTime() - ev.start.getTime();
      const gridStartMin = HOURS[0] * 60;
      const gridEndMin = (HOURS[HOURS.length - 1] + 1) * 60;
      // dropY is mouse Y relative to column; subtract grab offset so event keeps its position under cursor
      const yWithinGrid = Math.max(0, dropY - dragOffsetY);
      const rawMin = gridStartMin + (yWithinGrid / ROW_PX) * 60;
      // Snap to 15 minutes
      let snapped = Math.round(rawMin / 15) * 15;
      const durMin = duration / 60000;
      snapped = Math.max(gridStartMin, Math.min(snapped, gridEndMin - durMin));
      const newStart = new Date(targetDay);
      newStart.setHours(0, 0, 0, 0);
      newStart.setMinutes(snapped);
      updateEvent(ev.id, {
        start: newStart,
        end: new Date(newStart.getTime() + duration),
      });
    }
    setDragId(null);
    setDragOverDay(null);
  };

  return (
    <div className="min-w-[800px]">
      {/* Day header */}
      <div
        className="sticky top-0 z-10 grid border-b bg-card"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
      >
        <div className="border-r p-2 text-[10px] font-medium uppercase text-muted-foreground">
          tutto il giorno
        </div>
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} className="border-r p-2 text-center">
              <div className="text-[10px] font-medium uppercase text-muted-foreground">
                {DAYS_LABELS[(d.getDay() + 6) % 7]}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
      >
        {/* Hour labels column */}
        <div className="border-r">
          {HOURS.map((h) => (
            <div key={h} style={{ height: ROW_PX }} className="relative border-b">
              <span className="absolute -top-2 right-1.5 text-[10px] text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
        {days.map((day, di) => {
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          // include events that overlap this day, not just those that start on it
          const dayEvents = events.filter(
            (e) => e.start < dayEnd && e.end > dayStart,
          );
          return (
            <div
              key={di}
              className={cn(
                "relative border-r transition-colors",
                dragOverDay === di && "bg-primary/5",
              )}
              onDragOver={(e) => {
                if (dragId) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverDay !== di) setDragOverDay(di);
                }
              }}
              onDragLeave={() => {
                if (dragOverDay === di) setDragOverDay(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                handleDrop(day, e.clientY - rect.top);
              }}
            >
              {HOURS.map((h) => (
                <div key={h} style={{ height: ROW_PX }} className="border-b" />
              ))}
              {dayEvents.map((ev) => {
                // Clamp event to this day's window so multi-day events
                // render correctly on each day they span.
                const segStart = ev.start < dayStart ? dayStart : ev.start;
                const segEnd = ev.end > dayEnd ? dayEnd : ev.end;
                const startMin =
                  segStart.getHours() * 60 + segStart.getMinutes();
                // If the segment ends at midnight of the next day, treat as 24:00
                const endMin =
                  segEnd.getTime() === dayEnd.getTime()
                    ? 24 * 60
                    : segEnd.getHours() * 60 + segEnd.getMinutes();
                const gridStartMin = HOURS[0] * 60;
                const gridEndMin = (HOURS[HOURS.length - 1] + 1) * 60;
                const clampedStart = Math.max(startMin, gridStartMin);
                const clampedEnd = Math.min(endMin, gridEndMin);
                if (clampedEnd <= clampedStart) return null;
                const top = ((clampedStart - gridStartMin) / 60) * ROW_PX;
                const height = Math.max(((clampedEnd - clampedStart) / 60) * ROW_PX - 2, 22);
                const c = COLOR_MAP[ev.color];
                const isSelected = selectedId === ev.id;
                const done = ev.status === "fatto";
                return (
                  <button
                    key={ev.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(ev.id);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDragOffsetY(e.clientY - rect.top);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", ev.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverDay(null);
                    }}
                    onClick={() => onSelect(ev.id)}
                    style={{ top: top + 1, height }}
                    className={cn(
                      "absolute left-1 right-1 cursor-grab overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm transition-all hover:shadow-md active:cursor-grabbing",
                      c.bg,
                      c.border,
                      c.text,
                      isSelected && "ring-2 ring-primary ring-offset-1",
                      done && "opacity-60 line-through",
                      dragId === ev.id && "opacity-50",
                    )}
                  >
                    <div className="truncate font-semibold">{ev.title}</div>
                    <div className="truncate text-[10px] opacity-80">
                      {fmtTime(ev.start)} – {fmtTime(ev.end)}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Month grid ---------------- */

function MonthGrid({
  anchor,
  events,
  onSelect,
}: {
  anchor: Date;
  events: CalEvent[];
  onSelect: (id: string) => void;
}) {
  const { updateEvent } = useCalendariStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  const handleDrop = (targetDay: Date) => {
    if (!dragId) return;
    const ev = events.find((e) => e.id === dragId);
    if (ev) {
      const duration = ev.end.getTime() - ev.start.getTime();
      const newStart = new Date(targetDay);
      newStart.setHours(ev.start.getHours(), ev.start.getMinutes(), 0, 0);
      updateEvent(ev.id, {
        start: newStart,
        end: new Date(newStart.getTime() + duration),
      });
    }
    setDragId(null);
    setDragOverIndex(null);
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <div className="grid grid-cols-7 border-b bg-card">
        {DAYS_LABELS.map((d) => (
          <div
            key={d}
            className="border-r p-2 text-center text-[10px] font-medium uppercase text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((d, i) => {
          const isCurrent = d.getMonth() === anchor.getMonth();
          const isToday = sameDay(d, today);
          const dayEvents = events.filter((e) => sameDay(e.start, d));
          return (
            <div
              key={i}
              className={cn(
                "min-h-[96px] border-b border-r p-1.5 transition-colors",
                !isCurrent && "bg-muted/30",
                dragOverIndex === i && "bg-primary/10 ring-1 ring-inset ring-primary/30",
              )}
              onDragOver={(e) => {
                if (dragId) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverIndex !== i) setDragOverIndex(i);
                }
              }}
              onDragLeave={() => {
                if (dragOverIndex === i) setDragOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(d);
              }}
            >
              <div
                className={cn(
                  "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday && "bg-primary text-primary-foreground",
                  !isCurrent && !isToday && "text-muted-foreground",
                )}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => {
                  const c = COLOR_MAP[ev.color];
                  return (
                    <button
                      key={ev.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(ev.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", ev.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOverIndex(null);
                      }}
                      onClick={() => onSelect(ev.id)}
                      className={cn(
                        "flex w-full cursor-grab items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium active:cursor-grabbing",
                        c.bg,
                        c.text,
                        dragId === ev.id && "opacity-50",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.dot)} />
                      <span className="truncate">
                        {fmtTime(ev.start)} {ev.title}
                      </span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="px-1.5 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} altri
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Mini month ---------------- */

function MiniMonth({
  anchor,
  onPick,
  events,
}: {
  anchor: Date;
  onPick: (d: Date) => void;
  events: CalEvent[];
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  return (
    <div>
      <p className="mb-2 text-center text-xs font-semibold capitalize">
        {MONTHS[anchor.getMonth()].slice(0, 3)} {anchor.getFullYear()}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
          <div key={i} className="py-0.5">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const isCurrent = d.getMonth() === anchor.getMonth();
          const isAnchor = sameDay(d, anchor);
          const isToday = sameDay(d, today);
          const hasEv = events.some((e) => sameDay(e.start, d));
          return (
            <button
              key={i}
              onClick={() => onPick(d)}
              className={cn(
                "relative flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition-colors",
                !isCurrent && "text-muted-foreground/40",
                isAnchor && "bg-primary text-primary-foreground font-semibold",
                !isAnchor && isToday && "border border-primary text-primary",
                !isAnchor && !isToday && "hover:bg-muted",
              )}
            >
              {d.getDate()}
              {hasEv && !isAnchor && (
                <span className="absolute bottom-0.5 h-0.5 w-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Event popover ---------------- */

function EventPopover({
  event,
  onClose,
  onEdit,
  onShift,
  onStatus,
  onDelete,
}: {
  event: CalEvent;
  onClose: () => void;
  onEdit: () => void;
  onShift: (ms: number) => void;
  onStatus: (s: EventStatus) => void;
  onDelete: () => void;
}) {
  const dateStr = `${["dom", "lun", "mar", "mer", "gio", "ven", "sab"][event.start.getDay()]} ${event.start.getDate()} ${MONTHS[event.start.getMonth()].slice(0, 3)}, ${fmtTime(event.start)} – ${fmtTime(event.end)}`;
  const statusLabel: Record<EventStatus, string> = {
    in_attesa: "in attesa",
    fatto: "fatto",
    perso: "perso",
    rimandato: "rimandato",
  };
  const statusColor: Record<EventStatus, string> = {
    in_attesa: "bg-sky-100 text-sky-700",
    fatto: "bg-emerald-100 text-emerald-700",
    perso: "bg-rose-100 text-rose-700",
    rimandato: "bg-amber-100 text-amber-700",
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{event.title}</h3>
            <span
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                statusColor[event.status],
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {statusLabel[event.status]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />{" "}
            <span className="capitalize text-foreground">{dateStr}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />{" "}
              <span className="text-foreground">{event.location}</span>
            </div>
          )}
          {event.description && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <AlignLeft className="mt-0.5 h-4 w-4" />{" "}
              <span className="text-foreground">{event.description}</span>
            </div>
          )}
          {event.contact && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="h-4 w-4" />{" "}
              <span className="font-medium text-foreground">{event.contact}</span>
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sposta appuntamento
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onShift(2 * 3600_000)}
            >
              +2 ore
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onShift(24 * 3600_000)}
            >
              Domani
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onShift(2 * 24 * 3600_000)}
            >
              +2 giorni
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onShift(7 * 24 * 3600_000)}
            >
              +1 sett.
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Esito appuntamento
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onStatus("fatto")}
              className="flex flex-col items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <Check className="h-4 w-4" /> Fatto
            </button>
            <button
              onClick={() => onStatus("perso")}
              className="flex flex-col items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              <X className="h-4 w-4" /> Perso
            </button>
            <button
              onClick={() => onStatus("rimandato")}
              className="flex flex-col items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              <RotateCcw className="h-4 w-4" /> Rimanda
            </button>
          </div>
        </div>

        <Button variant="destructive" className="mt-4 w-full gap-1.5" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Elimina evento
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Event editor ---------------- */

function EventEditor({
  initial,
  defaultDate,
  onClose,
  onSave,
  onDelete,
}: {
  initial?: CalEvent;
  defaultDate: Date;
  onClose: () => void;
  onSave: (payload: Partial<CalEvent> & { title: string; start: Date; end: Date }) => void;
  onDelete?: () => void;
}) {
  const base = initial ?? {
    title: "",
    start: (() => {
      const d = new Date(defaultDate);
      d.setHours(9, 0, 0, 0);
      return d;
    })(),
    end: (() => {
      const d = new Date(defaultDate);
      d.setHours(10, 0, 0, 0);
      return d;
    })(),
    location: "",
    description: "",
    allDay: false,
    color: "blue" as const,
  };
  const [title, setTitle] = useState(base.title);
  const [allDay, setAllDay] = useState(!!base.allDay);
  const [startDate, setStartDate] = useState(fmtDateInput(base.start));
  const [startTime, setStartTime] = useState(fmtTime(base.start));
  const [endDate, setEndDate] = useState(fmtDateInput(base.end));
  const [endTime, setEndTime] = useState(fmtTime(base.end));
  const [location, setLocation] = useState(base.location ?? "");
  const [description, setDescription] = useState(base.description ?? "");

  const handleSave = () => {
    if (!title.trim()) return;
    const start = allDay ? parseDateTime(startDate, "00:00") : parseDateTime(startDate, startTime);
    const end = allDay ? parseDateTime(endDate, "23:59") : parseDateTime(endDate, endTime);
    onSave({
      title: title.trim(),
      start,
      end,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      allDay,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifica Evento" : "Nuovo Evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo evento"
            className="border-0 border-b text-lg font-semibold shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center gap-2">
            <Switch checked={allDay} onCheckedChange={setAllDay} id="allday" />
            <label htmlFor="allday" className="text-sm">
              Tutto il giorno
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Inizio</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mb-2"
              />
              {!allDay && (
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Fine</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mb-2"
              />
              {!allDay && (
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <LocationAutocomplete value={location} onChange={setLocation} />
          </div>

          <div className="flex items-start gap-2">
            <AlignLeft className="mt-2 h-4 w-4 text-muted-foreground" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrizione"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {onDelete && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Elimina
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Indietro
          </Button>
          <Button onClick={handleSave} className="gap-1.5">
            <Check className="h-4 w-4" /> Salva modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PlaceSuggestion = { display_name: string; place_id: string };

function LocationAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skipRef = useRef(false);
  const reqIdRef = useRef(0);
  const fetchPlaces = useServerFn(searchPlacesAutocomplete);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      const myId = ++reqIdRef.current;
      setLoading(true);
      try {
        const result = await fetchPlaces({ data: { query: q } });
        if (myId !== reqIdRef.current) return;
        const data: PlaceSuggestion[] = (result?.suggestions ?? []).map((s) => ({
          place_id: s.id,
          display_name: s.text,
        }));
        setSuggestions(data);
        setOpen(true);
      } catch (e) {
        if (myId === reqIdRef.current) setSuggestions([]);
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative flex-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Luogo (digita via, città...)"
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-md">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Ricerca...</div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                skipRef.current = true;
                onChange(s.display_name);
                setOpen(false);
                setSuggestions([]);
              }}
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
