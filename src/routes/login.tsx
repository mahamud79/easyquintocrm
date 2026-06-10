import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi · LeadValue" },
      { name: "description", content: "Accedi al tuo account LeadValue." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Accesso non riuscito", { description: error.message });
      return;
    }
    toast.success("Bentornato!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.99 0.01 90) 0%, oklch(0.98 0.012 240) 100%)",
      }}
    >
      <div className="mb-8 flex flex-col items-center gap-4">
        <Logo size="lg" showText={false} />
        <p className="text-sm text-muted-foreground">Accedi al tuo account</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.08)]"
      >
        <div className="space-y-5">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Link to="/login" className="text-xs font-medium text-primary hover:underline">
                Password dimenticata?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
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
            {loading ? "Accesso..." : "Accedi"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Non hai un account?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Registrati
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}