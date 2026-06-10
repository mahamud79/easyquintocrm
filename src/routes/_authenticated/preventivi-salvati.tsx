import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bookmark,
  Eye,
  ExternalLink,
  Flag,
  Trash2,
  FileSignature,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { usePraticheStore } from "@/lib/pratiche-store";
import { clientiStore } from "@/lib/clienti-store";
import { useLeadsStore } from "@/lib/leads-store";
import {
  usePreventiviStore,
  type Preventivo,
  type PreventivoCategoria,
} from "@/lib/preventivi-store";

export const Route = createFileRoute("/_authenticated/preventivi-salvati")({
  head: () => ({ meta: [{ title: "Preventivi Salvati · LeadValue" }] }),
  component: PreventiviSalvatiPage,
});

type TabKey = PreventivoCategoria;

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

function PreventiviSalvatiPage() {
  const { preventivi: allItems, removePreventivo, updatePreventivo } = usePreventiviStore();
  // Nasconde i preventivi archiviati (già trasformati in pratica): restano
  // disponibili nella scheda cliente sotto "Preventivi inviati".
  const items = useMemo(() => allItems.filter((p) => !p.dettagli?.archived), [allItems]);
  const [tab, setTab] = useState<TabKey>("cessioni");
  const [toDelete, setToDelete] = useState<Preventivo | null>(null);
  const [toLose, setToLose] = useState<Preventivo | null>(null);
  const [motivoPersa, setMotivoPersa] = useState("");
  const navigate = useNavigate();
  const { addPratica } = usePraticheStore();
  const { addLead, updateLead, leads, deleteLead } = useLeadsStore();

  const counts = useMemo(
    () => ({
      cessioni: items.filter((p) => p.categoria === "cessioni").length,
      prestiti: items.filter((p) => p.categoria === "prestiti").length,
      mutui: items.filter((p) => p.categoria === "mutui").length,
    }),
    [items],
  );

  const visible = items.filter((p) => p.categoria === tab);

  const handleTrasforma = (p: Preventivo) => {
    const clienteEsistente = p.dettagli?.clienteId
      ? clientiStore.get().find((c) => c.id === p.dettagli?.clienteId)
      : clientiStore.get().find((c) => c.name.toLowerCase() === p.nome.toLowerCase());
    const clienteId = clienteEsistente?.id ?? p.dettagli?.clienteId ?? `cliente_prev_${p.nome.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    const cliente = clientiStore.ensure({
      id: clienteId,
      name: p.nome,
      phone: p.dettagli?.telefonoCliente ?? clienteEsistente?.phone ?? null,
      email: p.dettagli?.emailCliente ?? clienteEsistente?.email ?? null,
    });
    const bancaMandante =
      p.dettagli?.bancaMandante?.trim() ||
      (p.categoria === "prestiti" ? p.prodotto : "") ||
      cliente.banca ||
      null;
    // Recupera il lead corrispondente per ereditare nota e telefono
    const nameKeyPre = p.nome.trim().toLowerCase();
    const phoneKeyPre = (p.dettagli?.telefonoCliente ?? "").replace(/\s+/g, "");
    const leadOrigine = leads.find((l) => {
      const sameName = l.name.trim().toLowerCase() === nameKeyPre;
      const samePhone = phoneKeyPre && (l.phone ?? "").replace(/\s+/g, "") === phoneKeyPre;
      return sameName || samePhone;
    });
    const notaPreventivo = `Generata da preventivo del ${fmtData(p.data)}`;
    const notaCombinata = leadOrigine?.notes?.trim()
      ? `${leadOrigine.notes.trim()}\n\n— ${notaPreventivo}`
      : notaPreventivo;
    const montanteLordo = (p.dettagli?.rata ?? 0) * (p.dettagli?.durata ?? 0);
    addPratica({
      nomePratica: `${p.tipoPratica === "CQS" ? "CQS" : p.tipoPratica === "PRESTITO_PERSONALE" ? "PP" : "MUTUO"} ${p.nome}`,
      cliente: p.nome,
      clienteId: cliente.id,
      telefono: p.dettagli?.telefonoCliente ?? cliente.phone ?? null,
      azienda: p.dettagli?.aziendaCliente ?? cliente.azienda ?? null,
      tipo: p.tipoPratica,
      numeroPratica: null,
      importo: montanteLordo || p.importo,
      provvigione: p.provvigione,
      stage: "attesa_doc",
      priorita: null,
      note: notaCombinata,
      numeroPraticaBanca: null,
      compagniaAssicurativa: null,
      prodotto: p.prodotto,
      banca: bancaMandante,
      durata: p.dettagli?.durata ?? null,
      rata: p.dettagli?.rata ?? null,
    });
    // Non rimuoviamo più il preventivo: lo archiviamo collegandolo al cliente
    // per poterlo consultare dalla scheda cliente → "Preventivi inviati".
    updatePreventivo(p.id, {
      dettagli: { ...(p.dettagli ?? {}), archived: true, clienteId: cliente.id },
    });
    // Rimuovi il lead corrispondente: una volta diventato pratica non deve più
    // comparire nel menu Lead (nemmeno tra gli Accettati).
    if (leadOrigine) deleteLead(leadOrigine.id);
    toast.success(`Pratica creata per ${p.nome}`, {
      description: "Spostata in Gestione Pratiche — Attesa Doc cliente",
    });
    navigate({ to: "/gestione-pratiche" });
  };

  const confirmElimina = () => {
    if (!toDelete) return;
    removePreventivo(toDelete.id);
    setToDelete(null);
    toast.success("Preventivo eliminato");
  };

  const handleVaiScheda = (p: Preventivo) => {
    const existing = p.dettagli?.clienteId
      ? clientiStore.get().find((c) => c.id === p.dettagli?.clienteId)
      : clientiStore.get().find((c) => c.name.toLowerCase() === p.nome.toLowerCase());
    const id = existing?.id ?? p.dettagli?.clienteId ?? `cliente_prev_${p.nome.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    clientiStore.ensure({ id, name: p.nome, phone: p.dettagli?.telefonoCliente ?? existing?.phone, email: p.dettagli?.emailCliente ?? existing?.email });
    navigate({ to: "/clienti/$id", params: { id } });
  };

  const handlePersa = (p: Preventivo) => {
    setToLose(p);
    setMotivoPersa("");
  };

  const confirmPersa = () => {
    if (!toLose) return;
    const created = addLead({
      name: toLose.nome,
      phone: toLose.dettagli?.telefonoCliente ?? undefined,
      email: toLose.dettagli?.emailCliente ?? undefined,
      company: toLose.dettagli?.aziendaCliente ?? undefined,
      source: "preventivo-perso",
      stage: "persa",
      motivoPersa: motivoPersa.trim() || undefined,
    });
    // assicurati che il motivo venga propagato anche se è stato passato sopra
    if (motivoPersa.trim()) updateLead(created.id, { motivoPersa: motivoPersa.trim() });
    removePreventivo(toLose.id);
    setToLose(null);
    setMotivoPersa("");
    toast.warning(`${created.name} spostato tra i Lead persi`, {
      description: "Visibile in Privati → Lead persi",
    });
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "cessioni", label: "Cessioni" },
    { key: "prestiti", label: "Prestiti" },
    { key: "mutui", label: "Mutui" },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <Bookmark className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Preventivi Salvati</h1>
      </header>

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Prodotto</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Pratica</th>
              <th className="px-4 py-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-semibold text-foreground">{p.nome}</td>
                <td className="px-4 py-3">
                  <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{p.tipoLead}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.prodotto}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtData(p.data)}</td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-700"
                    onClick={() => handleTrasforma(p)}
                  >
                    <FileSignature className="h-3.5 w-3.5" />
                    Trasforma in Pratica
                  </Button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700"
                      onClick={() => navigate({ to: "/preventivi-salvati/$id", params: { id: p.id } })}
                    >
                      <Eye className="h-3.5 w-3.5" /> Vedi Preventivo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-700"
                      onClick={() =>
                        navigate({
                          to: "/preventivi-salvati/$id",
                          params: { id: p.id },
                          search: { edit: 1 },
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" /> Modifica
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-700"
                      onClick={() => handleVaiScheda(p)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Vai alla scheda
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-700"
                      onClick={() => handlePersa(p)}
                    >
                      <Flag className="h-3.5 w-3.5" /> Persa
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-700"
                      onClick={() => setToDelete(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Elimina
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  Nessun preventivo salvato in questa categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il preventivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare il preventivo di <strong>{toDelete?.nome}</strong>. L'operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmElimina}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!toLose} onOpenChange={(o) => { if (!o) { setToLose(null); setMotivoPersa(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Segna come persa · {toLose?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo della perdita</Label>
            <Textarea
              rows={4}
              value={motivoPersa}
              onChange={(e) => setMotivoPersa(e.target.value)}
              placeholder="Es. tasso troppo alto, ha scelto altra finanziaria, TFR insufficiente…"
            />
            <p className="text-xs text-muted-foreground">
              Il nominativo verrà spostato in Privati → Lead persi con questa nota.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setToLose(null); setMotivoPersa(""); }}>Annulla</Button>
            <Button onClick={confirmPersa} className="bg-amber-600 text-white hover:bg-amber-700">Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
