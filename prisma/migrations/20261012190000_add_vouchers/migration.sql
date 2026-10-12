CREATE TYPE "VoucherDiscountType" AS ENUM ('PERCENT', 'FIXED_AMOUNT');
CREATE TYPE "VoucherDistribution" AS ENUM ('ACCOUNT', 'SECRET');

CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "VoucherDiscountType" NOT NULL,
    "distribution" "VoucherDistribution" NOT NULL DEFAULT 'SECRET',
    "discountValue" DECIMAL(14,2) NOT NULL,
    "minOrderAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maxDiscountAmount" DECIMAL(14,2),
    "applicableOrderTypes" "OrderType"[] DEFAULT ARRAY['DINE_IN', 'TAKEAWAY', 'DELIVERY']::"OrderType"[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomerLimit" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders" ADD COLUMN "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "voucherId" TEXT,
ADD COLUMN "voucherCode" TEXT;

CREATE TABLE "voucher_usages" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "discountAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voucher_usages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "voucher_wallets" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voucher_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");
CREATE INDEX "vouchers_isActive_startsAt_endsAt_idx" ON "vouchers"("isActive", "startsAt", "endsAt");
CREATE UNIQUE INDEX "voucher_usages_orderId_key" ON "voucher_usages"("orderId");
CREATE INDEX "voucher_usages_voucherId_customerId_idx" ON "voucher_usages"("voucherId", "customerId");
CREATE UNIQUE INDEX "voucher_wallets_voucherId_customerId_key" ON "voucher_wallets"("voucherId", "customerId");
CREATE INDEX "voucher_wallets_customerId_receivedAt_idx" ON "voucher_wallets"("customerId", "receivedAt" DESC);
ALTER TABLE "orders" ADD CONSTRAINT "orders_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "voucher_wallets" ADD CONSTRAINT "voucher_wallets_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voucher_wallets" ADD CONSTRAINT "voucher_wallets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
