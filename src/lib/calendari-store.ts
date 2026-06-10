import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "./persist";
import {
  cloudBulkUpsert,
  cloudDelete,
  cloudFetchAll,
  cloudUpsert,
  initCloudAuth,
  onCloudUser,
} from "./cloud-sync";

export type EventStatus = "in_attesa" | "fatto" | "perso" | "rimandato";

export type CalendarKey = "principale" | "appuntamenti" | "scadenze";

export const CALENDAR_META: Record<CalendarKey, { label: string; color: CalEvent["color"]; swatch: string }> = {
  principale: { label: "Principale", color: "blue", swatch: "bg-sky-500" },
  appuntamenti: { label: "Appuntamenti", color: "emerald", swatch: "bg-emerald-500" },
  scadenze: { label: "Scadenze", color: "rose", swatch: "bg-rose-500" },
};

export type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  contact?: string;
  color: "blue" | "amber" | "emerald" | "rose" | "violet";
  status: EventStatus;
  allDay?: boolean;
  calendar: CalendarKey;
};

const PERSIST_KEY = "calendari";
const reviveEvents = (raw: unknown): CalEvent[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e: any) => !/^[1-7]$/.test(String(e?.id))).map((e: any) => ({
    ...e,
    start: new Date(e.start),
    end: new Date(e.end),
  }));
};
let state: { events: CalEvent[] } = {
  events: loadPersisted<CalEvent[]>(PERSIST_KEY, [], reviveEvents),
};
savePersisted(PERSIST_KEY, state.events);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;
const emit = () => {
  savePersisted(PERSIST_KEY, state.events);
  listeners.forEach((l) => l());
};

type CalEventCloud = Omit<CalEvent, "start" | "end"> & { start: string; end: string };

const toCloud = (e: CalEvent): CalEventCloud => ({
  ...e,
  start: e.start.toISOString(),
  end: e.end.toISOString(),
});

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    state = { events: [] };
    savePersisted(PERSIST_KEY, state.events);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<CalEventCloud>("calendari_eventi");
  if (rows.length === 0 && state.events.length > 0) {
    await cloudBulkUpsert("calendari_eventi", state.events.map(toCloud));
  } else {
    state = {
      events: rows.map((r) => ({
        ...(r.data as CalEventCloud),
        id: r.id,
        start: new Date(r.data.start),
        end: new Date(r.data.end),
      })),
    };
    savePersisted(PERSIST_KEY, state.events);
    listeners.forEach((l) => l());
  }
});

export function addEvent(ev: CalEvent) {
  state = { events: [...state.events, ev] };
  emit();
  void cloudUpsert("calendari_eventi", toCloud(ev));
}

export function updateEvent(id: string, patch: Partial<CalEvent>) {
  state = { events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
  emit();
  const updated = state.events.find((e) => e.id === id);
  if (updated) void cloudUpsert("calendari_eventi", toCloud(updated));
}

export function deleteEvent(id: string) {
  state = { events: state.events.filter((e) => e.id !== id) };
  emit();
  void cloudDelete("calendari_eventi", id);
}

export function setEvents(events: CalEvent[]) {
  state = { events };
  emit();
  void cloudBulkUpsert("calendari_eventi", events.map(toCloud));
}

export function useCalendariStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    events: snap.events,
    addEvent,
    updateEvent,
    deleteEvent,
    setEvents,
    pendingCount: snap.events.filter((e) => e.status === "in_attesa").length,
    eventCount: snap.events.length,
  };
}
