import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
  icon: Icon = Sparkles,
  tone = "primary",
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  tone?: "primary" | "violet" | "sky" | "amber" | "emerald" | "rose";
}) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    violet: "from-violet-100 to-violet-50 text-violet-600",
    sky: "from-sky-100 to-sky-50 text-sky-600",
    amber: "from-amber-100 to-amber-50 text-amber-600",
    emerald: "from-emerald-100 to-emerald-50 text-emerald-600",
    rose: "from-rose-100 to-rose-50 text-rose-600",
  };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="grid place-items-center rounded-2xl border border-dashed border-border/70 bg-card p-12 text-center">
        <div
          className={`mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br ${tones[tone]}`}
        >
          <Icon className="h-9 w-9" />
        </div>
        <h2 className="mb-1 text-xl font-bold text-foreground">Funzione in arrivo</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Sezione <span className="font-semibold text-foreground">{title}</span> in costruzione. Dimmi
          cosa vuoi che mostri qui e la completiamo per prima.
        </p>
      </div>
    </div>
  );
}