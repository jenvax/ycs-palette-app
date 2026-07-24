-- CreateTable
CREATE TABLE "CustomColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerCustomerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hexCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomPalette" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerCustomerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomPaletteColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customPaletteId" TEXT NOT NULL,
    "customColorId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomPaletteColor_customPaletteId_fkey" FOREIGN KEY ("customPaletteId") REFERENCES "CustomPalette" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomPaletteColor_customColorId_fkey" FOREIGN KEY ("customColorId") REFERENCES "CustomColor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomColor_ownerCustomerId_idx" ON "CustomColor"("ownerCustomerId");

-- CreateIndex
CREATE INDEX "CustomPalette_ownerCustomerId_idx" ON "CustomPalette"("ownerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPaletteColor_customPaletteId_customColorId_key" ON "CustomPaletteColor"("customPaletteId", "customColorId");

-- CreateIndex
CREATE INDEX "CustomPaletteColor_customPaletteId_displayOrder_idx" ON "CustomPaletteColor"("customPaletteId", "displayOrder");

-- CreateIndex
CREATE INDEX "CustomPaletteColor_customColorId_idx" ON "CustomPaletteColor"("customColorId");
