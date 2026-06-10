import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Registrati · LeadValue" },
      { name: "description", content: "Crea il tuo account LeadValue." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Registrazione non riuscita", { description: error.message });
      return;
    }
    toast.success("Account creato!", { description: "Controlla la tua email per confermare." });
    navigate({ to: "/login", replace: true });
  };

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.99 0.01 90) 0%, oklch(0.98 0.012 240) 100%)",
      }}
    >
      <div className="mb-8 flex flex-col items-center gap-4">
        <Logo size="lg" showText={false} />
        <h1 className="text-4xl font-bold tracking-tight text-navy">LeadValue</h1>
        <p className="text-sm text-muted-foreground">Crea il tuo account</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.08)]"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nome e cognome
            </Label>
            <Input
              id="fullName"
              required
              placeholder="Mario Rossi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-xl bg-secondary/70 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl bg-secondary/70 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              placeholder="Almeno 6 caratteri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl bg-secondary/70 border-border/50"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md transition hover:brightness-110"
          >
            {loading ? "Creazione..." : "Crea account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Hai già un account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Accedi
            </Link>
          </p>
        </div>
      </form>
      <p className="mt-8 text-xs text-muted-foreground">LeadValue · CRM per Agenti Finanziari</p>
    </main>
  );
}