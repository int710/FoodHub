CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "app_name" TEXT NOT NULL DEFAULT 'FoodHub',
    "restaurant_name" TEXT NOT NULL DEFAULT 'FoodHub',
    "support_email" TEXT,
    "support_phone" TEXT,
    "address" TEXT,
    "logo_url" TEXT,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "service_fee_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "default_delivery_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "system_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
