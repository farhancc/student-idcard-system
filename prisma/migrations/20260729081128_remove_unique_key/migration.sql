/*
  Warnings:

  - You are about to drop the column `unique_key` on the `cardholders` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "cardholders_client_id_unique_key_key";

-- AlterTable
ALTER TABLE "cardholders" DROP COLUMN "unique_key";
