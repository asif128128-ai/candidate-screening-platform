"use server";

import { revalidatePath } from "next/cache";
import { withCurrentAdmin, requireCurrentAdmin } from "../../../../../lib/current-admin";
import {
  addNote,
  markIntegrityReviewed,
  ignoreFocusSignals,
  undoIgnoreFocusSignals,
  resetAssessment,
  deleteCandidate,
} from "../../../../../db/queries/candidate-mutations";
import { createCvSignedUrl } from "../../../../../lib/cv-signed-url";

export async function addNoteAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!applicationId || !body) return;
  await withCurrentAdmin((tx, admin) => addNote(tx, applicationId, admin.id, body));
  revalidatePath(`/admin/candidates/${applicationId}`);
}

export async function markIntegrityReviewedAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) return;
  await withCurrentAdmin((tx, admin) => markIntegrityReviewed(tx, applicationId, admin.id));
  revalidatePath(`/admin/candidates/${applicationId}`);
}

export async function ignoreFocusSignalsAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!applicationId || !reason) return;
  await withCurrentAdmin((tx, admin) => ignoreFocusSignals(tx, applicationId, admin.id, reason));
  revalidatePath(`/admin/candidates/${applicationId}`);
}

export async function undoIgnoreFocusSignalsAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) return;
  await withCurrentAdmin((tx) => undoIgnoreFocusSignals(tx, applicationId));
  revalidatePath(`/admin/candidates/${applicationId}`);
}

export async function resetAssessmentAction(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "לא צוינה סיבה";
  if (!applicationId) return;
  await withCurrentAdmin((tx, admin) => resetAssessment(tx, applicationId, admin.id, reason));
  revalidatePath(`/admin/candidates/${applicationId}`);
}

export async function deleteCandidateAction(formData: FormData): Promise<void> {
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) return;
  await withCurrentAdmin((tx, admin) => deleteCandidate(tx, candidateId, admin.id));
  revalidatePath("/admin/candidates");
}

/** Called directly (not as a <form> action) from the client tab component
 * so the returned signed URL can open in a new tab. Returns null instead of
 * throwing on failure (e.g. no reachable Storage bucket) — see
 * cv-signed-url.ts. */
export async function getCvDownloadUrlAction(objectPath: string): Promise<string | null> {
  await requireCurrentAdmin();
  return createCvSignedUrl("cv", objectPath);
}
