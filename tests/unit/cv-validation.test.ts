import { describe, expect, it } from "vitest";
import { CV_MAX_SIZE_BYTES, detectCvFileType, validateCvUpload } from "@/lib/cv-validation";

// TEST_STRATEGY.md §7 "Upload" row: PDF/DOCX accepted by magic bytes;
// renamed .exe / SVG/HTML rejected; > 5 MB rejected; a polyglot (PDF header
// + trailing script) is still accepted as PDF (content sniffing only looks
// at the leading magic bytes, exactly like a real PDF parser would).

function pdfBuffer(extraBytes = 100): Buffer {
  return Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(extraBytes, 0x20)]);
}

function zipBuffer(extraBytes = 100): Buffer {
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(extraBytes, 0x20)]);
}

describe("detectCvFileType", () => {
  it("detects a real PDF by magic bytes", () => {
    const result = detectCvFileType(pdfBuffer());
    expect(result).toEqual({ ok: true, kind: "pdf", mimeType: "application/pdf" });
  });

  it("detects a DOCX (zip-based) by magic bytes", () => {
    const result = detectCvFileType(zipBuffer());
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("docx");
  });

  it("rejects an HTML file even if named .pdf", () => {
    const result = detectCvFileType(Buffer.from("<html><body>hi</body></html>"));
    expect(result.ok).toBe(false);
  });

  it("rejects an SVG file", () => {
    const result = detectCvFileType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"));
    expect(result.ok).toBe(false);
  });
});

describe("validateCvUpload", () => {
  it("accepts a real PDF named cv.pdf", () => {
    const buffer = pdfBuffer();
    const result = validateCvUpload({ buffer, originalName: "cv.pdf", sizeBytes: buffer.length });
    expect(result.ok).toBe(true);
  });

  it("accepts a real DOCX named cv.docx", () => {
    const buffer = zipBuffer();
    const result = validateCvUpload({ buffer, originalName: "cv.docx", sizeBytes: buffer.length });
    expect(result.ok).toBe(true);
  });

  it("rejects a legacy .doc extension outright", () => {
    const buffer = zipBuffer();
    const result = validateCvUpload({ buffer, originalName: "cv.doc", sizeBytes: buffer.length });
    expect(result.ok).toBe(false);
  });

  it("rejects an .exe renamed to .pdf (content doesn't match)", () => {
    const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
    const result = validateCvUpload({ buffer, originalName: "cv.pdf", sizeBytes: buffer.length });
    expect(result.ok).toBe(false);
  });

  it("rejects a polyglot PDF-with-trailing-script by content sniff, but as a VALID pdf (leading bytes decide)", () => {
    const buffer = Buffer.concat([pdfBuffer(10), Buffer.from("<script>alert(1)</script>")]);
    const result = validateCvUpload({ buffer, originalName: "cv.pdf", sizeBytes: buffer.length });
    // Real PDF viewers/parsers also only look at the header; this is the
    // documented, accepted behavior — served back with Content-Disposition:
    // attachment (ARCHITECTURE.md §6), never executed inline.
    expect(result.ok).toBe(true);
  });

  it("rejects a file over 5 MB", () => {
    const buffer = pdfBuffer(10);
    const result = validateCvUpload({ buffer, originalName: "cv.pdf", sizeBytes: CV_MAX_SIZE_BYTES + 1 });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validateCvUpload({ buffer: Buffer.alloc(0), originalName: "cv.pdf", sizeBytes: 0 });
    expect(result.ok).toBe(false);
  });
});
