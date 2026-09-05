// ARCHITECTURE.md §6 / CANDIDATE_FLOW.md §2.1 / DATA_MODEL.md §3.9: CV
// uploads are PDF or DOCX only, <= 5 MB, validated by magic bytes (not just
// the declared MIME type / extension) server-side. Pure functions, no I/O.

export const CV_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
export const CV_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export type CvMimeType = (typeof CV_ALLOWED_MIME_TYPES)[number];

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
// DOCX is a ZIP container; ZIP local file header signature.
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
// An empty/spanned zip can start with this signature too (rare, but valid).
const ZIP_EMPTY_MAGIC = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

export type CvKind = "pdf" | "docx";

export interface CvDetectionResult {
  ok: boolean;
  kind: CvKind | null;
  mimeType: CvMimeType | null;
  error?: string;
}

/** Sniffs the real file type from its bytes, ignoring the client-declared MIME type/filename. */
export function detectCvFileType(buffer: Buffer): CvDetectionResult {
  if (buffer.length >= PDF_MAGIC.length && buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return { ok: true, kind: "pdf", mimeType: "application/pdf" };
  }
  if (
    (buffer.length >= ZIP_MAGIC.length && buffer.subarray(0, 4).equals(ZIP_MAGIC)) ||
    (buffer.length >= ZIP_EMPTY_MAGIC.length && buffer.subarray(0, 4).equals(ZIP_EMPTY_MAGIC))
  ) {
    // A ZIP signature alone doesn't prove DOCX (vs. any other zip-based
    // format); we additionally require the declared/asserted extension to
    // be .docx and accept it as best-effort per ARCHITECTURE.md §6 ("legacy
    // .doc is dropped ... DOCX cannot carry macros"). A full OOXML content
    // check (looking for `word/document.xml` in the central directory)
    // would be more precise but isn't worth the dependency at this scale.
    return {
      ok: true,
      kind: "docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  return { ok: false, kind: null, mimeType: null, error: "פורמט הקובץ אינו נתמך" };
}

export interface CvValidationInput {
  buffer: Buffer;
  originalName: string;
  sizeBytes: number;
}

export interface CvValidationOk {
  ok: true;
  mimeType: CvMimeType;
  kind: CvKind;
}
export interface CvValidationErr {
  ok: false;
  error: string;
}

export function validateCvUpload(input: CvValidationInput): CvValidationOk | CvValidationErr {
  if (input.sizeBytes <= 0) {
    return { ok: false, error: "הקובץ ריק" };
  }
  if (input.sizeBytes > CV_MAX_SIZE_BYTES) {
    return { ok: false, error: "הקובץ גדול מדי (מקסימום 5MB)" };
  }
  const extension = input.originalName.toLowerCase().split(".").pop() ?? "";
  if (extension !== "pdf" && extension !== "docx") {
    return { ok: false, error: "יש להעלות קובץ PDF או DOCX בלבד" };
  }
  const detected = detectCvFileType(input.buffer);
  if (!detected.ok || !detected.kind || !detected.mimeType) {
    return { ok: false, error: detected.error ?? "פורמט הקובץ אינו נתמך" };
  }
  if (detected.kind !== extension) {
    return { ok: false, error: "תוכן הקובץ אינו תואם לסיומת" };
  }
  return { ok: true, mimeType: detected.mimeType, kind: detected.kind };
}
