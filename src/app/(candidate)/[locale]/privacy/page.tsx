import { PRIVACY_NOTICE_TEXT_HE } from "@/lib/consent-text";
import { PrivacyRequestForm } from "./privacy-request-form";

// CANDIDATE_FLOW.md §7 — privacy notice (verbatim text, stored as
// privacy_v1) + request form (access / correction / deletion).
export default function PrivacyPage() {
  const paragraphs = PRIVACY_NOTICE_TEXT_HE.split("\n");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">מדיניות פרטיות</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">בקשה לגבי הפרטים שלי</h2>
      <div className="mt-4">
        <PrivacyRequestForm />
      </div>
    </main>
  );
}
