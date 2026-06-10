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

export type ConvChannel = "whatsapp" | "email" | "sms" | "telefono";

export type ConvMessage = {
  id: string;
  from: "me" | "them";
  channel: ConvChannel;
  text: string;
  at: string; // ISO timestamp
};

export type ConvThread = {
  clientId: string;
  name: string;
  initials: string;
  avatarColor: string;
  phone?: string;
  email?: string;
  archived?: boolean;
  messages: ConvMessage[];
};

const PERSIST_KEY = "conversations";
let _threads: ConvThread[] = loadPersisted<ConvThread[]>(PERSIST_KEY, []);

const listeners = new Set<() => void>();
const emit = () => {
  savePersisted(PERSIST_KEY, _threads);
  listeners.forEach((l) => l());
};

type ConvThreadCloud = ConvThread & { id: string };
const toCloud = (t: ConvThread): ConvThreadCloud => ({ ...t, id: t.clientId });

initCloudAuth();
onCloudUser(async (uid) => {
  if (!uid) {
    _threads = [];
    savePersisted(PERSIST_KEY, _threads);
    listeners.forEach((l) => l());
    return;
  }
  const rows = await cloudFetchAll<ConvThreadCloud>("conversazioni");
  if (rows.length === 0 && _threads.length > 0) {
    await cloudBulkUpsert("conversazioni", _threads.map(toCloud));
  } else {
    _threads = rows.map((r) => {
      const d = r.data as ConvThreadCloud;
      return { ...d, clientId: d.clientId ?? r.id };
    });
    savePersisted(PERSIST_KEY, _threads);
    listeners.forEach((l) => l());
  }
});

const syncThread = (clientId: string) => {
  const t = _threads.find((x) => x.clientId === clientId);
  if (t) void cloudUpsert("conversazioni", toCloud(t));
};

const AVATAR_COLORS = [
  "bg-gradient-to-br from-orange-500 to-red-500",
  "bg-gradient-to-br from-blue-500 to-indigo-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-pink-500 to-rose-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-cyan-500 to-blue-600",
  "bg-gradient-to-br from-fuchsia-500 to-pink-600",
];

const initials = (full: string) => {
  const p = full.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
};

export const conversationsStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return _threads;
  },
  ensure(input: {
    clientId: string;
    name: string;
    phone?: string;
    email?: string;
  }): ConvThread {
    const existing = _threads.find((t) => t.clientId === input.clientId);
    if (existing) {
      // keep contact details fresh
      if (
        (input.phone && input.phone !== existing.phone) ||
        (input.email && input.email !== existing.email) ||
        input.name !== existing.name
      ) {
        Object.assign(existing, {
          name: input.name,
          phone: input.phone ?? existing.phone,
          email: input.email ?? existing.email,
        });
        emit();
        syncThread(existing.clientId);
      }
      return existing;
    }
    const created: ConvThread = {
      clientId: input.clientId,
      name: input.name,
      initials: initials(input.name),
      avatarColor: AVATAR_COLORS[hash(input.clientId) % AVATAR_COLORS.length],
      phone: input.phone,
      email: input.email,
      messages: [],
    };
    _threads = [created, ..._threads];
    emit();
    void cloudUpsert("conversazioni", toCloud(created));
    return created;
  },
  appendMessage(
    clientId: string,
    msg: { from: "me" | "them"; channel: ConvChannel; text: string },
  ) {
    const t = _threads.find((x) => x.clientId === clientId);
    if (!t) return;
    t.messages = [
      ...t.messages,
      { id: crypto.randomUUID(), at: new Date().toISOString(), ...msg },
    ];
    // bubble to top
    _threads = [t, ..._threads.filter((x) => x.clientId !== clientId)];
    emit();
    syncThread(clientId);
  },
  toggleArchive(clientId: string) {
    _threads = _threads.map((t) =>
      t.clientId === clientId ? { ...t, archived: !t.archived } : t,
    );
    emit();
    syncThread(clientId);
  },
  remove(clientId: string) {
    _threads = _threads.filter((t) => t.clientId !== clientId);
    emit();
    void cloudDelete("conversazioni", clientId);
  },
};

export function useConversationsStore() {
  const threads = useSyncExternalStore(
    conversationsStore.subscribe,
    conversationsStore.get,
    conversationsStore.get,
  );
  return { threads, ...conversationsStore };
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}