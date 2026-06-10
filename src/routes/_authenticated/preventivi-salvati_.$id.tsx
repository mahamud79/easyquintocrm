import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Pencil,
  Paperclip,
  Send,
  User,
  Wallet,
  Calculator,
  TrendingUp,
  X,
  Save,
  MessageCircle,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  usePreventiviStore,
  type Preventivo,
  type PreventivoDettagli,
} from "@/lib/preventivi-store";
import { formatEuroIT, formatPctIT, formatItNumber } from "@/lib/format-eur";
import { useCompagnie } from "@/lib/compagnie-store";

// IMPORTATI PER LA FASE 2:
import { usePraticheStore } from "@/lib/pratiche-store";
import { useLeadsStore } from "@/lib/leads-store";

export const Route = createFileRoute("/_authenticated/preventivi-salvati_/$id")({
  head: () => ({ meta: [{ title: "Preventivo · LeadValue" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    edit: s.edit === 1 || s.edit === "1" ? 1 : undefined,
  }),
  component: PreventivoDettaglioPage,
});

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const fmtEur = (n?: number | null) => formatEuroIT(n);
const fmtPct = (n?: number | null) => formatPctIT(n);
const fmtDateIt = (iso?: string) =>
  !iso ? "—" : new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

function PreventivoDettaglioPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { preventivi, updatePreventivo } = usePreventiviStore();
  const preventivo = useMemo(() => preventivi.find((p) => p.id === id), [preventivi, id]);
  const [mode, setMode] = useState<"view" | "edit">(search.edit ? "edit" : "view");
  const [showEmail, setShowEmail] = useState(false);
  const [attachedPdf, setAttachedPdf] = useState<string | null>(null);

  // ZUSTAND STORES PER FASE 2
  const { addPratica } = usePraticheStore();
  const { updateLead, leads } = useLeadsStore();

  if (!preventivo) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-muted-foreground">Preventivo non trovato.</p>
        <Link to="/preventivi-salvati" className="mt-4 inline-block text-sm text-primary underline">
          Torna ai Preventivi Salvati
        </Link>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <PreventivoEditForm
        preventivo={preventivo}
        onSave={(patch) => {
          updatePreventivo(preventivo.id, patch);
          toast.success("Modifiche salvate");
          setMode("view");
        }}
        onCancel={() => setMode("view")}
      />
    );
  }

  const d: PreventivoDettagli = preventivo.dettagli ?? {};
  const mostraProvvigioni = d.mostraProvvigioni !== false; // default: visibile

  // Override editabili reddituale (con fallback ai valori calcolati)
  const lordoVal = d.lordoMensileEdit ?? d.lordoMensile;
  const nettoVal = d.nettoMensileEdit ?? d.nettoMensile;
  const quotaVal = d.quotaCedibileEdit ?? d.quotaCedibile;

  // ==========================================
  // FUNZIONE CONVERTI IN PRATICA (FASE 2)
  // ==========================================
  const handleConvertToPratica = () => {
    // 1. Determina il tipo di pratica in base al nome del prodotto
    let tipo: "CQS" | "DP" | "PP" | "TFS" | "M" | "ALTRO" = "ALTRO";
    const prod = preventivo.prodotto.toLowerCase();
    if (prod.includes("cessione")) tipo = "CQS";
    else if (prod.includes("delega")) tipo = "DP";
    else if (prod.includes("personale")) tipo = "PP";
    else if (prod.includes("mutuo")) tipo = "M";

    // 2. Crea la nuova Pratica in "Gestione Pratiche"
    addPratica({
      nomePratica: `${preventivo.prodotto} - ${preventivo.nome}`,
      cliente: preventivo.nome,
      clienteId: d.clienteId,
      importo: d.montante ?? preventivo.importo ?? 0,
      provvigione: preventivo.provvigione ?? 0,
      banca: d.bancaMandante ?? "",
      compagniaAssicurativa: d.assicurazione ?? "",
      stage: "attesa_doc", // Primo stage della kanban Pratiche
      tipo,
    });

    // 3. Aggiorna lo stato del Lead in "Accettato"
    if (d.clienteId) {
      updateLead(d.clienteId, { stage: "accettato" });
    } else {
      // Fallback: cerca per nome se l'ID manca
      const match = leads.find((l) => l.name.toLowerCase() === preventivo.nome.toLowerCase());
      if (match) updateLead(match.id, { stage: "accettato" });
    }

    // 4. Marca il preventivo come archiviato/convertito
    updatePreventivo(preventivo.id, { dettagli: { ...d, archived: true } });

    toast.success("Preventivo accettato!", { description: "Convertito in Pratica con successo." });
    navigate({ to: "/gestione-pratiche" });
  };

  const handleDownloadPdf = async () => {
    try {
      toast.loading("Generazione PDF in corso...", { id: "pdf-gen" });
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = 18;

      const ensureSpace = (needed = 10) => {
        if (y + needed <= pageHeight - margin) return;
        pdf.addPage();
        y = margin;
      };
      const text = (value: string) => value.replace(/<[^>]+>/g, "").replace(/€/g, "EUR");
      const addSection = (title: string) => {
        ensureSpace(16);
        y += 5;
        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(margin, y, contentWidth, 8, 2, 2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        pdf.text(text(title.toUpperCase()), margin + 3, y + 5.5);
        y += 12;
      };
      const addRow = (label: string, value: string) => {
        ensureSpace(8);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 116, 139);
        pdf.text(text(label), margin, y);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        const lines = pdf.splitTextToSize(text(value || "—"), 86);
        pdf.text(lines, margin + 88, y, { align: "left" });
        y += Math.max(7, lines.length * 5);
      };

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42);
      pdf.text("Preventivo", margin, y);
      y += 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(71, 85, 105);
      pdf.text(text(`${preventivo.nome} - ${fmtData(preventivo.data)}`), margin, y);
      y += 8;

      addSection("Dati cliente");
      addRow("Nome", preventivo.nome);
      addRow("Sesso", d.sesso ?? "—");
      addRow("Data di nascita", fmtDateIt(d.dataNascita));
      addRow("Data assunzione", fmtDateIt(d.dataAssunzione));
      addRow("Tipologia", d.tipologia ?? "—");
      addRow("Settore ATC", d.settoreAtc ?? "—");

      addSection("Situazione reddituale");
      addRow("Lordo mensile", fmtEur(lordoVal));
      addRow("Netto mensile", fmtEur(nettoVal));
      addRow("Quota cedibile", fmtEur(quotaVal));

      addSection("Calcolo prestito");
      addRow("Prodotto", preventivo.prodotto);
      addRow("Rata mensile", fmtEur(d.rata));
      addRow("Durata", d.durata ? `${d.durata} mesi` : "—");
      addRow("Tasso nominale annuo (TAN)", fmtPct(d.tan));
      addRow("Tasso effettivo globale medio (TAEG)", fmtPct(d.taeg));
      addRow("Imposta di bollo", fmtEur(16));
      addRow("Montante", fmtEur(d.montante ?? preventivo.importo));
      addRow("Netto al cliente", fmtEur(d.netto));

      if (mostraProvvigioni) {
        addSection("Provvigioni");
        addRow("Banca mandante", d.bancaMandante ?? "—");
        addRow("Provvigione %", fmtPct(d.provvigionePct));
        addRow("Provvigione euro", fmtEur(preventivo.provvigione));
      }

      const safeName = preventivo.nome.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
      pdf.save(`Preventivo_${safeName || "cliente"}.pdf`);
      // Salva il PDF (data URL) nei dettagli del preventivo per poterlo
      // riconsultare dalla scheda cliente anche dopo la trasformazione in pratica.
      try {
        const dataUrl = pdf.output("datauristring");
        updatePreventivo(preventivo.id, {
          dettagli: { ...d, pdfDataUrl: dataUrl, pdfGeneratedAt: new Date().toISOString() },
        });
      } catch (e) {
        console.warn("Impossibile salvare il PDF nei dettagli:", e);
      }
      toast.success("PDF scaricato", { id: "pdf-gen" });
    } catch (err) {
      console.error(err);
      toast.error("Errore durante la generazione del PDF", { id: "pdf-gen" });
    }
  };

  const toggleMostraProvvigioni = (v: boolean) => {
    updatePreventivo(preventivo.id, { dettagli: { ...d, mostraProvvigioni: v } });
  };

  const setRedditualeField = (key: "lordoMensileEdit" | "nettoMensileEdit" | "quotaCedibileEdit", v: number) => {
    updatePreventivo(preventivo.id, { dettagli: { ...d, [key]: v } });
  };

  const setTaeg = (v: number) => {
    updatePreventivo(preventivo.id, { dettagli: { ...d, taeg: v } });
  };

  const setNettoErogato = (v: number) => {
    updatePreventivo(preventivo.id, { dettagli: { ...d, netto: v } });
  };

  const handleSendWhatsApp = () => {
    const phoneRaw = (d.telefonoCliente ?? "").replace(/\D/g, "");
    if (!phoneRaw) {
      toast.error("Numero di telefono del cliente mancante");
      return;
    }
    const phone = phoneRaw.startsWith("39") ? phoneRaw : `39${phoneRaw}`;
    const msg = buildDefaultMessage(preventivo, mostraProvvigioni)
      .replace(/<\/?strong>/g, "*")
      .replace(/€/g, "€");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleAttachPdf = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) {
        setAttachedPdf(f.name);
        toast.success(`PDF allegato: ${f.name}`);
      }
    };
    input.click();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate({ to: "/preventivi-salvati" })}
            className="mt-1 h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{preventivo.nome}</h1>
            <p className="text-sm text-muted-foreground">Preventivo del {fmtData(preventivo.data)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{preventivo.prodotto}</Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700"
            onClick={handleDownloadPdf}
            title={`Scarica PDF riepilogo ${preventivo.tipoPratica === "CQS" ? "CQS" : "preventivo"}`}
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setMode("edit")}
          >
            <Pencil className="h-3.5 w-3.5" /> Modifica
          </Button>
        </div>
      </header>

      {/* Azioni principali */}
      <div className="flex flex-wrap items-center gap-2">
        {/* INIZIO NUOVO BOTTONE FASE 2 */}
        <Button
          className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
          onClick={handleConvertToPratica}
          disabled={!!d.archived}
        >
          <Briefcase className="h-4 w-4" /> 
          {d.archived ? "Già Convertito in Pratica" : "Converti in Pratica (Accettato)"}
        </Button>
        {/* FINE NUOVO BOTTONE */}

        <Button
          className="gap-2 bg-foreground text-background hover:bg-foreground/90"
          onClick={handleAttachPdf}
        >
          <Paperclip className="h-4 w-4" />
          {attachedPdf ? `PDF allegato (${attachedPdf})` : "Allega PDF"}
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setShowEmail((v) => !v)}>
          <Send className="h-4 w-4" /> Invia via Email
        </Button>
        <Button
          variant="outline"
          className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          onClick={handleSendWhatsApp}
        >
          <MessageCircle className="h-4 w-4" /> Invia via WhatsApp
        </Button>
        <label className="ml-2 flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs font-medium">
          <Checkbox
            checked={mostraProvvigioni}
            onCheckedChange={(v) => toggleMostraProvvigioni(!!v)}
          />
          Mostra provvigioni
        </label>
      </div>

      {showEmail && (
        <EmailComposer
          preventivo={preventivo}
          attachedPdf={attachedPdf}
          mostraProvvigioni={mostraProvvigioni}
          onClose={() => setShowEmail(false)}
          onSaveEmail={(email) =>
            updatePreventivo(preventivo.id, { dettagli: { ...d, emailCliente: email } })
          }
        />
      )}

      {/* Grid 4 card */}
      <div className="grid gap-4 bg-background p-2 md:grid-cols-2">
        <Card icon={<User className="h-4 w-4" />} title="Dati cliente">
          <KV k="Nome" v={preventivo.nome} />
          <KV k="Sesso" v={d.sesso ?? "—"} />
          <KV k="Data di nascita" v={fmtDateIt(d.dataNascita)} />
          <KV k="Data assunzione" v={fmtDateIt(d.dataAssunzione)} />
          <KV k="Tipologia" v={d.tipologia ?? "—"} />
          <KV k="Settore ATC" v={d.settoreAtc ?? "—"} />
        </Card>

        <Card icon={<Wallet className="h-4 w-4" />} title="Situazione reddituale">
          <KVEdit k="Lordo mensile" v={lordoVal} onChange={(n) => setRedditualeField("lordoMensileEdit", n)} />
          <KVEdit k="Netto mensile" v={nettoVal} onChange={(n) => setRedditualeField("nettoMensileEdit", n)} />
          <KVEdit k="Quota cedibile" v={quotaVal} onChange={(n) => setRedditualeField("quotaCedibileEdit", n)} />
        </Card>

        <Card icon={<Calculator className="h-4 w-4" />} title="Calcolo prestito">
          <KV k="Prodotto" v={preventivo.prodotto} />
          <KV k="Rata mensile" v={fmtEur(d.rata)} />
          <KV k="Durata" v={d.durata ? `${d.durata} mesi` : "—"} />
          <KV k="Tasso nominale annuo (TAN)" v={fmtPct(d.tan)} />
          <KVTaeg value={d.taeg} onChange={setTaeg} />
          <KV k="Imposta di bollo" v={fmtEur(16)} />
          <KV k="Montante" v={fmtEur(d.montante ?? preventivo.importo)} />
          <KVEdit k="Netto erogato" v={d.netto} onChange={setNettoErogato} />
        </Card>

        {mostraProvvigioni && (
          <Card icon={<TrendingUp className="h-4 w-4" />} title="Provvigioni">
            <KV k="Banca mandante" v={d.bancaMandante ?? "—"} />
            <KV k="Provvigione %" v={fmtPct(d.provvigionePct)} />
            <KV k="Provvigione euro" v={fmtEur(preventivo.provvigione)} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <span className="text-foreground/70">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-foreground">{v}</span>
    </div>
  );
}

function KVEdit({ k, v, onChange }: { k: string; v?: number | null; onChange: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>("");
  const display = focused
    ? raw
    : v == null || !isFinite(v as number)
    ? ""
    : formatItNumber(v as number);
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">€</span>
        <Input
          value={display}
          placeholder="0,00"
          inputMode="decimal"
          className="h-7 w-28 text-right text-sm font-semibold tabular-nums"
          onFocus={() => {
            setFocused(true);
            setRaw(v != null && isFinite(v as number) ? String(v).replace(".", ",") : "");
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "");
            setRaw(cleaned);
            const n = Number(cleaned.replace(",", "."));
            onChange(isFinite(n) ? n : 0);
          }}
        />
      </div>
    </div>
  );
}

function KVTaeg({ value, onChange }: { value?: number | null; onChange: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>("");
  const display = focused
    ? raw
    : value == null || !isFinite(value as number)
    ? ""
    : formatItNumber(value as number);
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">Tasso effettivo globale medio (TAEG)</span>
      <div className="flex items-center gap-1">
        <Input
          value={display}
          placeholder="0,00"
          inputMode="decimal"
          className="h-7 w-24 text-right text-sm font-semibold tabular-nums"
          onFocus={() => {
            setFocused(true);
            setRaw(value != null && isFinite(value as number) ? String(value).replace(".", ",") : "");
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "");
            setRaw(cleaned);
            const n = Number(cleaned.replace(",", "."));
            onChange(isFinite(n) ? n : 0);
          }}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

// ---------- Email composer ----------

function EmailComposer({
  preventivo,
  attachedPdf,
  mostraProvvigioni,
  onClose,
  onSaveEmail,
}: {
  preventivo: Preventivo;
  attachedPdf: string | null;
  mostraProvvigioni: boolean;
  onClose: () => void;
  onSaveEmail: (email: string) => void;
}) {
  const d = preventivo.dettagli ?? {};
  const [email, setEmail] = useState(d.emailCliente ?? "");
  const [nome, setNome] = useState(preventivo.nome);
  const [oggetto, setOggetto] = useState(`Preventivo - ${preventivo.nome}`);
  const [messaggio, setMessaggio] = useState(buildDefaultMessage(preventivo, mostraProvvigioni));

  const send = () => {
    if (!email || !email.includes("@")) {
      toast.error("Inserisci un'email valida");
      return;
    }
    onSaveEmail(email);
    toast.success("Email inviata", {
      description: `Preventivo inviato a ${email}${attachedPdf ? ` con allegato ${attachedPdf}` : ""}`,
    });
    onClose();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-sky-50/40">
      <div className="flex items-center justify-between border-b border-sky-200 bg-sky-100/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sky-700">
          <Send className="h-4 w-4" /> Invia preventivo via email
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Email destinatario *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Nome destinatario</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Oggetto</Label>
          <Input value={oggetto} onChange={(e) => setOggetto(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Messaggio</Label>
          <Textarea
            rows={8}
            value={messaggio}
            onChange={(e) => setMessaggio(e.target.value)}
            className="mt-1 font-mono text-xs"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={send} className="gap-2">
            <Send className="h-4 w-4" /> Invia Email
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildDefaultMessage(p: Preventivo, mostraProvvigioni: boolean = true): string {
  const d = p.dettagli ?? {};
  const lines = [
    `Gentile ${p.nome.split(" ")[0]},`,
    "",
    "Come da accordi telefonici le riporto di seguito il preventivo richiesto:",
    "",
    `Prodotto: <strong>${p.prodotto}</strong>`,
  ];
  if (d.rata) lines.push(`Rata mensile: <strong>${fmtEur(d.rata)}</strong>`);
  if (d.durata) lines.push(`Durata: <strong>${d.durata} mesi</strong>`);
  if (d.tan) lines.push(`TAN: <strong>${fmtPct(d.tan)}</strong>`);
  if (d.taeg) lines.push(`TAEG: <strong>${fmtPct(d.taeg)}</strong>`);
  lines.push(`Imposta di bollo: <strong>${fmtEur(16)}</strong>`);
  lines.push(`Montante: <strong>${fmtEur(d.montante ?? p.importo)}</strong>`);
  if (d.netto) lines.push(`Netto al cliente: <strong>${fmtEur(d.netto)}</strong>`);
  if (mostraProvvigioni && p.provvigione) {
    lines.push(`Provvigione: <strong>${fmtEur(p.provvigione)}</strong>`);
  }
  lines.push("", "Resto a disposizione per qualsiasi chiarimento.", "", "Cordiali saluti");
  return lines.join("\n");
}

// ---------- Edit form ----------

function PreventivoEditForm({
  preventivo,
  onSave,
  onCancel,
}: {
  preventivo: Preventivo;
  onSave: (patch: Partial<Omit<Preventivo, "id">>) => void;
  onCancel: () => void;
}) {
  const d = preventivo.dettagli ?? {};
  const [nome, setNome] = useState(preventivo.nome);
  const [prodotto, setProdotto] = useState(preventivo.prodotto);
  const [data, setData] = useState(preventivo.data);
  const [importo, setImporto] = useState<number>(preventivo.importo);
  const [provvigione, setProvvigione] = useState<number>(preventivo.provvigione);

  const [sesso, setSesso] = useState(d.sesso ?? "");
  const [dataNascita, setDataNascita] = useState(d.dataNascita ?? "");
  const [dataAssunzione, setDataAssunzione] = useState(d.dataAssunzione ?? "");
  const [tipologia, setTipologia] = useState(d.tipologia ?? "");
  const [settoreAtc, setSettoreAtc] = useState(d.settoreAtc ?? "");

  const [lordo, setLordo] = useState<number>(d.lordoMensile ?? 0);
  const [netto, setNetto] = useState<number>(d.nettoMensile ?? 0);

  const [tipoPrev, setTipoPrev] = useState(prodotto);
  const [rata, setRata] = useState<number>(d.rata ?? 0);
  const [durata, setDurata] = useState<number>(d.durata ?? 0);
  const [tan, setTan] = useState<number>(d.tan ?? 0);
  const [taeg, setTaeg] = useState<number>(d.taeg ?? 0);
  const [montante, setMontante] = useState<number>(d.montante ?? preventivo.importo);
  const [nettoCliente, setNettoCliente] = useState<number>(d.netto ?? 0);
  const [rinnovo, setRinnovo] = useState(false);

  const [banca, setBanca] = useState(d.bancaMandante ?? "");
  const [provvPct, setProvvPct] = useState<number>(d.provvigionePct ?? 0);
  const [provvEur, setProvvEur] = useState<number>(preventivo.provvigione);

  const [assicurazione, setAssicurazione] = useState<string>(d.assicurazione ?? "");
  const [compagnie] = useCompagnie();

  const [note, setNote] = useState("");

  const handleSave = () => {
    onSave({
      nome,
      prodotto: tipoPrev || prodotto,
      data,
      importo: montante || importo,
      provvigione: provvEur || provvigione,
      dettagli: {
        ...d,
        sesso,
        dataNascita,
        dataAssunzione,
        tipologia,
        settoreAtc,
        lordoMensile: lordo,
        nettoMensile: netto,
        lordoMensileEdit: lordo,
        nettoMensileEdit: netto,
        rata,
        durata,
        tan,
        taeg,
        montante,
        netto: nettoCliente,
        bancaMandante: banca,
        provvigionePct: provvPct,
        assicurazione,
      },
    });
    void rinnovo;
    void note;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onCancel} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          Modifica Preventivo — {preventivo.nome}
        </h1>
      </header>

      <Section title="Dati cliente">
        <Field label="Nome Cliente">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Tipologia">
          <Select value={tipologia} onValueChange={setTipologia}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {["Dipendente Privato", "Dipendente Pubblico", "Pensionato", "Statale"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data di Nascita">
          <Input type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)} />
        </Field>
        <Field label="Data Assunzione">
          <Input type="date" value={dataAssunzione} onChange={(e) => setDataAssunzione(e.target.value)} />
        </Field>
        <Field label="Sesso">
          <Select value={sesso} onValueChange={setSesso}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Maschio">Maschio</SelectItem>
              <SelectItem value="Femmina">Femmina</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Settore ATC">
          <Input value={settoreAtc} onChange={(e) => setSettoreAtc(e.target.value)} />
        </Field>
        <Field label="Data preventivo">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
      </Section>

      <Section title="Dati reddituali">
        <Field label="Lordo Mensile (€)">
          <EurInput value={lordo} onChange={setLordo} />
        </Field>
        <Field label="Netto Mensile (€)">
          <EurInput value={netto} onChange={setNetto} />
        </Field>
      </Section>

      <Section title="Dati prestito">
        <Field label="Tipo Preventivo">
          <Input value={tipoPrev} onChange={(e) => setTipoPrev(e.target.value)} />
        </Field>
        <Field label="Rata (€)">
          <EurInput value={rata} onChange={setRata} />
        </Field>
        <Field label="Durata (mesi)">
          <NumInput value={durata} onChange={setDurata} />
        </Field>
        <Field label="TAN (%)">
          <NumInput value={tan} onChange={setTan} decimals />
        </Field>
        <Field label="TAEG (%)">
          <NumInput value={taeg} onChange={setTaeg} decimals />
        </Field>
        <Field label="Montante (€)">
          <EurInput value={montante} onChange={setMontante} />
        </Field>
        <Field label="Netto Erogato (€)">
          <EurInput value={nettoCliente} onChange={setNettoCliente} />
        </Field>
        <div className="md:col-span-3 flex items-center gap-2 pt-2">
          <Checkbox
            id="rinnovo"
            checked={rinnovo}
            onCheckedChange={(c) => setRinnovo(!!c)}
          />
          <Label htmlFor="rinnovo" className="text-sm">Rinnovo</Label>
        </div>
      </Section>

      <Section title="Provvigioni">
        <Field label="Banca Mandante">
          <Input value={banca} onChange={(e) => setBanca(e.target.value)} />
        </Field>
        <Field label="Provvigione (%)">
          <NumInput value={provvPct} onChange={setProvvPct} decimals />
        </Field>
        <Field label="Provvigione (€)">
          <EurInput value={provvEur} onChange={setProvvEur} />
        </Field>
      </Section>

      <Section title="Assicurazione">
        <Field label="Compagnia Assicurativa">
          <Select value={assicurazione} onValueChange={setAssicurazione}>
            <SelectTrigger><SelectValue placeholder="Seleziona compagnia" /></SelectTrigger>
            <SelectContent>
              {compagnie.map((c) => (
                <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <div className="rounded-xl border border-border bg-card p-4">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Note</Label>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2"
        />
      </div>

      <div className="flex items-center justify-center gap-3 pb-6">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" /> Salva Modifiche
        </Button>
        <Button variant="ghost" onClick={onCancel}>Annulla</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-4 md:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EurInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");
  const display = focused
    ? raw
    : value == null || !isFinite(value) || value === 0
    ? ""
    : formatItNumber(value);
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">€</span>
      <Input
        value={display}
        placeholder="0,00"
        inputMode="decimal"
        className="text-right tabular-nums"
        onFocus={() => {
          setFocused(true);
          setRaw(value && isFinite(value) ? String(value).replace(".", ",") : "");
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "");
          setRaw(cleaned);
          const n = Number(cleaned.replace(",", "."));
          onChange(isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}

function NumInput({
  value,
  onChange,
  decimals = false,
}: {
  value: number;
  onChange: (n: number) => void;
  decimals?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");
  const display = focused
    ? raw
    : value == null || !isFinite(value) || value === 0
    ? ""
    : decimals
    ? formatItNumber(value, { minDecimals: 0, maxDecimals: 4 })
    : String(value);
  return (
    <Input
      value={display}
      placeholder="0"
      inputMode="decimal"
      className="text-right tabular-nums"
      onFocus={() => {
        setFocused(true);
        setRaw(value && isFinite(value) ? String(value).replace(".", ",") : "");
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "");
        setRaw(cleaned);
        const n = Number(cleaned.replace(",", "."));
        onChange(isFinite(n) ? n : 0);
      }}
    />
  );
}