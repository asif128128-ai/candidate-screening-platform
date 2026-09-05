import { withCurrentAdmin } from "../../../../../lib/current-admin";
import { listAssessmentConfigs } from "../../../../../db/queries/jobs";
import { JobFormClient } from "../job-form-client";

export default async function AdminJobNewPage() {
  const configs = await withCurrentAdmin((tx) => listAssessmentConfigs(tx));
  return (
    <div dir="rtl" className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">משרה חדשה</h1>
      <JobFormClient job={null} configs={configs} />
    </div>
  );
}
