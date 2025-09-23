/*
  Warnings:

  - Added the required column `category` to the `ClothingItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ClothingCategory" AS ENUM ('TOP', 'BOTTOM', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORY', 'DRESS');

-- CreateEnum
CREATE TYPE "public"."ClothingSize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL');

-- AlterTable
ALTER TABLE "public"."ClothingItem" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "category" "public"."ClothingCategory" NOT NULL,
ADD COLUMN     "colors" TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fitNotes" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "materials" TEXT[],
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "sizes" "public"."ClothingSize"[];

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Image" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "itemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Image_itemId_idx" ON "public"."Image"("itemId");

-- CreateIndex
CREATE INDEX "ClothingItem_category_idx" ON "public"."ClothingItem"("category");

-- CreateIndex
CREATE INDEX "ClothingItem_ownerId_idx" ON "public"."ClothingItem"("ownerId");

-- AddForeignKey
ALTER TABLE "public"."ClothingItem" ADD CONSTRAINT "ClothingItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Image" ADD CONSTRAINT "Image_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
