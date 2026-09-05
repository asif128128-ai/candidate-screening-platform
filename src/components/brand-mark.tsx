import fs from "node:fs";
import path from "node:path";
import { BRAND_NAME } from "@/lib/brand";

// FINTECH_REDESIGN_PLAN.md §1.4: renders public/brand/logo.svg if the client
// has provided one, else a text wordmark. There is no client logo yet — the
// wordmark fallback ships now rather than blocking the redesign on it; once
// `public/brand/logo.svg` exists this component picks it up with no code
// change. Server component only (fs access at render time).
const LOGO_PATH = path.join(process.cwd(), "public", "brand", "logo.svg");

function hasLogo(): boolean {
  try {
    return fs.existsSync(LOGO_PATH);
  } catch {
    return false;
  }
}

export function BrandMark() {
  if (hasLogo()) {
    // A self-hosted SVG logo of unknown intrinsic size; next/image's
    // optimizer adds no value for a vector logo and forces width/height
    // we don't have yet.
    return <img src="/brand/logo.svg" alt={BRAND_NAME} height={24} className="h-6 w-auto" />;
  }

  return (
    <span className="text-[18px] font-bold leading-none text-ink-900">{BRAND_NAME}</span>
  );
}
