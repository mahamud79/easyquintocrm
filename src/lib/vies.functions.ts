import { createServerFn } from "@tanstack/react-start";

type ViesResult = {
  valid: boolean;
  name?: string;
  address?: string;
  error?: string;
};

export const lookupPartitaIva = createServerFn({ method: "POST" })
  .inputValidator((input: { vat: string }) => {
    const vat = String(input?.vat ?? "").replace(/\D/g, "");
    if (vat.length !== 11) throw new Error("Partita IVA non valida");
    return { vat };
  })
  .handler(async ({ data }): Promise<ViesResult> => {
    // Primary: official EU VIES REST API
    try {
      const res = await fetch(
        "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; LeadValueCRM/1.0)",
          },
          body: JSON.stringify({ countryCode: "IT", vatNumber: data.vat }),
        },
      );
      if (res.ok) {
        const json: {
          valid?: boolean;
          isValid?: boolean;
          name?: string;
          address?: string;
        } = await res.json();
        const valid = !!(json.valid ?? json.isValid);
        if (valid) {
          const name =
            json.name && json.name.trim() && json.name.trim() !== "---"
              ? json.name.trim()
              : undefined;
          const address =
            json.address && json.address.trim() && json.address.trim() !== "---"
              ? json.address.trim()
              : undefined;
          return { valid: true, name, address };
        }
        // fall through to fallback if VIES says invalid (some IT VATs are valid but missing in VIES)
      } else {
        console.warn("[VIES] non-OK status", res.status);
      }
    } catch (e) {
      console.warn("[VIES] primary lookup failed", e);
    }

    // Fallback: openapi.it free Italian VAT registry (no key required for IVA pubblica endpoint)
    try {
      const res = await fetch(
        `https://www.italyvatnumber.com/api/get/${encodeURIComponent(data.vat)}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; LeadValueCRM/1.0)",
          },
        },
      );
      if (res.ok) {
        const json: { denominazione?: string; indirizzo?: string; comune?: string; provincia?: string } =
          await res.json();
        if (json.denominazione) {
          const address = [json.indirizzo, json.comune, json.provincia].filter(Boolean).join(" ");
          return { valid: true, name: json.denominazione, address: address || undefined };
        }
      }
    } catch (e) {
      console.warn("[VIES] fallback lookup failed", e);
    }

    return { valid: false, error: "Partita IVA non trovata nei registri pubblici" };
  });