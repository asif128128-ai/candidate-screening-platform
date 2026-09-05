import { getSupabaseServiceClient } from "../db/supabase";

// ADMIN_UX.md §4.1: "CV (הורד קורות חיים -> signed URL, 60 s)". Per
// ARCHITECTURE.md §1/§6, the service-role key is used ONLY for this and
// for the Auth admin invite API — never for data. The bucket is private
// with no storage policies (DATA_MODEL.md §6.3), so this signed URL is the
// only way a CV is ever reachable, and only from an authenticated admin
// Server Action (never a public route).
/**
 * Returns null on any failure rather than throwing: this is called from a
 * Server Action invoked directly (not via a <form>), and a thrown error
 * there crosses the server/client boundary as an opaque, hard-to-message
 * exception. The caller (profile-card-client.tsx) turns null into a plain
 * Hebrew error string instead.
 */
export async function createCvSignedUrl(bucket: string, objectPath: string): Promise<string | null> {
  try {
    const client = getSupabaseServiceClient();
    const { data, error } = await client.storage.from(bucket).createSignedUrl(objectPath, 60);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
