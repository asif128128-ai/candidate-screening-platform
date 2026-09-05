import { randomUUID } from "node:crypto";
import { getSupabaseServiceClient } from "@/db/supabase";
import type { CvKind } from "./cv-validation";

// CANDIDATE_FLOW.md §2.1 "async CV upload": the file is uploaded to Storage
// the moment it's chosen, before the step-1 form (and its application_id)
// exist. It lands under `pending/{uuid}.{ext}` first; on successful form
// submission the object is moved to its final `{application_id}/{uuid}.ext`
// path (DATA_MODEL.md §3.9) and only then does `cv_upsert()` reference it —
// so a submission that never completes leaves an orphaned `pending/` object
// with no DB row pointing at it, which the admin's on-demand storage
// reconciliation (DATA_MODEL.md §3.9, admin-ui's Settings page) is exactly
// the tool designed to catch; nothing here claims otherwise.
//
// Uses the service-role Storage client (ARCHITECTURE.md §1: service role is
// confined to Storage operations and Auth admin, never PostgREST data
// access — uploads/moves are Storage operations).

const BUCKET = "cv";

export interface PendingCvUpload {
  pendingPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hex: string;
  kind: CvKind;
}

export async function uploadPendingCv(
  buffer: Buffer,
  kind: CvKind,
  mimeType: string,
): Promise<string> {
  const ext = kind === "pdf" ? "pdf" : "docx";
  const path = `pending/${randomUUID()}.${ext}`;
  const client = getSupabaseServiceClient();
  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(`CV upload failed: ${error.message}`);
  }
  return path;
}

/** Moves a pending object to its final application-scoped path and returns that path. */
export async function finalizeCvObject(
  pendingPath: string,
  applicationId: string,
  kind: CvKind,
): Promise<string> {
  const ext = kind === "pdf" ? "pdf" : "docx";
  const finalPath = `${applicationId}/${randomUUID()}.${ext}`;
  const client = getSupabaseServiceClient();
  const { error } = await client.storage.from(BUCKET).move(pendingPath, finalPath);
  if (error) {
    throw new Error(`CV finalize (move) failed: ${error.message}`);
  }
  return finalPath;
}

/** 60 s signed URL for admin CV downloads (ARCHITECTURE.md §1) — exposed here since this module owns the storage client, used by admin-ui. */
export async function createCvSignedUrl(objectPath: string): Promise<string> {
  const client = getSupabaseServiceClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(objectPath, 60);
  if (error || !data) {
    throw new Error(`Signed URL creation failed: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}
