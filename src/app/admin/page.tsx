import { redirect } from "next/navigation";

// ADMIN_UX.md §2: "Default landing after login: מועמדים for the most
// recently active job." TODO(admin-ui engineer): once auth middleware picks
// the right job, redirect with that job id in the query string.
export default function AdminRootPage() {
  redirect("/admin/candidates");
}
