import { NextResponse, type NextRequest } from "next/server";
import { resolveAdminSession } from "../../../../../lib/current-admin";
import { withAdmin } from "../../../../../db/postgres";
import { listCandidates, PAGE_SIZE } from "../../../../../db/queries/candidates";
import { parseCandidateFilters } from "../../../../../lib/candidate-filters";
import { STAGE_LABELS_HE, INTEGRITY_LABELS_HE, formatDate } from "../../../../../lib/admin-format";
import { mapAdminApplicationRow, type AdminApplicationRow } from "../../../../../db/queries/types";

// ADMIN_UX.md §3.5: "ייצוא CSV (visible columns, UTF-8 with BOM so Excel
// opens Hebrew correctly)". Also the export half of "ארכב ומחק" — the
// client downloads this *before* calling the delete action so the CSV
// always reflects pre-delete data.
//
// Route Handlers are NOT wrapped by src/app/admin/(protected)/layout.tsx
// (Next.js layouts only wrap page.tsx), so this re-checks admin auth itself
// — the same allowlist check the layout does, not just the middleware's
// aal2 check (TEST_STRATEGY.md §7: "admin API with candidate cookie -> 401",
// generalized here to "no admin session -> 401").
export async function GET(req: NextRequest): Promise<Response> {
  const resolution = await resolveAdminSession();
  if (resolution.status !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const filters = parseCandidateFilters(searchParams);

  const rows = await withAdmin(resolution.admin.id, async (tx) => {
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      const raw = await tx.unsafe(
        `select * from admin_application_rows where application_id = any($1::uuid[])`,
        [ids],
      );
      return (raw as unknown as Parameters<typeof mapAdminApplicationRow>[0][]).map(mapAdminApplicationRow);
    }
    // Full filtered export, ignoring pagination (cap at 5,000 per
    // ADMIN_UX.md §3.5's "up to 5,000" selection ceiling).
    const all: AdminApplicationRow[] = [];
    let cursor: string | null = null;
    let offset = 0;
    for (let page = 0; page < Math.ceil(5000 / PAGE_SIZE); page++) {
      const result = await listCandidates(tx, { ...filters, cursor, offset });
      all.push(...result.rows);
      if (!result.nextCursor && result.nextOffset === null) break;
      cursor = result.nextCursor;
      offset = result.nextOffset ?? offset;
    }
    return all;
  });

  const header = [
    "שם פרטי",
    "שם משפחה",
    "אימייל",
    "טלפון",
    "מוסד",
    "תואר",
    "שנה",
    "ממוצע",
    "שלב",
    "ציון כולל",
    "חשיבה",
    "עצמאות",
    "טכנולוגי",
    "מהירות",
    "אמינות",
    "הוגש בתאריך",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.firstName,
        r.lastName,
        r.email,
        r.phoneE164,
        r.institution,
        r.degreeProgram,
        r.studyYear,
        r.academicAverage,
        STAGE_LABELS_HE[r.stage],
        r.scoreOverall ?? "",
        r.scoreReasoning ?? "",
        r.scoreIndependence ?? "",
        r.scoreTech ?? "",
        r.scoreSpeed ?? "",
        r.integrityRisk ? INTEGRITY_LABELS_HE[r.integrityRisk] : "",
        formatDate(r.appliedAt),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\r\n"); // BOM so Excel opens Hebrew correctly

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidates.csv"`,
    },
  });
}
