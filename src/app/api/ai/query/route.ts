import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClothingCategory } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";

const DEFAULT_PAGE_SIZE = 12;

type CategoryValue = (typeof ClothingCategory)[keyof typeof ClothingCategory];

type AiExtraction = {
  category?: string | null;
  color?: string | null;
  search?: string | null;
  brand?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
};

function normalizeExtraction(raw: unknown): AiExtraction {
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
            "Extract structured clothing search filters from the user's request. Return ONLY a compact JSON object with keys: category, color, search, brand, priceMin, priceMax. category must be one of: TOP, BOTTOM, OUTERWEAR, FOOTWEAR, ACCESSORY, DRESS, or null. color should be a lowercase simple color word if present (e.g., blue). search is a concise keyword phrase (e.g., 'blue t shirt'). brand is a single brand name if present. priceMin/priceMax are numbers if mentioned, else null.",
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
    category: seedCategory,
    color: seedColor,
  } = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    page?: number;
    perPage?: number;
    category?: string | null;
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

  const where: Prisma.ClothingItemWhereInput = {};
  const andConditions: Prisma.ClothingItemWhereInput[] = [];

  const validCategories = Object.values(ClothingCategory) as string[];
  const categoryCandidate = (seedCategory ?? extracted.category ?? "")
    .toString()
    .toUpperCase();
  if (validCategories.includes(categoryCandidate)) {
    where.category = categoryCandidate as CategoryValue;
  }

  const colorCandidate = (seedColor ?? extracted.color ?? "")
    .toString()
    .toLowerCase();
  if (colorCandidate) {
    andConditions.push({
      OR: [
        { primaryColor: { equals: colorCandidate, mode: "insensitive" } },
        { colors: { has: colorCandidate } },
      ],
    });
  }

  const searchQuery = (extracted.search ?? "").toString().trim();
  const hasColorFilter = Boolean(colorCandidate);
  if (searchQuery && !hasColorFilter) {
    const orClauses: Prisma.ClothingItemWhereInput[] = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
      { brand: { contains: searchQuery, mode: "insensitive" } },
    ];
    const q = searchQuery.toLowerCase();
    // pattern mappings
    if (q.includes("stripe"))
      orClauses.push({ materials: { has: "pattern:striped" } });
    if (q.includes("polka") || q.includes("dotted") || q.includes("dot"))
      orClauses.push({ materials: { has: "pattern:dotted" } });
    if (q.includes("floral") || q.includes("flower"))
      orClauses.push({ materials: { has: "pattern:floral" } });

    // closure and hood
    if (q.includes("zip"))
      orClauses.push({ materials: { has: "closure:zipper" } });
    if (q.includes("button"))
      orClauses.push({ materials: { has: "closure:buttons" } });
    if (q.includes("hood")) orClauses.push({ materials: { has: "hood" } });

    // sleeve
    if (q.includes("short sleeve"))
      orClauses.push({ materials: { has: "sleeve:short" } });
    if (q.includes("long sleeve"))
      orClauses.push({ materials: { has: "sleeve:long" } });
    if (q.includes("sleeveless"))
      orClauses.push({ materials: { has: "sleeve:sleeveless" } });

    // type mappings
    if (q.includes("t-shirt") || q.includes("tshirt") || q.includes("tee")) {
      orClauses.push({ materials: { has: "type:tshirt" } });
      // Fallback to category for older items without vision type tokens
      orClauses.push({ category: ClothingCategory.TOP as CategoryValue });
    }
    if (q.includes("shirt"))
      orClauses.push({ materials: { has: "type:shirt" } });
    if (q.includes("jeans"))
      orClauses.push({ materials: { has: "type:jeans" } });
    if (q.includes("jacket"))
      orClauses.push({ materials: { has: "type:jacket" } });
    if (q.includes("dress"))
      orClauses.push({ materials: { has: "type:dress" } });
    if (q.includes("skirt"))
      orClauses.push({ materials: { has: "type:skirt" } });

    andConditions.push({ OR: orClauses });
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
    andConditions.push({
      price: priceFilter as unknown as NonNullable<
        Prisma.ClothingItemWhereInput["price"]
      >,
    });
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
