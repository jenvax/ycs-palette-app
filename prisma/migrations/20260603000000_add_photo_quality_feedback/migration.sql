-- CreateTable
CREATE TABLE "PhotoQualityEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT,
    "customerId" TEXT,
    "orderReference" TEXT,
    "imageUrl" TEXT,
    "secureFileReference" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiStatus" TEXT NOT NULL,
    "aiScore" INTEGER NOT NULL,
    "detectedIssuesJson" TEXT NOT NULL DEFAULT '[]',
    "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "rawChecksJson" TEXT NOT NULL DEFAULT '{}',
    "brightnessScore" INTEGER,
    "colorCast" TEXT,
    "shadowScore" INTEGER,
    "faceDetected" BOOLEAN,
    "faceCentered" BOOLEAN,
    "faceSizePercent" REAL,
    "glareDetected" BOOLEAN,
    "backgroundScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PhotoQualityReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "photoId" TEXT,
    "aiStatus" TEXT NOT NULL,
    "humanStatus" TEXT,
    "adminFeedback" TEXT NOT NULL,
    "aiIssueTagsJson" TEXT NOT NULL DEFAULT '[]',
    "humanIssueTagsJson" TEXT NOT NULL DEFAULT '[]',
    "adminNotes" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhotoQualityReview_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "PhotoQualityEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PhotoQualityEvaluation_customerId_idx" ON "PhotoQualityEvaluation"("customerId");

-- CreateIndex
CREATE INDEX "PhotoQualityEvaluation_photoId_idx" ON "PhotoQualityEvaluation"("photoId");

-- CreateIndex
CREATE INDEX "PhotoQualityEvaluation_aiStatus_idx" ON "PhotoQualityEvaluation"("aiStatus");

-- CreateIndex
CREATE INDEX "PhotoQualityEvaluation_uploadedAt_idx" ON "PhotoQualityEvaluation"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoQualityReview_evaluationId_key" ON "PhotoQualityReview"("evaluationId");

-- CreateIndex
CREATE INDEX "PhotoQualityReview_humanStatus_idx" ON "PhotoQualityReview"("humanStatus");

-- CreateIndex
CREATE INDEX "PhotoQualityReview_adminFeedback_idx" ON "PhotoQualityReview"("adminFeedback");

-- CreateIndex
CREATE INDEX "PhotoQualityReview_reviewedAt_idx" ON "PhotoQualityReview"("reviewedAt");
