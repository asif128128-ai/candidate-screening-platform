import { ResumeForm } from "./resume-form";

// CANDIDATE_FLOW.md §2.4 — /resume: re-entry that does not depend on email.
export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">חזרה לתהליך</h1>
      <p className="mt-2 text-neutral-600">הזינו אימייל וקוד חזרה כדי להמשיך מאותה נקודה.</p>
      <div className="mt-6">
        <ResumeForm prefillEmail={email} />
      </div>
    </main>
  );
}
