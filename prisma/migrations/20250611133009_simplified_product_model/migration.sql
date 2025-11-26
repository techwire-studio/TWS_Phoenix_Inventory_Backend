/*
  Warnings:

  - The primary key for the `Product` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `addedToCart` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `cpn` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `datasheetLink` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `ltwks` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `manufacturer` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `mfrPartNumber` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `moq` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `specifications` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `spq` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `stockQty` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the `Categories` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `category` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropIndex
DROP INDEX "Product_categoryId_idx";

-- DropIndex
DROP INDEX "Product_manufacturer_idx";

-- DropIndex
DROP INDEX "Product_mfrPartNumber_idx";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "totalAmount" SET DEFAULT 0.0;

-- AlterTable
ALTER TABLE "Product" DROP CONSTRAINT "Product_pkey",
DROP COLUMN "addedToCart",
DROP COLUMN "categoryId",
DROP COLUMN "cpn",
DROP COLUMN "datasheetLink",
DROP COLUMN "id",
DROP COLUMN "ltwks",
DROP COLUMN "manufacturer",
DROP COLUMN "mfrPartNumber",
DROP COLUMN "moq",
DROP COLUMN "remarks",
DROP COLUMN "source",
DROP COLUMN "specifications",
DROP COLUMN "spq",
DROP COLUMN "stockQty",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "otherDetails" JSONB,
ADD COLUMN     "price" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL,
ADD COLUMN     "subCategory" TEXT,
ALTER COLUMN "name" SET NOT NULL,
ADD CONSTRAINT "Product_pkey" PRIMARY KEY ("productId");

-- DropTable
DROP TABLE "Categories";

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_subCategory_idx" ON "Product"("subCategory");
