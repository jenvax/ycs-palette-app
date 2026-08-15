export const PALETTE_CODES = new Set([
  "CCL", "CCM", "CCD",
  "CWL", "CWM", "CWD",
  "SCL", "SCM", "SCD",
  "SWL", "SWM", "SWD",
  "CWLG", "CWMG", "CWDG",
  "SWLG", "SWMG", "SWDG",
  "LO", "MO", "DO"
]);

export const PALETTE_NAMES = {
  CCL: "Clear Cool Light",
  CCM: "Clear Cool Medium",
  CCD: "Clear Cool Deep",
  CWL: "Clear Warm Light",
  CWM: "Clear Warm Medium",
  CWD: "Clear Warm Deep",
  SCL: "Soft Cool Light",
  SCM: "Soft Cool Medium",
  SCD: "Soft Cool Deep",
  SWL: "Soft Warm Light",
  SWM: "Soft Warm Medium",
  SWD: "Soft Warm Deep",
  CWLG: "Clear Warm Light for Gray Hair",
  CWMG: "Clear Warm Medium for Gray Hair",
  CWDG: "Clear Warm Deep for Gray Hair",
  SWLG: "Soft Warm Light for Gray Hair",
  SWMG: "Soft Warm Medium for Gray Hair",
  SWDG: "Soft Warm Deep for Gray Hair",
  LO: "Light Olive",
  MO: "Medium Olive",
  DO: "Deep Olive"
};

export function normalizePaletteCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return PALETTE_CODES.has(code) ? code : "";
}
