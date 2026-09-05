import { notFound } from "next/navigation";
import { withCurrentAdmin } from "../../../../../lib/current-admin";
import { getJob, listAssessmentConfigs } from "../../../../../db/queries/jobs";
import { JobFormClient } from "../job-form-client";

export default async function AdminJobEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { job, configs } = await withCurrentAdmin(async (tx) => ({
    job: await getJob(tx, id),
    configs: await listAssessmentConfigs(tx),
  }));

  if (!job) notFound();

  return (
    <div dir="rtl" className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">עריכת משרה — {job.titleHe}</h1>
      <JobFormClient job={job} configs={configs} />
    </div>
  );
}
