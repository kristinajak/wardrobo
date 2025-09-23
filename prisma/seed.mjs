import { PrismaClient, Prisma } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

const users = [
  {
    email: "alex@example.com",
    name: "Alex Rivera",
  },
  {
    email: "jordan@example.com",
    name: "Jordan Kim",
  },
];

const clothingItems = [
  {
    name: "Indigo Relaxed Tee",
    category: "TOP",
    description:
      "Soft organic cotton tee with a relaxed fit and crew neckline.",
    price: 32.0,
    primaryColor: "blue",
    colors: ["blue", "white"],
    sizes: ["S", "M", "L"],
    materials: ["organic cotton"],
    brand: "Everyday Supply",
    fitNotes: "Runs slightly oversized; size down for a slimmer silhouette.",
    imageUrl: "/images/indigo-tee.jpg",
    ownerEmail: "alex@example.com",
    images: [
      {
        url: "/images/indigo-tee.svg",
        altText: "Indigo relaxed tee on hanger",
        isPrimary: true,
      },
    ],
  },
  {
    name: "Cropped Linen Shirt",
    category: "TOP",
    description: "Breathable linen button-up with cropped hem and sleeve tabs.",
    price: 54.5,
    primaryColor: "white",
    colors: ["white", "sand"],
    sizes: ["XS", "S", "M"],
    materials: ["linen"],
    brand: "Seabreeze",
    fitNotes: "True to size; pair with high-waisted bottoms.",
    imageUrl: "/images/linen-shirt.svg",
    ownerEmail: "alex@example.com",
    images: [
      {
        url: "/images/linen-shirt.jpg",
        altText: "White cropped linen shirt on mannequin",
        isPrimary: true,
      },
    ],
  },
  {
    name: "Coastal Chinos",
    category: "BOTTOM",
    description:
      "Lightweight stretch chinos with tapered leg and clean finish.",
    price: 68.0,
    primaryColor: "khaki",
    colors: ["khaki", "navy"],
    sizes: ["M", "L", "XL"],
    materials: ["cotton", "elastane"],
    brand: "Harborline",
    fitNotes: "Slim through the thigh with slight taper below the knee.",
    imageUrl: "/images/coastal-chinos.jpeg",
    ownerEmail: "jordan@example.com",
    images: [
      {
        url: "/images/coastal-chinos.svg",
        altText: "Khaki chinos folded on table",
        isPrimary: true,
      },
    ],
  },
  {
    name: "Skyline Tech Jacket",
    category: "OUTERWEAR",
    description: "Water-resistant shell with breathable mesh lining and hood.",
    price: 120.0,
    primaryColor: "gray",
    colors: ["gray", "black"],
    sizes: ["S", "M", "L", "XL"],
    materials: ["polyester", "nylon"],
    brand: "North Grid",
    fitNotes: "Athletic fit; designed to layer over light sweaters.",
    imageUrl: "/images/skyline-tech-jacket.jpg",
    ownerEmail: "jordan@example.com",
    images: [
      {
        url: "/images/skyline-tech-jacket.svg",
        altText: "Gray technical jacket on model",
        isPrimary: true,
      },
    ],
  },
  {
    name: "Summit Trail Boots",
    category: "FOOTWEAR",
    description: "Waterproof leather hiking boots with Vibram outsole.",
    price: 160.0,
    primaryColor: "brown",
    colors: ["brown", "olive"],
    sizes: ["M", "L"],
    materials: ["leather", "rubber"],
    brand: "SummitForge",
    fitNotes: "Break-in required; comes with dual-density insoles.",
    imageUrl: "/images/summit-trail-boots.svg",
    ownerEmail: "alex@example.com",
    images: [
      {
        url: "/images/summit-trail-boots.svg",
        altText: "Brown hiking boots with rugged sole",
        isPrimary: true,
      },
    ],
  },
  {
    name: "Urban Canvas Tote",
    category: "ACCESSORY",
    description:
      "Durable canvas tote with interior laptop sleeve and zip pocket.",
    price: 48.0,
    primaryColor: "black",
    colors: ["black", "olive"],
    sizes: [],
    materials: ["canvas", "recycled polyester"],
    brand: "CityThread",
    fitNotes: "15L capacity; fits up to a 15-inch laptop.",
    imageUrl: "/images/urban-canvas-tote.svg",
    ownerEmail: "jordan@example.com",
    images: [
      {
        url: "/images/urban-canvas-tote.svg",
        altText: "Black canvas tote bag hanging on chair",
        isPrimary: true,
      },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding Wardrobo data...");

  await prisma.$transaction([
    prisma.image.deleteMany(),
    prisma.clothingItem.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const createdUsers = await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name },
        create: user,
      })
    )
  );

  const userIdByEmail = createdUsers.reduce((acc, user) => {
    acc[user.email] = user.id;
    return acc;
  }, {});

  for (const item of clothingItems) {
    const { ownerEmail, images, price, ...rest } = item;

    await prisma.clothingItem.create({
      data: {
        ...rest,
        price: price != null ? new Prisma.Decimal(price) : null,
        owner: ownerEmail
          ? {
              connect: { id: userIdByEmail[ownerEmail] },
            }
          : undefined,
        images: images && images.length > 0 ? { create: images } : undefined,
      },
    });
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
