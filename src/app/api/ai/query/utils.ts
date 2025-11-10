export type AiExtraction = {
  category?: string | null;
  color?: string | null;
  search?: string | null;
  brand?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
};

export function normalizeExtraction(raw: unknown): AiExtraction {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const coerceString = (v: unknown) => (typeof v === "string" ? v : null);
  const coerceNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const category = coerceString(obj.category)?.toUpperCase() ?? null;
  const color = coerceString(obj.color)?.toLowerCase() ?? null;
  const search = coerceString(obj.search) ?? null;
  const brand = coerceString(obj.brand) ?? null;
  const priceMin = coerceNumber(obj.priceMin);
  const priceMax = coerceNumber(obj.priceMax);

  return { category, color, search, brand, priceMin, priceMax };
}

