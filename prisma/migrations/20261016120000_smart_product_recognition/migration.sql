-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ai_confidence" DOUBLE PRECISION,
ADD COLUMN     "ai_estimated_price" INTEGER,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "recognition_provider" TEXT,
ADD COLUMN     "recognized_text" TEXT,
ADD COLUMN     "variant" TEXT;

-- CreateTable
CREATE TABLE "product_recognition_history" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER,
    "image_url" TEXT,
    "recognized_name" TEXT,
    "confidence" DOUBLE PRECISION,
    "provider" TEXT NOT NULL,
    "ai_model" TEXT,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_recognition_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_images" (
    "id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "product_recognition_history_created_at_idx" ON "product_recognition_history"("created_at");

-- CreateIndex
CREATE INDEX "product_recognition_history_product_id_idx" ON "product_recognition_history"("product_id");

-- AddForeignKey
ALTER TABLE "product_recognition_history" ADD CONSTRAINT "product_recognition_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

