import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Filter, Inbox, Search, Upload, FileSpreadsheet, X } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Import · LeadValue" }] }),
  component: ImportPage,
});

type ImportedContact = {
  id: string;
  nome: string;
  telefono: string;
  email: string;
  azienda: string;
  raw: Record<string, unknown>;
};

const pick = (row: Record<string, unknown>, keys: string[]): string => {
  const lowered: Record<string, unknown> = {};
  Object.keys(row).forEach((k) => (lowered[k.toLowerCase().trim()] = row[k]));
  for (const k of keys) {
    const v = lowered[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

function ImportPage() {
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, unknown>[] = [];
      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        rows = parsed.data;
      } else if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      } else {
        throw new Error("Formato non supportato. Usa CSV, XLS o XLSX.");
      }
      const mapped: ImportedContact[] = rows
        .map((r, i) => ({
          id: `imp-${Date.now()}-${i}`,
          nome: pick(r, ["nome", "name", "nominativo", "cognome e nome", "ragione sociale"]),
          telefono: pick(r, ["telefono", "phone", "cellulare", "mobile", "tel"]),
          email: pick(r, ["email", "e-mail", "mail"]),
          azienda: pick(r, ["azienda", "company", "ragione sociale", "ditta"]),
          raw: r,
        }))
        .filter((c) => c.nome || c.telefono || c.email || c.azienda);
      setContacts((prev) => [...mapped, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'import");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.nome, c.telefono, c.email, c.azienda].some((v) => v.toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Contatti</h1>
        <p className="mt-1 text-sm text-slate-500">
          Portafoglio importato in attesa di lavorazione. I contatti qui presenti non appaiono nelle liste Privati / Clienti / Lead finche non vengono promossi.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Inbox className="h-5 w-5" />
            <span className="font-medium">Contatti da lavorare ({filtered.length})</span>
          </div>
          <div className="ml-auto flex flex-1 items-center gap-2 sm:flex-none">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca nome, telefono, email, azienda..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" /> Filtri
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="h-4 w-4" />
              {loading ? "Caricamento..." : "Importa CSV / Excel"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xls,.xlsx,.xlsm,.txt,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-2 border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-400">
              <Inbox className="h-8 w-8" />
            </div>
            <p className="text-sm text-slate-500">
              Nessun contatto importato. Usa il pulsante "Importa CSV / Excel" per caricare il tuo portafoglio.
            </p>
            <p className="text-xs text-slate-400">
              Formati supportati: .csv, .xls, .xlsx
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Nome</th>
                  <th className="px-5 py-3 text-left">Telefono</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Azienda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                        {c.nome || <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.telefono || <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3 text-slate-600">{c.email || <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3 text-slate-600">{c.azienda || <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}