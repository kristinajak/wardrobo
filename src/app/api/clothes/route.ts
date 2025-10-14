import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClothingCategory } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";

const DEFAULT_PAGE_SIZE = 12;

type CategoryValue = (typeof ClothingCategory)[keyof typeof ClothingCategory];

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const asNumber = Number.parseInt(value, 10);
  return Number.isNaN(asNumber) || asNumber <= 0 ? fallback : asNumber;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = parseNumber(searchParams.get("perPage"), DEFAULT_PAGE_SIZE);
  const category = searchParams.get("category");
  const color = searchParams.get("color");
  const search = searchParams.get("search") ?? searchParams.get("q");

  const where: Prisma.ClothingItemWhereInput = {};
  const andConditions: Prisma.ClothingItemWhereInput[] = [];

  if (category) {
    const normalizedCategory = category.toUpperCase();
    const validCategories = Object.values(ClothingCategory);

    if ((validCategories as string[]).includes(normalizedCategory)) {
      where.category = normalizedCategory as CategoryValue;
    }
  }

  if (color) {
    const normalizedColor = color.toLowerCase();
    andConditions.push({
      OR: [
        { primaryColor: { equals: normalizedColor, mode: "insensitive" } },
        { colors: { has: normalizedColor } },
      ],
    });
  }

  if (search) {
    const query = search.trim();
    if (query.length > 0) {
      const orClauses: Prisma.ClothingItemWhereInput[] = [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
      ];
      const q = query.toLowerCase();
      if (q.includes("stripe")) {
        orClauses.push({ materials: { has: "striped" } });
      }
      andConditions.push({ OR: orClauses });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const skip = (page - 1) * pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.clothingItem.findMany({
      where,
      include: {
        images: {
          orderBy: { isPrimary: "desc" },
        },
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
