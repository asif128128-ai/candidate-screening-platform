import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { checkCandidateCookie } from "@/lib/candidate-session";
import { getDoneInfo } from "@/db/queries/application-flow";
import { redirect } from "@/i18n/navigation";

// CANDIDATE_FLOW.md §6 — done page and closure (DECISIONS_LOG.md #3): a
// reply-by date, no personalized rejection, a privacy link. No score is
// ever shown to candidates.
export default async function DonePage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const cookieCheck = await checkCandidateCookie(applicationId);
  if (cookieCheck.kind === "missing") {
    redirect({ href: "/resume", locale: "he" });
  }
  if (cookieCheck.kind === "mismatch") {
    notFound();
  }

  const info = await getDoneInfo(applicationId);
  if (!info) notFound();

  const responseByDateHe = info.responseByDate.toLocaleDateString("he-IL");

  return (
    <main className="mx-auto max-w-2xl p-8 text-center">
      {info.sessionStatus === "abandoned" ? (
        <>
          <h1 className="text-xl font-semibold">המבחן נסגר</h1>
          <p className="mt-2 text-neutral-600">המבחן נסגר כי חלף זמן המקסימום. מה שנענה נשמר.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">תודה, {info.candidateFirstName}!</h1>
          <p className="mt-2 text-neutral-600">המבחן נשמר.</p>
        </>
      )}

      <p className="mt-4">
        <strong>נחזור אליך עד <Term>{responseByDateHe}</Term></strong> במייל או בטלפון, בכל מקרה —
        גם אם לא נמשיך יחד הפעם.
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        אם עבר התאריך ולא שמעת מאיתנו, אפשר לכתוב אלינו (פרטי הקשר בעמוד מדיניות הפרטיות).
      </p>

      <Link href="/privacy" className="mt-6 inline-block underline">
        מדיניות הפרטיות
      </Link>
    </main>
  );
}
