import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/fatturazione")({
  head: () => ({ meta: [{ title: "Fatturazione · LeadValue" }] }),
  component: () => (
    <PlaceholderPage title="Fatturazione" description="Fatture e provvigioni." icon={Receipt} tone="rose" />
  ),
});