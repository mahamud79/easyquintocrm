import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const searchPlacesAutocomplete = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    const q = String(input?.query ?? "").trim().slice(0, 200);
    return { query: q };
  })
  .handler(async ({ data }) => {
    if (data.query.length < 3) return { suggestions: [] as { id: string; text: string }[] };
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) throw new Error("Google Maps connector not configured");

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: data.query,
        languageCode: "it",
        regionCode: "IT",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Places autocomplete failed (${res.status}): ${body}`);
    }
    const json: any = await res.json();
    const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];
    const out = suggestions
      .map((s: any) => {
        const p = s?.placePrediction;
        if (!p) return null;
        return {
          id: String(p.placeId ?? p.place ?? Math.random()),
          text: String(p?.text?.text ?? ""),
        };
      })
      .filter((x: any) => x && x.text);
    return { suggestions: out as { id: string; text: string }[] };
  });