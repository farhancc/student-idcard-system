-- AlterTable
ALTER TABLE "press" ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_sub_id" TEXT,
ADD COLUMN     "trial_ends_at" TIMESTAMP(3);
