import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
const VISION_TIMEOUT_MS = 12_000;

type VisionExtraction = {
  primaryColor?: string | null;
  colors?: string[] | null;
  category?: string | null;
  features?: string[] | null;
  clothingType?: string | null;
  sleeve?: string | null;
  pattern?: string | null;
  graphicDescription?: string | null;
  closure?: string | null;
};

const ALLOWED_CATEGORIES = [
  "TOP",
  "BOTTOM",
  "OUTERWEAR",
  "FOOTWEAR",
  "ACCESSORY",
  "DRESS",
] as const;

type CategoryValue = (typeof ALLOWED_CATEGORIES)[number];

function normalizeCategory(
  value: string | null | undefined
): CategoryValue | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (ALLOWED_CATEGORIES as readonly string[]).includes(upper)
    ? (upper as CategoryValue)
    : null;
}

function normalizeColors(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((c) => (typeof c === "string" ? c.trim().toLowerCase() : ""))
    .filter(Boolean);
}

function normalizeFeatures(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
    .map((v) => (v.startsWith("stripe") ? "pattern:striped" : v))
    .map((v) =>
      v.includes("polka") || v.includes("dot") ? "pattern:dotted" : v
    )
    .map((v) =>
      v.includes("floral") || v.includes("flower") ? "pattern:floral" : v
    )
    .map((v) => (v === "zipper" ? "closure:zipper" : v))
    .map((v) => (v === "buttons" || v === "button" ? "closure:buttons" : v))
    .filter(Boolean);
}

function buildDerivedFeatureTokens(v: VisionExtraction): string[] {
  const tokens: string[] = [];
  const typeMap: Record<string, string> = {
    tshirt: "type:tshirt",
    "t-shirt": "type:tshirt",
    tee: "type:tshirt",
    shirt: "type:shirt",
    jeans: "type:jeans",
    pants: "type:pants",
    trousers: "type:pants",
    chinos: "type:pants",
    shorts: "type:shorts",
    jacket: "type:jacket",
    coat: "type:coat",
    blazer: "type:blazer",
    dress: "type:dress",
    skirt: "type:skirt",
    sweater: "type:sweater",
    sweatshirt: "type:sweatshirt",
    hoodie: "type:hoodie",
    blouse: "type:blouse",
  };
  const sleeveMap: Record<string, string> = {
    short: "sleeve:short",
    long: "sleeve:long",
    sleeveless: "sleeve:sleeveless",
  };
  const patternMap: Record<string, string> = {
    striped: "pattern:striped",
    stripes: "pattern:striped",
    dotted: "pattern:dotted",
    polka: "pattern:dotted",
    "polka-dot": "pattern:dotted",
    floral: "pattern:floral",
    flower: "pattern:floral",
    solid: "pattern:solid",
    graphic: "pattern:graphic",
  };

  const ct = (v.clothingType || "").toLowerCase();
  if (ct && typeMap[ct]) tokens.push(typeMap[ct]);

  const sl = (v.sleeve || "").toLowerCase();
  if (sl && sleeveMap[sl]) tokens.push(sleeveMap[sl]);

  const pat = (v.pattern || "").toLowerCase();
  const patKey = Object.keys(patternMap).find((k) => pat.includes(k));
  if (patKey) tokens.push(patternMap[patKey]);

  const clos = (v.closure || "").toLowerCase();
  if (clos.includes("zip")) tokens.push("closure:zipper");
  if (clos.includes("button")) tokens.push("closure:buttons");

  const feats = Array.isArray(v.features)
    ? v.features.map((x) => (typeof x === "string" ? x.toLowerCase() : ""))
    : [];
  if (feats.some((f) => f.includes("crew"))) tokens.push("neck:crew");
  if (feats.some((f) => f.includes("v-neck") || f.includes("v neck")))
    tokens.push("neck:v");
  if (feats.some((f) => f.includes("polo"))) tokens.push("type:shirt");

  // Handle graphic descriptions - extract individual keywords for better searchability
  const graphicDesc = (v.graphicDescription || "").toLowerCase().trim();
  if (graphicDesc) {
    tokens.push(`graphic:${graphicDesc}`);

    const stopWords = new Set([
      "on",
      "with",
      "and",
      "the",
      "a",
      "an",
      "of",
      "in",
      "at",
    ]);
    const words = graphicDesc
      .split(/[\s,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !stopWords.has(w));

    words.forEach((word) => {
      tokens.push(`graphic:${word}`);
    });
  }

  return tokens;
}

async function analyzeImageWithVision(
  file: File,
  publicUrl: string
): Promise<VisionExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return {};

  let imageSource: { url: string };
  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type || "image/jpeg"};base64,${base64}`;
    imageSource = { url: dataUrl };
  } catch {
    imageSource = { url: publicUrl };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that extracts apparel attributes from an image. Return ONLY JSON with keys: primaryColor (string|nullable lowercase), colors (array of lowercase strings), category (one of: TOP,BOTTOM,OUTERWEAR,FOOTWEAR,ACCESSORY,DRESS or null), clothingType (REQUIRED; one of: tshirt, shirt, jeans, jacket, dress, skirt, shorts, sweater, sweatshirt, hoodie, coat, blouse, pants), sleeve (short,long,sleeveless|null), pattern (striped,dotted,floral,solid,graphic|null), graphicDescription (string describing any prints, logos, animals, text, or designs on the garment|null), closure (zipper,buttons,none|null), features (array of short tokens like 'zipper','buttons','stripe','hood','crewneck','v-neck').",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze the image and return the JSON object only.",
              },
              { type: "image_url", image_url: imageSource },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 300,
      }),
    });

    if (!response.ok) return {};
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content) as VisionExtraction;
      return parsed ?? {};
    } catch {
      return {};
    }
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 415 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const name = String(form.get("name") || "Untitled Item");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const MAX_SERVER_UPLOAD_BYTES = Math.floor(4.5 * 1024 * 1024);
  if (file.size > MAX_SERVER_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: "File too large (>4.5MB)",
      },
      { status: 413 }
    );
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  const timePrefix = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  let publicUrl: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const key = `wardrobo/${timePrefix}-${safeName}`;
    const blob = await put(key, file, { access: "public" });
    publicUrl = blob.url;
  } else {
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filename = `${timePrefix}-${safeName}`;
    const filePath = join(uploadsDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);
    publicUrl = `/uploads/${filename}`;
  }

  // Optional AI vision enrichment
  let vision: VisionExtraction = {};
  try {
    vision = await analyzeImageWithVision(file, publicUrl);
  } catch {
    vision = {};
  }

  const inferredCategory =
    normalizeCategory(vision.category) ?? ("TOP" as CategoryValue);
  const inferredPrimaryColor =
    (vision.primaryColor || "").trim().toLowerCase() || null;
  const inferredColors = normalizeColors(vision.colors);
  const inferredFeatures = [
    ...normalizeFeatures(vision.features),
    ...buildDerivedFeatureTokens(vision),
  ];

  try {
    const created = await prisma.clothingItem.create({
      data: {
        name,
        category: inferredCategory,
        description: null,
        price: null,
        primaryColor: inferredPrimaryColor,
        colors: inferredColors,
        sizes: [],
        materials: inferredFeatures,
        imageUrl: publicUrl,
        brand: null,
        metadata:
          Object.keys(vision || {}).length > 0
            ? (vision as unknown as Prisma.InputJsonValue)
            : undefined,
        images: {
          create: [{ url: publicUrl, altText: name, isPrimary: true }],
        },
      },
      include: {
        images: true,
      },
    });
    return NextResponse.json({ data: created });
  } catch (err) {
    console.error("/api/upload database error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Upload failed", details: errorMessage },
      { status: 500 }
    );
  }
}
