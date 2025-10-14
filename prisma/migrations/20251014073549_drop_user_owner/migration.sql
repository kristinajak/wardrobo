/*
  Warnings:

  - You are about to drop the column `ownerId` on the `ClothingItem` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ClothingItem" DROP CONSTRAINT "ClothingItem_ownerId_fkey";

-- DropIndex
DROP INDEX "public"."ClothingItem_ownerId_idx";

-- AlterTable
ALTER TABLE "public"."ClothingItem" DROP COLUMN "ownerId";

-- DropTable
DROP TABLE "public"."User";
