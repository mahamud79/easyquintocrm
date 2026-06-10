import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  MessageSquare,
  Search,
  Phone,
  Mail,
  Smartphone,
  Send,
  Paperclip,
  Archive,
  Star,
  MoreVertical,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  conversationsStore,
  useConversationsStore,
  type ConvChannel,
  formatRelativeDate,
  formatTime,
} from "@/lib/conversations-store";

export const Route = createFileRoute("/_authenticated/conversazioni")({
  head: () => ({ meta: [{ title: "Conversazioni · EasyQuinto" }] }),
  component: ConversazioniPage,
});

const CHANNELS: {
  id: "tutti" | ConvChannel;
  label: string;
  icon: typeof Phone;
  color?: string;
}[] = [
  { id: "tutti", label: "Tutti", icon: MessageSquare },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600" },
  { id: "email", label: "Email", icon: Mail, color: "text-blue-600" },
  { id: "sms", label: "SMS", icon: Smartphone, color: "text-amber-600" },
  { id: "telefono", label: "Telefono", icon: Phone, color: "text-rose-600" },
];

type SubTab = "tutto" | "recenti" | "archiviati";

function ConversazioniPage() {
  const { threads } = useConversationsStore();
  const [channel, setChannel] = useState<"tutti" | ConvChannel>("tutti");
  const [sub, setSub] = useState<SubTab>("tutto");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyChannel, setReplyChannel] = useState<ConvChannel>("whatsapp");

  const counts = useMemo(() => {
    const c: Record<string, number> = { tutti: threads.length };
    for (const t of threads) {
      for (const m of t.messages) c[m.channel] = (c[m.channel] ?? 0) + 1;
    }
    return c;
  }, [threads]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return threads.filter((t) => {
      if (channel !== "tutti" && !t.messages.some((m) => m.channel === channel)) return false;
      if (sub === "archiviati" && !t.archived) return false;
      if (sub !== "archiviati" && t.archived) return false;
      if (sub === "recenti") {
        const last = t.messages.at(-1);
        if (!last) return false;
        const days = (now - new Date(last.at).getTime()) / 86400000;
        if (days > 7) return false;
      }
      if (query) {
        const last = t.messages.at(-1)?.text ?? "";
        if (!`${t.name} ${last}`.toLowerCase().includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [threads, channel, sub, query]);

  const selected = threads.find((t) => t.clientId === selectedId) ?? null;
  const visibleMessages = useMemo(() => {
    if (!selected) return [];
    return channel === "tutti"
      ? selected.messages
      : selected.messages.filter((m) => m.channel === channel);
  }, [selected, channel]);

  const send = () => {
    if (!selected || !draft.trim()) return;
    conversationsStore.appendMessage(selected.clientId, {
      from: "me",
      channel: replyChannel,
      text: draft.trim(),
    });
    setDraft("");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Channel filter bar */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const active = channel === ch.id;
          const count = counts[ch.id] ?? 0;
          return (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              <Icon className={cn("h-4 w-4", !active && ch.color)} />
              <span>{ch.label}</span>
              {count > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <aside className="flex w-full max-w-sm flex-col border-r border-border bg-card">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="text-xl font-bold">Conversazioni</h2>
          </div>

          <div className="mt-3 flex gap-4 border-b border-border px-4 text-sm">
            {(
              [
                ["tutto", "Tutto"],
                ["recenti", "Recenti"],
                ["archiviati", "Archiviati"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSub(id)}
                className={cn(
                  "relative pb-2 font-medium transition-colors",
                  sub === id ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {sub === id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca conversazione..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <div className="font-medium text-foreground">Nessuna conversazione</div>
                <div className="mt-1">
                  Apri la scheda di un cliente e invia un messaggio per iniziare.
                </div>
              </div>
            ) : (
              filtered.map((t) => {
                const last = t.messages.at(-1);
                return (
                  <button
                    key={t.clientId}
                    onClick={() => setSelectedId(t.clientId)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedId === t.clientId && "bg-primary/5",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                        t.avatarColor,
                      )}
                    >
                      {t.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {t.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {last ? formatRelativeDate(last.at) : ""}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {last && (
                          <ChannelIcon
                            channel={last.channel}
                            className="h-3 w-3 text-muted-foreground"
                          />
                        )}
                        <span className="truncate text-xs text-muted-foreground">
                          {last?.text ?? "Nessun messaggio"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Conversation view */}
        <main className="flex flex-1 flex-col bg-muted/20">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Seleziona una conversazione</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Tutte le interazioni (WhatsApp, Email, SMS, telefonate) con i tuoi lead appaiono
                qui automaticamente.
              </p>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white",
                      selected.avatarColor,
                    )}
                  >
                    {selected.initials}
                  </div>
                  <div>
                    <div className="font-semibold">{selected.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {selected.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {selected.phone}
                        </span>
                      )}
                      {selected.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {selected.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => conversationsStore.toggleArchive(selected.clientId)}
                    title={selected.archived ? "Ripristina" : "Archivia"}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
                {visibleMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center pt-10 text-center text-xs text-muted-foreground">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <div className="mt-2 font-medium">Nessun messaggio</div>
                  </div>
                ) : (
                  visibleMessages.map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                          m.from === "me"
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-card text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-1.5 text-[10px]",
                            m.from === "me"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          <ChannelIcon channel={m.channel} className="h-3 w-3" />
                          <span>{formatTime(m.at)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border bg-card px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Rispondi via:</span>
                  {(["whatsapp", "email", "sms", "telefono"] as ConvChannel[]).map((c) => {
                    const meta = CHANNELS.find((x) => x.id === c)!;
                    const Icon = meta.icon;
                    const active = replyChannel === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setReplyChannel(c)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        <Icon className={cn("h-3 w-3", !active && meta.color)} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-end gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={`Scrivi un messaggio ${replyChannel}...`}
                    className="flex-1"
                  />
                  <Button onClick={send} disabled={!draft.trim()} className="gap-1">
                    <Send className="h-4 w-4" /> Invia
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Details panel */}
        <aside className="hidden w-72 flex-col border-l border-border bg-card xl:flex">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Seleziona una conversazione per vedere i dettagli
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white",
                    selected.avatarColor,
                  )}
                >
                  {selected.initials}
                </div>
                <div className="mt-3 font-semibold">{selected.name}</div>
              </div>
              <div className="space-y-3 text-sm">
                {selected.phone && (
                  <a
                    href={`tel:${selected.phone}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="h-4 w-4" /> {selected.phone}
                  </a>
                )}
                {selected.email && (
                  <a
                    href={`mailto:${selected.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="h-4 w-4" /> {selected.email}
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/clienti/$id" params={{ id: selected.clientId }}>
                    Apri scheda cliente
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ChannelIcon({
  channel,
  className,
}: {
  channel: ConvChannel;
  className?: string;
}) {
  const map: Record<ConvChannel, typeof Phone> = {
    whatsapp: MessageCircle,
    email: Mail,
    sms: Smartphone,
    telefono: Phone,
  };
  const Icon = map[channel];
  return <Icon className={className} />;
}