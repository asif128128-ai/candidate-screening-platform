import { notFound } from "next/navigation";
import { withCurrentAdmin } from "../../../../../lib/current-admin";
import {
  getCandidateProfile,
  getOtherApplications,
  getAssessmentSummary,
  listSessionItems,
  listIntegrityEvents,
  listNotes,
  listStageHistory,
  listConsents,
  listEmails,
} from "../../../../../db/queries/candidate-detail";
import { ProfileCardClient } from "./profile-card-client";
import { CandidateTabsClient } from "./tabs-client";

// ADMIN_UX.md §4: two-column layout — fixed profile card + tabbed detail.
// Several small parallel queries rather than one giant join
// (ARCHITECTURE.md §5.3).
export default async function AdminCandidateDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const result = await withCurrentAdmin(async (tx) => {
    const profile = await getCandidateProfile(tx, applicationId);
    if (!profile) return null;

    const [otherApplications, summary, notes, stageHistory, consents, emails] = await Promise.all([
      getOtherApplications(tx, profile.candidateId, applicationId),
      getAssessmentSummary(tx, applicationId),
      listNotes(tx, applicationId),
      listStageHistory(tx, applicationId),
      listConsents(tx, applicationId),
      listEmails(tx, applicationId),
    ]);
    const [items, events] = summary
      ? await Promise.all([listSessionItems(tx, summary.sessionId), listIntegrityEvents(tx, summary.sessionId)])
      : [[], []];

    return { profile, otherApplications, summary, items, events, notes, stageHistory, consents, emails };
  });

  if (!result) notFound();
  const { profile, otherApplications, summary, items, events, notes, stageHistory, consents, emails } = result;

  return (
    <div className="flex flex-col gap-6 lg:flex-row" dir="rtl">
      <ProfileCardClient profile={profile} otherApplications={otherApplications} />
      <div className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white p-4">
        <CandidateTabsClient
          data={{ applicationId, summary, items, events, notes, stageHistory, consents, emails }}
        />
      </div>
    </div>
  );
}
