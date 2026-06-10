import { createFileRoute } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/pratiche-perse")({
  head: () => ({ meta: [{ title: "Pratiche Perse · LeadValue" }] }),
  component: () => (
    <PlaceholderPage
      title="Pratiche Perse"
      description="Archivio delle opportunità non andate a buon fine."
      icon={XCircle}
      tone="rose"
    />
  ),
});