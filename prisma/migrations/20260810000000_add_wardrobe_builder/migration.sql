CREATE TABLE "Wardrobe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerCustomerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "WardrobeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerCustomerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "WardrobeItemColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wardrobeItemId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "hexCode" TEXT NOT NULL,
    "paletteCode" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WardrobeItemColor_wardrobeItemId_fkey" FOREIGN KEY ("wardrobeItemId") REFERENCES "WardrobeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WardrobeMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wardrobeId" TEXT NOT NULL,
    "wardrobeItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WardrobeMembership_wardrobeId_fkey" FOREIGN KEY ("wardrobeId") REFERENCES "Wardrobe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WardrobeMembership_wardrobeItemId_fkey" FOREIGN KEY ("wardrobeItemId") REFERENCES "WardrobeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Wardrobe_ownerCustomerId_idx" ON "Wardrobe"("ownerCustomerId");
CREATE INDEX "Wardrobe_ownerCustomerId_updatedAt_idx" ON "Wardrobe"("ownerCustomerId", "updatedAt");
CREATE INDEX "WardrobeItem_ownerCustomerId_idx" ON "WardrobeItem"("ownerCustomerId");
CREATE INDEX "WardrobeItem_ownerCustomerId_itemType_idx" ON "WardrobeItem"("ownerCustomerId", "itemType");
CREATE INDEX "WardrobeItemColor_wardrobeItemId_displayOrder_idx" ON "WardrobeItemColor"("wardrobeItemId", "displayOrder");
CREATE INDEX "WardrobeMembership_wardrobeId_idx" ON "WardrobeMembership"("wardrobeId");
CREATE INDEX "WardrobeMembership_wardrobeItemId_idx" ON "WardrobeMembership"("wardrobeItemId");
CREATE UNIQUE INDEX "WardrobeMembership_wardrobeId_wardrobeItemId_key" ON "WardrobeMembership"("wardrobeId", "wardrobeItemId");
