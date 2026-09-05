import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { CV_MAX_SIZE_BYTES, validateCvUpload } from "@/lib/cv-validation";
import { uploadPendingCv } from "@/lib/cv-storage";
import { isSameOrigin } from "@/lib/csrf";

// CANDIDATE_FLOW.md §2.1: "Uploads asynchronously the moment a file is
// chosen ... so a stalled 5 MB upload on a phone can never block or lose
// the typed form; the form submit references the already-uploaded object
// id." This is that upload endpoint — it runs *before* the application
// exists (no cookie/application_id yet), so it is a route handler rather
// than a Server Action scoped to an application. The step-1
// `submitPersonalDetails` action finalizes the referenced pending object
// once the application row exists (src/lib/cv-storage.ts `finalizeCvObject`
// + `cv_upsert()`).
//
// This is candidate-flow's one JSON-ish route handler for the apply funnel;
// the assessment hot-path routes (`current`/`answer`/`events`) are the
// assessment-engine engineer's (ARCHITECTURE.md §5.2).

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > CV_MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const validation = validateCvUpload({
    buffer,
    originalName: file.name,
    sizeBytes: file.size,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const sha256Hex = createHash("sha256").update(buffer).digest("hex");

  let pendingPath: string;
  try {
    pendingPath = await uploadPendingCv(buffer, validation.kind, validation.mimeType);
  } catch (err) {
    console.error(
      JSON.stringify({ route: "/api/cv/upload", event: "storage_upload_failed", error: String(err) }),
    );
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }

  return NextResponse.json({
    pendingPath,
    originalName: file.name,
    mimeType: validation.mimeType,
    sizeBytes: file.size,
    sha256Hex,
  });
}
