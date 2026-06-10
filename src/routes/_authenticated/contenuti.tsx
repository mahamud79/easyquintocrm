import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Upload,
  Folder,
  FileText,
  Video as VideoIcon,
  File as FileIcon,
  Trash2,
  Download,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadPersisted, savePersisted } from "@/lib/persist";
import { toast } from "sonner";

type ContentKind = "image" | "pdf" | "video" | "document";

type ContentItem = {
  id: string;
  name: string;
  kind: ContentKind;
  mime: string;
  size: number;
  dataUrl: string;
  createdAt: string;
};

const STORE_KEY = "contenuti";
const load = () => loadPersisted<ContentItem[]>(STORE_KEY, []);
const save = (v: ContentItem[]) => savePersisted(STORE_KEY, v);

function detectKind(mime: string, name: string): ContentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const Route = createFileRoute("/_authenticated/contenuti")({
  head: () => ({ meta: [{ title: "Contenuti · LeadValue" }] }),
  component: ContenutiPage,
});

function ContenutiPage() {
  const [items, setItems] = useState<ContentItem[]>(() => load());
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | ContentKind>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const persist = (next: ContentItem[]) => {
    setItems(next);
    save(next);
  };

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: ContentItem[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name} è troppo grande (max 8MB)`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(f);
        next.push({
          id: crypto.randomUUID(),
          name: f.name,
          kind: detectKind(f.type, f.name),
          mime: f.type || "application/octet-stream",
          size: f.size,
          dataUrl,
          createdAt: new Date().toISOString(),
        });
      } catch {
        toast.error(`Impossibile caricare ${f.name}`);
      }
    }
    if (next.length) {
      persist([...next, ...items]);
      toast.success(`${next.length} file caricato/i`);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (id: string) => persist(items.filter((i) => i.id !== id));

  const counts = useMemo(
    () => ({
      all: items.length,
      image: items.filter((i) => i.kind === "image").length,
      pdf: items.filter((i) => i.kind === "pdf").length,
      video: items.filter((i) => i.kind === "video").length,
      document: items.filter((i) => i.kind === "document").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (tab !== "all" && i.kind !== tab) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ImageIcon className="h-7 w-7 text-rose-500" /> Contenuti
          </h1>
          <p className="text-sm text-muted-foreground">Libreria file e immagini per email, WhatsApp e invii</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
          <Button onClick={() => inputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> Carica file
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1"><Folder className="h-3.5 w-3.5" /> Tutti ({counts.all})</TabsTrigger>
            <TabsTrigger value="image" className="gap-1"><ImageIcon className="h-3.5 w-3.5" /> Image ({counts.image})</TabsTrigger>
            <TabsTrigger value="pdf" className="gap-1"><FileText className="h-3.5 w-3.5" /> Pdf ({counts.pdf})</TabsTrigger>
            <TabsTrigger value="video" className="gap-1"><VideoIcon className="h-3.5 w-3.5" /> Video ({counts.video})</TabsTrigger>
            <TabsTrigger value="document" className="gap-1"><FileIcon className="h-3.5 w-3.5" /> Document ({counts.document})</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} />
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca file..."
            className="pl-8 w-64"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-600">
              <Folder className="h-8 w-8" />
            </div>
            <div>
              <div className="font-semibold">Nessun file caricato</div>
              <div className="text-sm text-muted-foreground">Clicca "Carica file" per iniziare</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((it) => (
            <Card key={it.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {it.kind === "image" ? (
                  <img src={it.dataUrl} alt={it.name} className="h-full w-full object-cover" />
                ) : it.kind === "video" ? (
                  <video src={it.dataUrl} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    {it.kind === "pdf" ? <FileText className="h-12 w-12 text-rose-500" /> : <FileIcon className="h-12 w-12" />}
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <div className="truncate text-sm font-medium" title={it.name}>{it.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{fmtSize(it.size)}</div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  <a href={it.dataUrl} download={it.name}>
                    <Button size="icon" variant="ghost" type="button">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(it.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}