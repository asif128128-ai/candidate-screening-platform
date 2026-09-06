import { Link } from "@/i18n/navigation";
import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { DEFAULT_JOB_SLUG } from "@/lib/brand";

// FINTECH_REDESIGN_PLAN.md §R2.2 landing item 8 / §R2.4 P0: the bare 404 was
// Next's default page — English, LTR, no shell. Every candidate-facing
// edge case (this one, the inactive-job screens, the already-past
// variants) now uses the same CandidateShell + Card pattern.
export default function CandidateNotFound() {
  return (
    <CandidateShell width="reading">
      <Card className="mx-auto max-w-[480px] text-center">
        <h1 className="h1">העמוד לא נמצא</h1>
        <p className="mt-2 text-[16px] leading-[26px] text-text-2">הקישור שגוי או שפג תוקפו.</p>
        <Link href={`/jobs/${DEFAULT_JOB_SLUG}`} className={`mt-4 ${buttonClasses({ fullWidth: false })}`}>
          למשרה הפתוחה
        </Link>
        <Link href="/resume" className={`mt-2 ${buttonClasses({ variant: "ghost", fullWidth: false })}`}>
          חזרה לתהליך עם קוד
        </Link>
      </Card>
    </CandidateShell>
  );
}
