ALTER TABLE "CustomPalette"
ADD COLUMN "visibleToVip" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CustomPalette_visibleToVip_idx" ON "CustomPalette"("visibleToVip");
