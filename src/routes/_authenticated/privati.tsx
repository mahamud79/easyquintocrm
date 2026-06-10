import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Phone,
  Mail,
  Search,
  Calendar,
  Pencil,
  ExternalLink,
  XCircle,
  Clock,
  Trash2,
  Briefcase,
  Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clientiStore, useClientiStore } from "@/lib/clienti-store";
import { useLeadsStore, type Lead } from "@/lib/leads-store";
import { useLiquidatoStore } from "@/lib/liquidato-store";
import { usePraticheStore, PRATICA_STAGES } from "@/lib/pratiche-store";
import { computeMagazzinoRow, fmtDate } from "@/lib/magazzino-utils";

export const Route = createFileRoute("/_authenticated/privati")({
  head: () => ({ meta: [{ title: "Privati · Rubrica clienti" }] }),
  component: PrivatiPage,
});

type TabKey = "acquisiti" | "completati" | "persi" | "rivalutare";

function PrivatiPage() {
  const [tab, setTab] = useState<TabKey>("acquisiti");
  const [query, setQuery] = useState("");
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const navigate = useNavigate();

  const { clienti } = useClientiStore();
  const { leads, updateLead, deleteLead } = useLeadsStore();
  const { rows: liquidati } = useLiquidatoStore();
  const { pratiche } = usePraticheStore();

  const handleDeleteDefinitivo = (row: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    lead?: Lead;
  }) => {
    const ok = window.confirm(
      `Eliminare definitivamente "${row.name}"?\n\nVerranno rimossi il lead e la relativa scheda cliente. L'operazione non è reversibile.`,
    );
    if (!ok) return;
    if (row.lead) deleteLead(row.lead.id);
    else if (!row.id.startsWith("pratica-")) deleteLead(row.id);
    clientiStore.removeByContact({
      id: row.id.startsWith("pratica-") ? null : row.id,
      name: row.name,
      phone: row.phone ?? null,
      email: row.email ?? null,
    });
  };

  const clienteByName = useMemo(
    () => new Map(clienti.map((c) => [c.name.toLowerCase(), c])),
    [clienti],
  );

  // 1) Acquisiti = Clienti con Pratiche Attive (non respinte, non liquidate)
  const acquisiti = useMemo(() => {
    return pratiche
      .filter((p) => p.stage !== "liquidata" && p.stage !== "respinta" && p.stage !== "passate")
      .map((p) => {
        const cliente =
          (p.clienteId && clienti.find((c) => c.id === p.clienteId)) ||
          clienteByName.get(p.cliente.toLowerCase());
        return {
          id: `pratica-${p.id}`,
          clienteId: p.clienteId ?? cliente?.id ?? null,
          name: p.cliente,
          phone: p.telefono ?? cliente?.phone ?? null,
          email: cliente?.email ?? null,
          prodotto: p.prodotto,
          banca: p.banca ?? "—",
          stageLabel: PRATICA_STAGES.find((s) => s.key === p.stage)?.label ?? p.stage,
        };
      });
  }, [pratiche, clienti, clienteByName]);

  // 2) Completati/Finanziati = Leggono dal liquidato store
  const completati = useMemo(() => {
    return liquidati
      .filter((r) => r.nome !== "—" || r.cognome !== "—")
      .map((r) => {
        const fullName = `${r.nome} ${r.cognome}`.trim();
        const cliente = clienteByName.get(fullName.toLowerCase());
        const mag = computeMagazzinoRow(r, cliente?.phone ?? null);
        return {
          id: r.id,
          name: fullName,
          phone: cliente?.phone ?? null,
          email: cliente?.email ?? null,
          birthDate: cliente?.birthDate ?? null,
          decorrenza: mag.decorrenza,
          banca: r.banca,
          prodotto: r.prodotto,
          operazione: `${r.prodotto}${r.banca ? ` · ${r.banca}` : ""}`,
          dataLiq: r.dataLiq,
          rateResidue: mag.rateResidue,
          capitaleResiduo: mag.capitaleResiduo,
          dataRinnovabilita: mag.dataRinnovabilita,
          clienteId: cliente?.id ?? null,
        };
      });
  }, [liquidati, clienteByName]);

  // 3) Clienti persi = stage "persa" + pratiche "respinta"
  const persi = useMemo(() => {
    const fromLeads = leads
      .filter((l) => (l.stage === "persa" || l.stage === "non_fattibili") && !l.rivalutaIl)
      .map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        motivoPersa: l.motivoPersa ?? (l.stage === "non_fattibili" ? "Non fattibile" : ""),
        createdLabel: l.createdLabel,
        lead: l as Lead | undefined,
      }));
    const leadIds = new Set(fromLeads.map((r) => r.id));
    const fromPratiche = pratiche
      .filter((p) => p.stage === "respinta")
      .filter((p) => !p.clienteId || !leadIds.has(p.clienteId))
      .map((p) => {
        const cliente =
          (p.clienteId && clienti.find((c) => c.id === p.clienteId)) ||
          clienteByName.get(p.cliente.toLowerCase());
        return {
          id: `pratica-${p.id}`,
          name: p.cliente,
          phone: p.telefono ?? cliente?.phone ?? null,
          email: cliente?.email ?? null,
          motivoPersa: p.note || "Pratica respinta",
          createdLabel: "—",
          lead: undefined as Lead | undefined,
        };
      });
    return [...fromLeads, ...fromPratiche];
  }, [leads, pratiche, clienti, clienteByName]);

  // 4) Da Ricontattare = Leads con data rivalutazione
  const daRivalutare = useMemo(
    () =>
      leads
        .filter((l) => !!l.rivalutaIl || l.stage === "appuntamento_futuro")
        .sort((a, b) => (a.rivalutaIl! < b.rivalutaIl! ? -1 : 1)),
    [leads],
  );

  const q = query.trim().toLowerCase();
  const matchesQ = (s: string | null | undefined) => !q || (s ?? "").toLowerCase().includes(q);

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Privati</h1>
          <p className="text-xs text-muted-foreground">
            Gestione clienti per categorie acquisizione e rinnovi.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca nome, telefono, mail…"
            className="h-9 w-72 pl-8 text-sm"
          />
        </div>
      </header>

      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabBtn
          active={tab === "acquisiti"}
          onClick={() => setTab("acquisiti")}
          icon={<Briefcase className="h-4 w-4" />}
          label="Clienti Acquisiti"
          count={acquisiti.length}
          tone="indigo"
        />
        <TabBtn
          active={tab === "completati"}
          onClick={() => setTab("completati")}
          icon={<Award className="h-4 w-4" />}
          label="Completati / Finanziati"
          count={completati.length}
          tone="emerald"
        />
        <TabBtn
          active={tab === "persi"}
          onClick={() => setTab("persi")}
          icon={<XCircle className="h-4 w-4" />}
          label="Clienti Persi"
          count={persi.length}
          tone="rose"
        />
        <TabBtn
          active={tab === "rivalutare"}
          onClick={() => setTab("rivalutare")}
          icon={<Clock className="h-4 w-4" />}
          label="Da Ricontattare"
          count={daRivalutare.length}
          tone="amber"
        />
      </div>

      <div className="flex-1 overflow-auto bg-card">
        {/* TAB 1: ACQUISITI (Pratiche attive) */}
        {tab === "acquisiti" && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-3 py-3 text-left">Contatti</th>
                <th className="px-3 py-3 text-left">Prodotto</th>
                <th className="px-3 py-3 text-left">Banca</th>
                <th className="px-3 py-3 text-left">Stato Lavorazione</th>
                <th className="px-3 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {acquisiti
                .filter((a) => matchesQ(a.name) || matchesQ(a.phone) || matchesQ(a.email))
                .map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {a.clienteId ? (
                        <Link to="/clienti/$id" params={{ id: a.clienteId }} className="hover:text-primary hover:underline">
                          {a.name}
                        </Link>
                      ) : (
                        a.name
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ContactCol phone={a.phone} email={a.email} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{a.prodotto}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{a.banca}</td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                        {a.stageLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => navigate({ to: "/gestione-pratiche" })}>
                          <Briefcase className="h-3 w-3" /> Pratica
                        </Button>
                        {a.clienteId && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => navigate({ to: "/clienti/$id", params: { id: a.clienteId! } })}>
                            <ExternalLink className="h-3 w-3" /> Scheda
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {acquisiti.length === 0 && <EmptyRow cols={6} text="Nessun cliente acquisito in lavorazione." />}
            </tbody>
          </table>
        )}

        {/* TAB 2: COMPLETATI / FINANZIATI (Liquidati) */}
        {tab === "completati" && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-3 py-3 text-left">Contatti</th>
                <th className="px-3 py-3 text-left">Data nascita</th>
                <th className="px-3 py-3 text-left">Decorrenza 1ª rata</th>
                <th className="px-3 py-3 text-left">Operazione in corso</th>
                <th className="px-3 py-3 text-right">Rate residue</th>
                <th className="px-3 py-3 text-right">Capitale residuo</th>
                <th className="px-3 py-3 text-left">Rinnovabile dal</th>
                <th className="px-3 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {completati
                .filter((a) => matchesQ(a.name) || matchesQ(a.phone) || matchesQ(a.email))
                .map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {a.clienteId ? (
                        <Link
                          to="/clienti/$id"
                          params={{ id: a.clienteId }}
                          className="hover:text-primary hover:underline"
                        >
                          {a.name}
                        </Link>
                      ) : (
                        a.name
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ContactCol phone={a.phone} email={a.email} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {a.birthDate ? formatItalianDate(a.birthDate) : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {a.decorrenza ? fmtDate(a.decorrenza) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-700"
                      >
                        {a.operazione}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.rateResidue}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      € {a.capitaleResiduo.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {fmtDate(a.dataRinnovabilita)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {a.clienteId && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs"
                            onClick={() =>
                              navigate({ to: "/clienti/$id", params: { id: a.clienteId! } })
                            }
                          >
                            <ExternalLink className="h-3 w-3" /> Scheda
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              {completati.length === 0 && <EmptyRow cols={9} text="Nessun cliente completato/finanziato." />}
            </tbody>
          </table>
        )}

        {/* TAB 3: PERSI */}
        {tab === "persi" && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left">Cliente / Lead</th>
                <th className="px-3 py-3 text-left">Contatti</th>
                <th className="px-3 py-3 text-left">Motivo Respingimento / Perso</th>
                <th className="px-3 py-3 text-left">Data Creazione</th>
                <th className="px-3 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {persi
                .filter((l) => matchesQ(l.name) || matchesQ(l.phone) || matchesQ(l.email))
                .map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/clienti/$id"
                        params={{ id: l.id }}
                        className="hover:text-primary hover:underline"
                      >
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <ContactCol phone={l.phone} email={l.email} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {l.motivoPersa || <span className="italic">Nessuna nota</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{l.createdLabel}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() => navigate({ to: "/clienti/$id", params: { id: l.id } })}
                        >
                          <Pencil className="h-3 w-3" /> Modifica
                        </Button>
                        {l.lead && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setEditLead(l.lead!)}
                          >
                            <Calendar className="h-3 w-3" /> Rivaluta
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                          onClick={() => handleDeleteDefinitivo(l)}
                        >
                          <Trash2 className="h-3 w-3" /> Elimina
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              {persi.length === 0 && <EmptyRow cols={5} text="Nessun cliente perso." />}
            </tbody>
          </table>
        )}

        {/* TAB 4: RIVALUTARE */}
        {tab === "rivalutare" && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left">Lead / Cliente</th>
                <th className="px-3 py-3 text-left">Contatti</th>
                <th className="px-3 py-3 text-left">Motivo / Note</th>
                <th className="px-3 py-3 text-left">Da ricontattare il</th>
                <th className="px-3 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {daRivalutare
                .filter((l) => matchesQ(l.name) || matchesQ(l.phone) || matchesQ(l.email))
                .map((l) => {
                  const overdue = l.rivalutaIl! <= todayISO;
                  return (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to="/clienti/$id"
                          params={{ id: l.id }}
                          className="hover:text-primary hover:underline"
                        >
                          {l.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <ContactCol phone={l.phone} email={l.email} />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {l.motivoPersa || <span className="italic">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <Badge
                          variant="outline"
                          className={cn(
                            overdue
                              ? "border-rose-300 bg-rose-50 text-rose-700"
                              : "border-amber-300 bg-amber-50 text-amber-700",
                          )}
                        >
                          {formatItalianDate(l.rivalutaIl!)}
                          {overdue ? " · scaduto" : ""}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs"
                            onClick={() => navigate({ to: "/clienti/$id", params: { id: l.id } })}
                          >
                            <Pencil className="h-3 w-3" /> Scheda
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setEditLead(l)}
                          >
                            <Calendar className="h-3 w-3" /> Riprogramma
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {daRivalutare.length === 0 && (
                <EmptyRow cols={5} text="Nessun contatto programmato da rivalutare." />
              )}
            </tbody>
          </table>
        )}
      </div>

      <RivalutaDialog
        lead={editLead}
        onClose={() => setEditLead(null)}
        onSave={(id, patch) => {
          updateLead(id, patch);
          setEditLead(null);
        }}
      />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "emerald" | "rose" | "amber" | "indigo";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : tone === "indigo"
      ? "text-indigo-700"
      : "text-amber-700";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <span className={cn("rounded-full bg-muted px-1.5 text-xs", active && toneCls)}>{count}</span>
    </button>
  );
}

function ContactCol({ phone, email }: { phone: string | null; email: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {phone && (
        <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-primary">
          <Phone className="h-3 w-3" /> {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <Mail className="h-3 w-3" /> {email}
        </a>
      )}
      {!phone && !email && <span className="text-muted-foreground italic">—</span>}
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}

function RivalutaDialog({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Lead>) => void;
}) {
  const [rivalutaIl, setRivalutaIl] = useState("");
  const [motivoPersa, setMotivoPersa] = useState("");

  const open = !!lead;
  if (
    open &&
    lead &&
    rivalutaIl === "" &&
    motivoPersa === "" &&
    (lead.rivalutaIl || lead.motivoPersa)
  ) {
    if (lead.rivalutaIl) setRivalutaIl(lead.rivalutaIl);
    if (lead.motivoPersa) setMotivoPersa(lead.motivoPersa);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setRivalutaIl("");
          setMotivoPersa("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lead?.name} — Pianifica rivalutazione</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Da ricontattare il</Label>
            <Input type="date" value={rivalutaIl} onChange={(e) => setRivalutaIl(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Es. quando il cliente avrà maturato un TFR congruo.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo / Note</Label>
            <Textarea
              rows={3}
              value={motivoPersa}
              onChange={(e) => setMotivoPersa(e.target.value)}
              placeholder="Es. TFR ancora basso, da rivalutare tra 12 mesi."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {lead?.rivalutaIl && (
            <Button
              variant="ghost"
              className="text-rose-700 hover:text-rose-800"
              onClick={() => {
                if (!lead) return;
                onSave(lead.id, { rivalutaIl: undefined });
                setRivalutaIl("");
                setMotivoPersa("");
              }}
            >
              Rimuovi rivalutazione
            </Button>
          )}
          <Button
            onClick={() => {
              if (!lead || !rivalutaIl) return;
              const nextStage =
                lead.stage === "persa" || lead.stage === "appuntamento_futuro"
                  ? lead.stage
                  : "appuntamento_futuro";
              onSave(lead.id, { rivalutaIl, motivoPersa, stage: nextStage });
              setRivalutaIl("");
              setMotivoPersa("");
            }}
            disabled={!rivalutaIl}
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatItalianDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${d} ${mesi[Number(m) - 1]} ${y}`;
}