// Types mirroring DATA_MODEL.md's enums and the `admin_application_rows`
// view (§4) exactly, so query code and UI code share one shape instead of
// each guessing at the DB's column names/types.

export type ApplicationStage =
  | "applied"
  | "assessment_started"
  | "assessment_completed"
  | "under_review"
  | "interview"
  | "rejected"
  | "hired";

export type IntegrityRisk = "low" | "medium" | "high";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type Pillar = "reasoning" | "independence" | "tech" | "speed";
export type ItemStatus = "pending" | "served" | "answered" | "expired" | "skipped";

/** One row of `admin_application_rows` (DATA_MODEL.md §4) — the view backing
 * the candidate list. Numeric columns arrive from postgres.js as strings for
 * `numeric` types; callers should Number() them at the boundary (done in
 * mapAdminApplicationRow below) rather than scattering casts everywhere. */
export interface AdminApplicationRow {
  applicationId: string;
  jobId: string;
  stage: ApplicationStage;
  stageChangedAt: Date;
  appliedAt: Date;
  canWorkRishon: boolean;
  dupPhone: boolean;
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string;
  institution: string;
  degreeProgram: string;
  studyYear: number;
  academicAverage: number;
  dateOfBirth: string;
  hasLinkedin: boolean;
  hasGithub: boolean;
  hasCv: boolean;
  sessionStatus: SessionStatus | null;
  assessmentStartedAt: Date | null;
  completedAt: Date | null;
  scoreOverall: number | null;
  scoreReasoning: number | null;
  scoreIndependence: number | null;
  scoreTech: number | null;
  scoreSpeed: number | null;
  confidence: number | null;
  integrityRisk: IntegrityRisk | null;
  pctRank: number | null;
}

interface RawAdminApplicationRow {
  application_id: string;
  job_id: string;
  stage: ApplicationStage;
  stage_changed_at: Date;
  applied_at: Date;
  can_work_rishon: boolean;
  dup_phone: boolean;
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_e164: string;
  institution: string;
  degree_program: string;
  study_year: number;
  academic_average: string | number;
  date_of_birth: string;
  has_linkedin: boolean;
  has_github: boolean;
  has_cv: boolean;
  session_status: SessionStatus | null;
  assessment_started_at: Date | null;
  completed_at: Date | null;
  score_overall: string | number | null;
  score_reasoning: string | number | null;
  score_independence: string | number | null;
  score_tech: string | number | null;
  score_speed: string | number | null;
  confidence: string | number | null;
  integrity_risk: IntegrityRisk | null;
  pct_rank: string | number | null;
}

function toNum(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : Number(v);
}

export function mapAdminApplicationRow(r: RawAdminApplicationRow): AdminApplicationRow {
  return {
    applicationId: r.application_id,
    jobId: r.job_id,
    stage: r.stage,
    stageChangedAt: r.stage_changed_at,
    appliedAt: r.applied_at,
    canWorkRishon: r.can_work_rishon,
    dupPhone: r.dup_phone,
    candidateId: r.candidate_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phoneE164: r.phone_e164,
    institution: r.institution,
    degreeProgram: r.degree_program,
    studyYear: r.study_year,
    academicAverage: toNum(r.academic_average) ?? 0,
    dateOfBirth: r.date_of_birth,
    hasLinkedin: r.has_linkedin,
    hasGithub: r.has_github,
    hasCv: r.has_cv,
    sessionStatus: r.session_status,
    assessmentStartedAt: r.assessment_started_at,
    completedAt: r.completed_at,
    scoreOverall: toNum(r.score_overall),
    scoreReasoning: toNum(r.score_reasoning),
    scoreIndependence: toNum(r.score_independence),
    scoreTech: toNum(r.score_tech),
    scoreSpeed: toNum(r.score_speed),
    confidence: toNum(r.confidence),
    integrityRisk: r.integrity_risk,
    pctRank: toNum(r.pct_rank),
  };
}
