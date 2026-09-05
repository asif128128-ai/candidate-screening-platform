"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAdmin, withCurrentAdmin } from "../../../../lib/current-admin";
import { addAdminUser, setAdminDisabled, resolvePrivacyRequest } from "../../../../db/queries/settings";
import { getSupabaseServiceClient } from "../../../../db/supabase";

export async function addAdminUserAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!email || !displayName) return;

  await withCurrentAdmin((tx, admin) => addAdminUser(tx, email, displayName, admin.id));

  // Mirrors scripts/admin-add.ts: the DB row is authoritative even if the
  // Auth invite email fails to send (e.g. no real Supabase project in this
  // environment) — the invite can be resent from the Supabase dashboard.
  try {
    const client = getSupabaseServiceClient();
    await client.auth.admin.inviteUserByEmail(email);
  } catch {
    // best-effort; DB row already created
  }
  revalidatePath("/admin/settings");
}

export async function setAdminDisabledAction(formData: FormData): Promise<void> {
  const targetId = String(formData.get("targetId") ?? "");
  const disabled = formData.get("disabled") === "1";
  if (!targetId) return;
  const admin = await requireCurrentAdmin();
  await withCurrentAdmin((tx) => setAdminDisabled(tx, targetId, disabled, admin.id));
  revalidatePath("/admin/settings");
}

export async function resolvePrivacyRequestAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "rejected" ? "rejected" : "done";
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id) return;
  await withCurrentAdmin((tx, admin) => resolvePrivacyRequest(tx, id, status, admin.id, note));
  revalidatePath("/admin/settings");
}

export interface ReconciliationResult {
  orphaned: string[];
  error: string | null;
}

/** Settings -> "בדיקת קבצים" (DATA_MODEL.md §3.9): lists bucket objects and
 * diffs against cv_files ∪ cv_purge_queue. Requires a reachable Supabase
 * Storage bucket — in an environment without a live Supabase project this
 * fails gracefully rather than crashing the page. */
export async function reconcileCvFilesAction(): Promise<ReconciliationResult> {
  return withCurrentAdmin(async (tx) => {
    try {
      const client = getSupabaseServiceClient();
      const { data, error } = await client.storage.from("cv").list("", { limit: 1000 });
      if (error) return { orphaned: [], error: "לא ניתן להתחבר לאחסון הקבצים כרגע." };
      const known = new Set<string>();
      const cvRows = await tx<{ object_path: string }[]>`select object_path from cv_files`;
      const queueRows = await tx<{ object_path: string }[]>`select object_path from cv_purge_queue`;
      for (const r of cvRows) known.add(r.object_path);
      for (const r of queueRows) known.add(r.object_path);
      const orphaned = (data ?? []).map((f) => f.name).filter((name) => !known.has(name));
      return { orphaned, error: null };
    } catch {
      return { orphaned: [], error: "לא ניתן להתחבר לאחסון הקבצים כרגע." };
    }
  });
}
