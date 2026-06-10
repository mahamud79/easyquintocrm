import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/form-contatti")({
  head: () => ({ meta: [{ title: "Form contatti · LeadValue" }] }),
  component: () => (
    <PlaceholderPage title="Form contatti" description="Moduli di acquisizione lead." icon={ClipboardList} tone="violet" />
  ),
});