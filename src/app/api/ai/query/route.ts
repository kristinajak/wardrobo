import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 12;
export const runtime = "nodejs";

type AiExtraction = {
  category?: string | null;
  color?: string | null;
  search?: string | null;
  brand?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  clothingType?: string | null;
  pattern?: string | null;
  sleeve?: string | null;
  graphic?: string | null;
  features?: string[] | null;
};

function normalizeExtraction(raw: unknown): AiExtraction {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const coerceString = (v: unknown) => (typeof v === "string" ? v : null);
  const coerceNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const coerceStringArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;

  const category = coerceString(obj.category)?.toUpperCase() ?? null;
  const color = coerceString(obj.color)?.toLowerCase() ?? null;
  const search = coerceString(obj.search) ?? null;
  const brand = coerceString(obj.brand) ?? null;
  const priceMin = coerceNumber(obj.priceMin);
  const priceMax = coerceNumber(obj.priceMax);
  const clothingType = coerceString(obj.clothingType)?.toLowerCase() ?? null;
  const pattern = coerceString(obj.pattern)?.toLowerCase() ?? null;
  const sleeve = coerceString(obj.sleeve)?.toLowerCase() ?? null;
  const graphic = coerceString(obj.graphic)?.toLowerCase() ?? null;
  const features = coerceStringArray(obj.features);

  return {
    category,
    color,
    search,
    brand,
    priceMin,
    priceMax,
    clothingType,
    pattern,
    sleeve,
    graphic,
    features,
  };
}

async function extractFiltersWithOpenAI(prompt: string): Promise<AiExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content:
            "Extract structured clothing search filters from the user's request. Return ONLY a compact JSON object with these keys (all optional/nullable): category (TOP|BOTTOM|OUTERWEAR|FOOTWEAR|ACCESSORY|DRESS), color (lowercase color word), clothingType (tshirt|shirt|sweatshirt|hoodie|sweater|jeans|pants|shorts|jacket|coat|blazer|dress|skirt|blouse), pattern (striped|dotted|floral|graphic|solid), sleeve (short|long|sleeveless), graphic (description of any print/logo/design like 'snake' or 'star logo'), features (array of strings like ['hood','zipper','buttons']), brand (brand name), priceMin/priceMax (numbers), search (ONLY use if query doesn't fit structured fields - free text fallback). CRITICAL: Only extract fields that are EXPLICITLY mentioned in the user's query. Do NOT infer or guess values. If a field is not mentioned, set it to null. For example, if the user says 'blue t-shirt', do NOT set pattern to 'solid' - leave pattern as null.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  type ChatCompletionsResponse = {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const data: ChatCompletionsResponse = await response.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return {};

  try {
    const match = content.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : content;
    const parsed = JSON.parse(jsonText);
    return normalizeExtraction(parsed);
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  const {
    prompt,
    page: pageRaw,
    perPage: perPageRaw,
    color: seedColor,
  } = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    page?: number;
    perPage?: number;
    color?: string | null;
  };

  const page = typeof pageRaw === "number" ? pageRaw : 1;
  const pageSize =
    typeof perPageRaw === "number" ? perPageRaw : DEFAULT_PAGE_SIZE;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  let extracted: AiExtraction = {};
  try {
    extracted = await extractFiltersWithOpenAI(prompt);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  type Where = Record<string, unknown> & {
    AND?: Array<Record<string, unknown>>;
  };
  const where: Where = {};
  const andConditions: Array<Record<string, unknown>> = [];

  const rawColor = (seedColor ?? extracted.color ?? "").toString();
  const colorCandidate = rawColor ? rawColor.toLowerCase() : "";
  if (colorCandidate) {
    andConditions.push({
      OR: [
        { primaryColor: { equals: colorCandidate, mode: "insensitive" } },
        { colors: { has: colorCandidate } },
      ],
    });
  }

  const materialConditions: Array<Record<string, unknown>> = [];

  if (extracted.clothingType) {
    const typeMap: Record<string, string> = {
      tshirt: "type:tshirt",
      shirt: "type:shirt",
      sweatshirt: "type:sweatshirt",
      hoodie: "type:hoodie",
      sweater: "type:sweater",
      jeans: "type:jeans",
      pants: "type:pants",
      shorts: "type:shorts",
      jacket: "type:jacket",
      coat: "type:coat",
      blazer: "type:blazer",
      dress: "type:dress",
      skirt: "type:skirt",
      blouse: "type:blouse",
    };
    const token = typeMap[extracted.clothingType];
    if (token) {
      materialConditions.push({ materials: { has: token } });
    }
  }

  if (extracted.pattern) {
    const patternMap: Record<string, string> = {
      striped: "pattern:striped",
      dotted: "pattern:dotted",
      floral: "pattern:floral",
      graphic: "pattern:graphic",
      solid: "pattern:solid",
    };
    const token = patternMap[extracted.pattern];
    if (token) {
      materialConditions.push({ materials: { has: token } });
    }
  }

  if (extracted.sleeve) {
    const sleeveMap: Record<string, string> = {
      short: "sleeve:short",
      long: "sleeve:long",
      sleeveless: "sleeve:sleeveless",
    };
    const token = sleeveMap[extracted.sleeve];
    if (token) {
      materialConditions.push({ materials: { has: token } });
    }
  }

  if (extracted.graphic) {
    const graphicDesc = extracted.graphic.trim().toLowerCase();
    const orGraphicClauses: Array<Record<string, unknown>> = [
      { materials: { has: `graphic:${graphicDesc}` } },
    ];

    const words = graphicDesc.split(/\s+/).filter((w) => w.length > 2);
    words.forEach((word) => {
      orGraphicClauses.push({ materials: { has: `graphic:${word}` } });
    });

    materialConditions.push({ OR: orGraphicClauses });
  }

  if (extracted.features && extracted.features.length > 0) {
    extracted.features.forEach((feature) => {
      const f = feature.toLowerCase();
      if (f.includes("hood")) {
        materialConditions.push({ materials: { has: "hood" } });
      }
      if (f.includes("zip")) {
        materialConditions.push({ materials: { has: "closure:zipper" } });
      }
      if (f.includes("button")) {
        materialConditions.push({ materials: { has: "closure:buttons" } });
      }
    });
  }

  if (materialConditions.length > 0) {
    andConditions.push(...materialConditions);
  }

  const searchQuery = (extracted.search ?? "").toString().trim();
  if (searchQuery && materialConditions.length === 0) {
    const textSearchClauses: Array<Record<string, unknown>> = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
      { brand: { contains: searchQuery, mode: "insensitive" } },
      { materials: { has: `graphic:${searchQuery}` } },
    ];
    andConditions.push({ OR: textSearchClauses });
  }

  if (extracted.brand) {
    andConditions.push({
      brand: { contains: extracted.brand, mode: "insensitive" },
    });
  }

  if (
    typeof extracted.priceMin === "number" ||
    typeof extracted.priceMax === "number"
  ) {
    const gte =
      typeof extracted.priceMin === "number" ? extracted.priceMin : undefined;
    const lte =
      typeof extracted.priceMax === "number" ? extracted.priceMax : undefined;
    const priceFilter = {
      ...(gte !== undefined ? { gte } : {}),
      ...(lte !== undefined ? { lte } : {}),
    };
    andConditions.push({ price: priceFilter });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const skip = (page - 1) * pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.clothingItem.findMany({
      where,
      include: {
        images: { orderBy: { isPrimary: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.clothingItem.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    meta: {
      page,
      perPage: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
