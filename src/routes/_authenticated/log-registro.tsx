import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/log-registro")({
  head: () => ({ meta: [{ title: "Log Registro · LeadValue" }] }),
  component: () => (
    <PlaceholderPage title="Log Registro" description="Audit log attività utenti." icon={ScrollText} tone="rose" />
  ),
});