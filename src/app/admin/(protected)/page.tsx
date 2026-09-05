import { redirect } from "next/navigation";

// ADMIN_UX.md §2: "Default landing after login: מועמדים for the most
// recently active job." The candidates page itself resolves "most recently
// active job" (getDefaultJobId) when no ?job= is given, so this redirect
// doesn't need to duplicate that lookup.
export default function AdminRootPage() {
  redirect("/admin/candidates");
}
