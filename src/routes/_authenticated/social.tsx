import { createFileRoute } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({ meta: [{ title: "Social · LeadValue" }] }),
  component: () => (
    <PlaceholderPage title="Social" description="Gestione canali social." icon={Share2} tone="sky" />
  ),
});