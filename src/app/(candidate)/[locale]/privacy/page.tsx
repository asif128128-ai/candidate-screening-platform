import { CandidateShell } from "@/components/candidate-shell";
import { Card } from "@/components/ui/card";
import { PRIVACY_NOTICE_TEXT_HE } from "@/lib/consent-text";
import { PrivacyRequestForm } from "./privacy-request-form";

// CANDIDATE_FLOW.md §7 — privacy notice (verbatim text, stored as
// privacy_v1) + request form (access / correction / deletion).
export default function PrivacyPage() {
  const paragraphs = PRIVACY_NOTICE_TEXT_HE.split("\n");

  return (
    <CandidateShell width="reading">
      <h1 className="text-[28px] font-bold leading-9 text-ink-900 min-[480px]:text-[24px] min-[480px]:leading-8">
        מדיניות פרטיות
      </h1>
      <div className="mt-4 space-y-3 text-[16px] leading-[26px] text-text">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <h2 className="mt-10 text-[20px] font-semibold leading-7 text-ink-900">בקשה לגבי הפרטים שלי</h2>
      <Card className="mt-4">
        <PrivacyRequestForm />
      </Card>
    </CandidateShell>
  );
}
