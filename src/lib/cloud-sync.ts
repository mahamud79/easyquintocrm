import { supabase } from "@/integrations/supabase/client";

export type CloudTable =
  | "clienti"
  | "lead"
  | "pratiche"
  | "banche"
  | "aziende"
  | "compagnie_assicurative"
  | "liquidato"
  | "rinnovi"
  | "preventivi"
  | "calendari_eventi"
  | "conversazioni"
  | "impostazioni";

let currentUserId: string | null = null;
const userListeners = new Set<(uid: string | null) => void>();
let initStarted = false;

export function getCloudUserId(): string | null {
  return currentUserId;
}

export function onCloudUser(cb: (uid: string | null) => void): () => void {
  userListeners.add(cb);
  // fire current state asynchronously so subscribers can finish setup first
  Promise.resolve().then(() => cb(currentUserId));
  return () => {
    userListeners.delete(cb);
  };
}

function notifyUser(uid: string | null) {
  if (uid === currentUserId) return;
  currentUserId = uid;
  userListeners.forEach((cb) => {
    try {
      cb(uid);
    } catch (err) {
      console.error("cloud-sync user listener error", err);
    }
  });
}

export function initCloudAuth(): void {
  if (initStarted || typeof window === "undefined") return;
  initStarted = true;
  supabase.auth.getSession().then(({ data }) => {
    notifyUser(data.session?.user?.id ?? null);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;
    notifyUser(session?.user?.id ?? null);
  });
}

export async function cloudFetchAll<T>(
  table: CloudTable,
): Promise<Array<{ id: string; data: T }>> {
  const uid = currentUserId;
  if (!uid) return [];
  const { data, error } = await supabase
    .from(table)
    .select("id, data")
    .eq("user_id", uid);
  if (error) {
    console.error(`[cloud-sync] fetch ${table}`, error);
    return [];
  }
  return (data ?? []) as Array<{ id: string; data: T }>;
}

export async function cloudUpsert<T extends { id: string }>(
  table: CloudTable,
  item: T,
): Promise<void> {
  const uid = currentUserId;
  if (!uid) return;
  const { error } = await supabase
    .from(table)
    .upsert(
      { id: item.id, user_id: uid, data: item as never },
      { onConflict: "user_id,id" },
    );
  if (error) console.error(`[cloud-sync] upsert ${table}`, error);
}

export async function cloudBulkUpsert<T extends { id: string }>(
  table: CloudTable,
  items: T[],
): Promise<void> {
  const uid = currentUserId;
  if (!uid || items.length === 0) return;
  const rows = items.map((i) => ({
    id: i.id,
    user_id: uid,
    data: i as never,
  }));
  const { error } = await supabase
    .from(table)
    .upsert(rows as never, { onConflict: "user_id,id" });
  if (error) console.error(`[cloud-sync] bulk upsert ${table}`, error);
}

export async function cloudDelete(table: CloudTable, id: string): Promise<void> {
  const uid = currentUserId;
  if (!uid) return;
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("user_id", uid)
    .eq("id", id);
  if (error) console.error(`[cloud-sync] delete ${table}`, error);
}

export async function cloudDeleteMany(
  table: CloudTable,
  ids: string[],
): Promise<void> {
  const uid = currentUserId;
  if (!uid || ids.length === 0) return;
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("user_id", uid)
    .in("id", ids);
  if (error) console.error(`[cloud-sync] delete many ${table}`, error);
}
