"use client";

import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// FINTECH_REDESIGN_PLAN.md §R2.2 landing item 8 / §R2.4 P0: a thrown server
// error must never fall through to the default Next.js error page (English,
// no shell). error.tsx boundaries are client components by Next's own
// requirement.
export default function CandidateError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <CandidateShell width="reading">
      <Card className="mx-auto max-w-[480px] text-center">
        <h1 className="h1">משהו השתבש</h1>
        <p className="mt-2 text-[16px] leading-[26px] text-text-2">
          קרתה שגיאה בלתי צפויה. אפשר לנסות שוב — ההתקדמות שלכם נשמרה.
        </p>
        <Button type="button" onClick={reset} className="mt-4" fullWidth={false}>
          ניסיון נוסף
        </Button>
      </Card>
    </CandidateShell>
  );
}
