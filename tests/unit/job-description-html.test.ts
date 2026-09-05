import { describe, test, expect } from "vitest";
import { renderJobDescriptionHtml } from "@/db/queries/jobs";

// DATA_MODEL.md §3.2 `description_html`: "rendered from description_he on
// save (no runtime markdown lib)" — src/db/queries/jobs.ts implements a
// small dependency-free subset (paragraphs, **bold**, "- " lists) rather
// than pulling in a markdown engine (ARCHITECTURE.md §7 bundle budget).

describe("renderJobDescriptionHtml", () => {
  test("wraps a plain paragraph", () => {
    expect(renderJobDescriptionHtml("שלום עולם")).toBe("<p>שלום עולם</p>");
  });

  test("renders **bold** as <strong>", () => {
    expect(renderJobDescriptionHtml("זו **חשוב** מאוד")).toBe("<p>זו <strong>חשוב</strong> מאוד</p>");
  });

  test("renders a '- ' block as a <ul><li> list", () => {
    const html = renderJobDescriptionHtml("- ראשון\n- שני\n- שלישי");
    expect(html).toBe("<ul><li>ראשון</li><li>שני</li><li>שלישי</li></ul>");
  });

  test("separates blocks on a blank line", () => {
    const html = renderJobDescriptionHtml("פסקה ראשונה\n\nפסקה שנייה");
    expect(html).toBe("<p>פסקה ראשונה</p>\n<p>פסקה שנייה</p>");
  });

  test("escapes HTML-significant characters (never trusts input as markup)", () => {
    const html = renderJobDescriptionHtml("<script>alert(1)</script> & נמשיך");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  test("a list line's bold still renders inside <li>", () => {
    const html = renderJobDescriptionHtml("- **דחוף**: להגיש עד מחר");
    expect(html).toBe("<ul><li><strong>דחוף</strong>: להגיש עד מחר</li></ul>");
  });
});
