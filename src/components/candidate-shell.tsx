import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { BRAND_NAME, PRIVACY_CONTACT_EMAIL } from "@/lib/brand";
import { BrandMark } from "./brand-mark";
import { Stepper, type StepperProps } from "./ui/stepper";

// FINTECH_REDESIGN_PLAN.md §1.4 page shell, used by every candidate page.
// §R2.3.2 redesign: header 56 -> 64px, a 3-column grid (`1fr auto 1fr`) so
// the stepper is CENTERED between the brand mark (start) and a reserved,
// empty end cell — round 1's header put the brand mark and stepper on
// opposite edges of a 1366px viewport with ~900px of nothing between them,
// which R2.0's diagnosis calls out as the single element that reads as "a
// template" fastest. Under 640px it collapses to two columns (brand ·
// "שלב N מתוך 4", the Stepper's own built-in mobile text).
export type ContentWidth = "form" | "reading" | "runner";

const WIDTH_CLASS: Record<ContentWidth, string> = {
  form: "max-w-[560px]",
  reading: "max-w-[720px]",
  runner: "max-w-[1040px]",
};

export function CandidateShell({
  children,
  width = "reading",
  stepper,
}: {
  children: ReactNode;
  width?: ContentWidth;
  stepper?: StepperProps;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-10 h-16 border-b border-line bg-surface">
        <div className="mx-auto grid h-full max-w-[1040px] grid-cols-2 items-center px-4 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
          <div className="justify-self-start">
            <BrandMark />
          </div>
          <div className="justify-self-end sm:justify-self-center">
            {stepper ? <Stepper {...stepper} /> : null}
          </div>
          {/* Reserved end cell — deliberately empty (§R2.3.2) so the
              stepper is optically centered in the header, not just centered
              between two unequal siblings. */}
          <div aria-hidden="true" className="hidden sm:block" />
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 ${WIDTH_CLASS[width]}`}>{children}</main>

      <footer className="border-t border-line px-4 py-8 text-center text-[13px] leading-5 text-text-3 sm:px-6">
        © <span className="tnum">{new Date().getFullYear()}</span> {BRAND_NAME} ·{" "}
        <Link href="/privacy" className="hover:underline">
          מדיניות פרטיות
        </Link>{" "}
        ·{" "}
        <Term>
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="hover:underline">
            {PRIVACY_CONTACT_EMAIL}
          </a>
        </Term>
      </footer>
    </div>
  );
}
