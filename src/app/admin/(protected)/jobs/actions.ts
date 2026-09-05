"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withCurrentAdmin } from "../../../../lib/current-admin";
import { createJob, updateJob, setJobActive, deleteJobIfEmpty, type JobInput } from "../../../../db/queries/jobs";

function parseJobInput(formData: FormData): JobInput {
  const num = (name: string): number | null => {
    const v = formData.get(name);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const confirmations = formData
    .getAll("confirmation")
    .map((v) => String(v).trim())
    .filter(Boolean);

  return {
    slug: String(formData.get("slug") ?? "").trim(),
    titleHe: String(formData.get("titleHe") ?? "").trim(),
    titleEn: String(formData.get("titleEn") ?? "").trim() || null,
    summaryHe: String(formData.get("summaryHe") ?? "").trim(),
    descriptionHe: String(formData.get("descriptionHe") ?? ""),
    hourlyRateIls: num("hourlyRateIls"),
    hoursPerWeek: num("hoursPerWeek"),
    daysPerWeek: num("daysPerWeek"),
    hoursPerDay: num("hoursPerDay"),
    engagementTypeHe: String(formData.get("engagementTypeHe") ?? "קבלן עצמאי / נותן שירותים"),
    locationHe: String(formData.get("locationHe") ?? "").trim(),
    hybridHe: String(formData.get("hybridHe") ?? "").trim() || null,
    startHe: String(formData.get("startHe") ?? "מיידי"),
    requiresRishon: formData.get("requiresRishon") === "on",
    confirmationsHe: confirmations.length > 0 ? confirmations : ["", "", ""],
    responseWindowDays: num("responseWindowDays") ?? 14,
    sendRejectionEmail: formData.get("sendRejectionEmail") === "on",
    isActive: formData.get("isActive") === "on",
    assessmentConfigId: String(formData.get("assessmentConfigId") ?? ""),
  };
}

export async function createJobAction(formData: FormData): Promise<void> {
  const input = parseJobInput(formData);
  const id = await withCurrentAdmin((tx, admin) => createJob(tx, input, admin.id));
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${id}`);
}

export async function updateJobAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const input = parseJobInput(formData);
  await withCurrentAdmin((tx, admin) => updateJob(tx, id, input, admin.id));
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${id}`);
}

export async function setJobActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "1";
  if (!id) return;
  await withCurrentAdmin((tx, admin) => setJobActive(tx, id, isActive, admin.id));
  revalidatePath("/admin/jobs");
}

export async function deleteJobAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const deleted = await withCurrentAdmin((tx, admin) => deleteJobIfEmpty(tx, id, admin.id));
  if (deleted) {
    revalidatePath("/admin/jobs");
    redirect("/admin/jobs");
  }
}
