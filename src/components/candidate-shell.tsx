import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { BRAND_NAME } from "@/lib/brand";
import { BrandMark } from "./brand-mark";
import { Stepper, type StepperProps } from "./ui/stepper";

// FINTECH_REDESIGN_PLAN.md §1.4 page shell, used by every candidate page.
// Sticky header 56px, --surface, 1px --line bottom: BrandMark at the start
// side, the Stepper (when relevant) at the end side. Content column
// max-width depends on the page type. Footer: single line, --text-3.
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
      <header className="sticky top-0 z-10 h-14 border-b border-line bg-surface">
        <div className="rtl-row mx-auto h-full max-w-[1040px] items-center justify-between px-4 sm:px-6">
          <BrandMark />
          {stepper ? <Stepper {...stepper} /> : null}
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 ${WIDTH_CLASS[width]}`}>{children}</main>

      <footer className="border-t border-line px-4 py-6 text-center text-[13px] leading-5 text-text-3 sm:px-6">
        <Link href="/privacy" className="hover:underline">
          מדיניות פרטיות
        </Link>{" "}
        · {BRAND_NAME}
      </footer>
    </div>
  );
}
