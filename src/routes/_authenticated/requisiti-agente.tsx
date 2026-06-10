import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/requisiti-agente")({
  head: () => ({ meta: [{ title: "Requisiti Agente · LeadValue" }] }),
  component: () => (
    <PlaceholderPage title="Requisiti Agente" description="Documenti e compliance agente." icon={ShieldCheck} tone="rose" />
  ),
});