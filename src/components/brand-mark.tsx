import { BRAND_NAME } from "@/lib/brand";

// FINTECH_REDESIGN_PLAN.md §1.4: renders public/brand/logo.svg if the client
// has provided one, else a text wordmark. There is no client logo yet — the
// wordmark fallback ships now rather than blocking the redesign on it; once
// `public/brand/logo.svg` exists this component picks it up with no code
// change. Server component only (fs access at render time) — BUT this
// component is also reachable from `error.tsx` (§R2.2 landing item 8),
// which Next.js requires to be a client component, so its whole import
// graph gets bundled for the browser too. A static `import "node:fs"` here
// makes that client bundle fail outright ("UnhandledSchemeError: Reading
// from 'node:fs'"). `eval("require")` is opaque to webpack's static import
// analysis, so the client bundle never even tries to resolve node:fs/path;
// the `typeof window` guard means the require is never actually reached in
// the browser anyway — this only ever really runs server-side.
function hasLogo(): boolean {
  if (typeof window !== "undefined") return false;
  try {
    const nodeRequire = eval("require") as NodeJS.Require;
    const fs = nodeRequire("node:fs") as typeof import("node:fs");
    const path = nodeRequire("node:path") as typeof import("node:path");
    return fs.existsSync(path.join(process.cwd(), "public", "brand", "logo.svg"));
  } catch {
    return false;
  }
}

// FINTECH_REDESIGN_PLAN.md §R2.3.2: without a client logo, the fallback is
// a monogram (28px rounded-8 --ink-900 square, the brand name's first
// letter in white 15/700) followed by the wordmark (17/24 700 --ink-900),
// gap-2.5 — not just a bare text wordmark. Ask the client — again — for
// `logo.svg` and a hex; the monogram is the fallback, not the brand.
export function BrandMark() {
  if (hasLogo()) {
    // A self-hosted SVG logo of unknown intrinsic size; next/image's
    // optimizer adds no value for a vector logo and forces width/height
    // we don't have yet.
    return <img src="/brand/logo.svg" alt={BRAND_NAME} height={28} className="h-7 w-auto" />;
  }

  const initial = BRAND_NAME.trim().charAt(0).toUpperCase() || "?";

  return (
    <span className="rtl-row items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-8 bg-ink-900 text-[15px] font-bold leading-none text-white"
      >
        {initial}
      </span>
      <span className="text-[17px] font-bold leading-6 text-ink-900">{BRAND_NAME}</span>
    </span>
  );
}
