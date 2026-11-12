-- CreateTable: HospitalModuleRecord
-- Polymorphic store for the 10 hospital module workflows that previously
-- lived in browser localStorage. See schema.prisma for full rationale.
CREATE TABLE "hospital_module_records" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_module_records_pkey" PRIMARY KEY ("id")
);

-- Index for filtering by module type (the most common query pattern).
CREATE INDEX "hospital_module_records_type_idx" ON "hospital_module_records"("type");

-- Index for ordering by recency.
CREATE INDEX "hospital_module_records_createdAt_idx" ON "hospital_module_records"("createdAt");
