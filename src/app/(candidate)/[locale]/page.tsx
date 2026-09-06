// The bare "/" route isn't in CANDIDATE_FLOW.md's route map (candidates
// always land on /jobs/{slug}) — there's exactly one active job at V1, so
// "/" redirects straight there rather than showing an intermediate page.
// Revisit if a real jobs index is ever needed (multiple concurrent active
// jobs), per DESIGN_SUMMARY.md's "clean without unnecessary complexity"
// multi-job note.
import { redirect } from "@/i18n/navigation";

export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/jobs/student-tech-2026", locale });
}
