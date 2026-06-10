import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/meta-ads")({
  head: () => ({ meta: [{ title: "Meta Ads · LeadValue" }] }),
  component: () => (
    <PlaceholderPage title="Meta Ads" description="Campagne Facebook e Instagram." icon={BarChart3} tone="sky" />
  ),
});