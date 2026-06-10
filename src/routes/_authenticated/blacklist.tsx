import { createFileRoute } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/blacklist")({
  head: () => ({ meta: [{ title: "Blacklist · LeadValue" }] }),
  component: () => (
    <PlaceholderPage
      title="Blacklist"
      description="Contatti da escludere dalle campagne."
      icon={ShieldOff}
      tone="rose"
    />
  ),
});