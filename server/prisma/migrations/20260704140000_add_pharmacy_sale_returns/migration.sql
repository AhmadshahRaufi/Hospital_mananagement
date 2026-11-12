-- CreateTable
CREATE TABLE "pharmacy_sale_returns" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "saleId" TEXT,
    "patientId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundMethod" TEXT NOT NULL DEFAULT 'cash',
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_sale_return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "medicineId" TEXT,
    "batchId" TEXT,
    "quantity" INTEGER NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "pharmacy_sale_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_sale_returns_returnNumber_key" ON "pharmacy_sale_returns"("returnNumber");

-- AddForeignKey
ALTER TABLE "pharmacy_sale_returns" ADD CONSTRAINT "pharmacy_sale_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pharmacy_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_sale_returns" ADD CONSTRAINT "pharmacy_sale_returns_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_sale_returns" ADD CONSTRAINT "pharmacy_sale_returns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_sale_return_items" ADD CONSTRAINT "pharmacy_sale_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "pharmacy_sale_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_sale_return_items" ADD CONSTRAINT "pharmacy_sale_return_items_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_sale_return_items" ADD CONSTRAINT "pharmacy_sale_return_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "medicine_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
