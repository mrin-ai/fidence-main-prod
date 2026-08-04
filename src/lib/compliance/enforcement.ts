/**
 * COMPLIANCE_ENFORCEMENT:
 * - unset / "1" / "true" / "on" → enforce (default)
 * - "0" / "false" / "off" → fail-open only when COMPLIANCE_ENFORCEMENT_BREAK_GLASS=1
 * - In production, off without break-glass still enforces and logs a warning
 */

let warnedProductionBypass = false;

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function isFlagOff(raw: string | undefined) {
  const value = raw?.trim().toLowerCase();
  return value === "0" || value === "false" || value === "off";
}

function hasBreakGlass() {
  const raw = process.env.COMPLIANCE_ENFORCEMENT_BREAK_GLASS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export function isComplianceEnforcementEnabled() {
  if (!isFlagOff(process.env.COMPLIANCE_ENFORCEMENT)) {
    return true;
  }

  if (!hasBreakGlass()) {
    if (isProductionRuntime() && !warnedProductionBypass) {
      warnedProductionBypass = true;
      console.warn(
        "[compliance] COMPLIANCE_ENFORCEMENT is off but BREAK_GLASS is not set; enforcing in production",
      );
    }
    return true;
  }

  return false;
}
