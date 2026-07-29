CREATE TABLE "ColorAnalysisReport" (
    "id" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "clientRecordId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'signature_first_section',
    "draftJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorAnalysisReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ColorAnalysisReport_consultantId_clientRecordId_reportType_key" ON "ColorAnalysisReport"("consultantId", "clientRecordId", "reportType");
CREATE INDEX "ColorAnalysisReport_consultantId_idx" ON "ColorAnalysisReport"("consultantId");
CREATE INDEX "ColorAnalysisReport_clientRecordId_idx" ON "ColorAnalysisReport"("clientRecordId");
