import assert from "node:assert/strict";
import test from "node:test";

import { normalizePaletteCode } from "../app/services/palette-codes.server.js";

test("normalizes only supported palette codes for trade access", () => {
  assert.equal(normalizePaletteCode(" ccl "), "CCL");
  assert.equal(normalizePaletteCode("swmg"), "SWMG");
  assert.equal(normalizePaletteCode("not-a-palette"), "");
});
