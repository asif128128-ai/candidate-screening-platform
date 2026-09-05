// TODO(admin-ui engineer): Supabase Auth email+password login (ADMIN_UX.md
// §8, ARCHITECTURE.md §6). On success, middleware checks admin_users
// allowlist + disabled_at, then requires aal2 (TOTP) before any data page.
export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold">כניסת מנהלים</h1>
      <p className="mt-2 text-neutral-500">
        טופס התחברות ייבנה כאן — ראו ADMIN_UX.md §8.
      </p>
    </main>
  );
}
