import ClothingExplorer from "@/components/clothing-explorer";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 12;

export default async function Home() {
  // Fetch initial data on the server for instant display
  const [items, total] = await prisma.$transaction([
    prisma.clothingItem.findMany({
      include: {
        images: {
          orderBy: { isPrimary: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.clothingItem.count(),
  ]);

  const initialData = {
    data: items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price?.toString() ?? null,
      primaryColor: item.primaryColor,
      imageUrl: item.imageUrl,
      brand: item.brand,
      createdAt: item.createdAt.toISOString(),
      colors: item.colors,
      sizes: item.sizes,
      images: item.images.map((img) => ({
        id: img.id,
        url: img.url,
        altText: img.altText,
        isPrimary: img.isPrimary,
      })),
    })),
    meta: {
      page: 1,
      perPage: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  };

  return <ClothingExplorer initialData={initialData} />;
}
