"use server";

import { revalidatePath } from "next/cache";
import { withCurrentAdmin } from "../../../lib/current-admin";
import { dismissAlert } from "../../../db/queries/alerts";

export async function dismissAlertAction(formData: FormData): Promise<void> {
  const alertId = Number(formData.get("alertId"));
  if (!Number.isFinite(alertId)) return;
  await withCurrentAdmin((tx, admin) => dismissAlert(tx, alertId, admin.id));
  revalidatePath("/admin", "layout");
}
