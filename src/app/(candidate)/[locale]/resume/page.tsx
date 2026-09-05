// TODO(candidate-flow engineer): /resume — re-entry without email
// (CANDIDATE_FLOW.md §2.4). Email + 8-char resume code (SHA-256 compared
// against applications.resume_code_hash) OR email OTP -> re-issues the
// app_session cookie -> redirects to the candidate's current step.
// Rate-limited via the `rate_limits` table (5 resume attempts / email /
// hour; 3 OTP requests / email / hour).
export default function ResumePage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">חזרה לתהליך</h1>
      <p className="mt-2 text-neutral-500">
        טופס אימייל + קוד חזרה ייבנה כאן — ראו CANDIDATE_FLOW.md §2.4.
      </p>
    </main>
  );
}
