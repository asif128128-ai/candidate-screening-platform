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

  // FINTECH_REDESIGN_PLAN.md §R2.2 step 2 item 1: a line that is *only* a
  // "**bold**" run is a heading, not a bolded sentence.
  test("a line that is only a **bold** run renders as <h3>, not <p><strong>", () => {
    expect(renderJobDescriptionHtml("**כותרת**")).toBe("<h3>כותרת</h3>");
  });

  // The real bug (§R2.2 step 2 item 1): stored descriptions separate
  // paragraphs with a single newline, not a blank line, so the old
  // `split(/\n{2,}/)` joined the whole description into one <p>. This is
  // the seed job description (CANDIDATE_FLOW.md §3.1 / supabase/migrations
  // /0002_seed.sql) with single newlines between paragraphs, exactly as an
  // admin's textarea would actually produce it.
  test("the seed job description renders as at least 5 separate <p>/<h3> blocks with single newlines", () => {
    const seedDescription = [
      "אנחנו מחפשים סטודנט/ית חזק/ה למדעי המחשב (או תחום קרוב) לתפקיד טכנולוגי רחב שמחולק בערך חצי-חצי:",
      "**פיתוח תוכנה (~50%)** — כתיבת כלים פנימיים, אוטומציות, אינטגרציות בין מערכות, עבודה מול APIs, סקריפטים, שיפורים למערכות קיימות.",
      "**תפעול טכנולוגי (~50%)** — תשתיות ו-Cloud, הרשאות ומערכות SaaS, נתונים ודוחות, כלי AI, Logs ותקלות, מערכות פנימיות ותחזוקה טכנולוגית שוטפת. חלק מזה הוא תמיכה טכנית פנימית לעובדים — זה חלק אמיתי מהתפקיד. זו לא משרת Help Desk: המטרה הרחבה היא להפוך את הארגון למקום טכנולוגי, אוטומטי ויעיל הרבה יותר, ואת/ה תהיו חלק מרכזי בזה.",
      "**מה מצפים ממך:** עצמאות גבוהה. לקבל בעיה לא לגמרי מוגדרת, לחקור, לבדוק, להחליט ולהתקדם — בלי לחכות שיגידו לך מה הצעד הבא. סקרנות טכנולוגית אמיתית ורוחב: תוכנה, APIs, Database, Cloud, הרשאות, אבטחה בסיסית, אוטומציה.",
      "**מה מקבלים:** אחריות משמעותית, חשיפה טכנולוגית רחבה מאוד, ניסיון אמיתי מעולם ה-Production, ולמידה מהירה. בהמשך — לא מובטח, אבל אפשרי — הרחבה למשרה מלאה, יותר אחריות ושכר גבוה יותר.",
    ].join("\n");

    const html = renderJobDescriptionHtml(seedDescription);
    const blockCount = (html.match(/<p>|<h3>/g) ?? []).length;
    expect(blockCount).toBeGreaterThanOrEqual(5);
    // Never one wall of text: every paragraph is its own block.
    expect(html.split("\n").length).toBe(blockCount);
  });
});
