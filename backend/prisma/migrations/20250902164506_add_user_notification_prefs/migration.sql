-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifyInvoiceOverdue" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifyNewClientAdded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifyNewInvoice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifyPaymentReceived" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifyWeeklySummary" BOOLEAN NOT NULL DEFAULT false;
