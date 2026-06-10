import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCalendariStore } from "@/lib/calendari-store";
import { Logo, LogoMark, Wordmark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Users,
  Upload,
  Sparkles,
  FileText,
  Briefcase,
  Handshake,
  RefreshCw,
  Package,
  XCircle,
  ShieldOff,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Share2,
  BarChart3,
  Zap,
  ClipboardList,
  Image as ImageIcon,
  Bookmark,
  Banknote,
  Receipt,
  ScrollText,
  Landmark,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type NavSection = {
  title?: string;
  accent?: string;
  items: NavItem[];
};


function AuthLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <LogoMark size="lg" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const initials = (user.email ?? "?")
    .split("@")[0]
    .slice(0, 1)
    .toUpperCase();
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente";
  const { events } = useCalendariStore();
  // Il badge mostra il numero di appuntamenti non ancora completati ("Fatto").
  // Scompare appena tutti gli appuntamenti passano in stato "Fatto".
  const pendingCount = events.filter((e) => e.status !== "fatto").length;

  const sections: NavSection[] = [
    {
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/conversazioni", label: "Conversazioni", icon: MessageSquare },
        { to: "/calendari", label: "Calendari", icon: Calendar, badge: pendingCount || undefined },
      ],
    },
    {
      title: "Contatti",
      accent: "text-emerald-600",
      items: [
        { to: "/privati", label: "Privati", icon: Users },
        { to: "/import", label: "Import", icon: Upload },
      ],
    },
    {
      title: "CRM",
      accent: "text-sky-600",
      items: [
        { to: "/lead", label: "Lead", icon: Sparkles },
        { to: "/gestione-pratiche", label: "Gestione Pratiche", icon: FileText },
        { to: "/rinnovi", label: "Rinnovi", icon: RefreshCw },
        { to: "/magazzino", label: "Magazzino", icon: Package },
      ],
    },
    {
      title: "Commerciale",
      accent: "text-violet-600",
      items: [
        { to: "/prodotti", label: "Prodotti", icon: Package },
        { to: "/banche", label: "Banche", icon: Landmark },
        { to: "/aziende", label: "Aziende", icon: Building2 },
        { to: "/assicurazioni", label: "Assicurazioni", icon: ShieldCheck },
      ],
    },
    {
      title: "Strumenti",
      accent: "text-amber-600",
      items: [
        { to: "/automazione", label: "Automazione", icon: Zap },
        { to: "/contenuti", label: "Contenuti", icon: ImageIcon },
      ],
    },
    {
      title: "Finanza",
      accent: "text-emerald-600",
      items: [
        { to: "/preventivi-cessioni", label: "Preventivi Cessioni", icon: FileText },
        { to: "/preventivi-prestiti", label: "Preventivi Prestiti", icon: FileText },
        { to: "/preventivi-salvati", label: "Preventivi Salvati", icon: Bookmark },
      ],
    },
    {
      title: "Amministrazione",
      accent: "text-rose-600",
      items: [
        { to: "/liquidato", label: "Liquidato", icon: Banknote },
        { to: "/statistiche", label: "Statistiche", icon: BarChart3 },
      ],
    },
    {
      items: [{ to: "/impostazioni", label: "Impostazioni", icon: Settings }],
    },
  ];

  const SidebarContent = (
    <div className="flex h-full flex-col bg-card">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
        <Wordmark className="h-8" />
      </div>

      {/* User card */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section, idx) => (
          <div key={idx} className="mb-3">
            {section.title && (
              <div
                className={cn(
                  "px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.12em]",
                  section.accent ?? "text-muted-foreground",
                )}
              >
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/75 hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active && "text-primary")} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/60 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 text-foreground/70 hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          Esci
        </Button>
        <div className="mt-2 px-3 text-[10px] font-medium tracking-wider text-muted-foreground/70">
          CRM v1.66.0
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-secondary/40">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start border-r border-border/60 md:block">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-border/60 shadow-xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex w-full min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-card px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Logo size="sm" />
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}