-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "mrr" INTEGER NOT NULL,
    "arr" INTEGER NOT NULL,
    "churnRate" DOUBLE PRECISION NOT NULL,
    "customerCount" INTEGER NOT NULL,
    "netNewMRR" INTEGER NOT NULL,
    "arpc" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_date_key" ON "MetricSnapshot"("date");

-- CreateIndex
CREATE INDEX "MetricSnapshot_date_idx" ON "MetricSnapshot"("date");
