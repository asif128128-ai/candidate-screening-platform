// TODO(candidate-flow engineer): the bare "/" route isn't in
// CANDIDATE_FLOW.md's route map (candidates always land on /jobs/{slug}).
// This placeholder just points at the one seeded job so the root route
// resolves to something during early development; replace or remove once
// there's a real reason to have content at "/" (e.g. a jobs index).
import { Link } from "@/i18n/navigation";

export default function RootPage() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <p>
        <Link href="/jobs/student-tech-2026" className="underline">
          לצפייה במשרה הפתוחה
        </Link>
      </p>
    </main>
  );
}
