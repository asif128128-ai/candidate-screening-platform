// tech.minimal_access — ASSESSMENT_DESIGN.md §3.4 (renamed from
// tech.least_privilege per DECISIONS_LOG.md #8). A permission matrix +
// task -> the smallest grant that gets the task done; never assumes prior
// RBAC vocabulary.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const ROLES = ["צופה", "עורך", "מפרסם", "מנהל"];
const ACTIONS = ["לצפות בדוחות", "לערוך טיוטה", "לפרסם דוח סופי", "לנהל הרשאות משתמשים"];

// role i can do actions 0..i (cumulative, matches a realistic RBAC ladder)
function canDo(roleIdx: number, actionIdx: number): boolean {
  return actionIdx <= roleIdx;
}

function renderMatrix(): string {
  const header = `| תפקיד | ${ACTIONS.join(" | ")} |`;
  const sep = `|---|${ACTIONS.map(() => "---").join("|")}|`;
  const rows = ROLES.map(
    (role, r) => `| ${role} | ${ACTIONS.map((_, a) => (canDo(r, a) ? "✔" : "✘")).join(" | ")} |`,
  ).join("\n");
  return `${header}\n${sep}\n${rows}`;
}

const TASK_POOL = [
  { actionIdx: 0, desc: "צריך רק לצפות בדוחות הקיימים, ולא לגעת בהם" },
  { actionIdx: 1, desc: "צריך לערוך טיוטת דוח לפני שהוא יוצא" },
  { actionIdx: 2, desc: "צריך לפרסם דוח סופי ללקוח" },
  { actionIdx: 3, desc: "צריך להוסיף עובד חדש למערכת ולתת לו הרשאה" },
];

export const template: ItemTemplate = {
  id: "tech.minimal_access",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  // The full permission matrix is shown in the item itself (below), so the
  // answer is derivable from the artifact alone with no external RBAC
  // vocabulary assumed — same category as sql_outcome/table_lookup.
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const task = rng.pick(TASK_POOL);
    // The minimal role is the lowest-index role that still satisfies the action.
    const minimalRoleIdx = ROLES.findIndex((_, r) => canDo(r, task.actionIdx));
    const correct = ROLES[minimalRoleIdx] as string;
    // Distractors are every other role: some grant too little (can't do the
    // task at all), some grant more than needed (works, but not minimal) —
    // both are wrong answers to "the smallest role that still suffices".
    const otherRoles = ROLES.filter((_, r) => r !== minimalRoleIdx);

    const matrix = renderMatrix();
    const prompt =
      `${matrix}\n\n` +
      `משימה: אדם בצוות ${task.desc}. איזה תפקיד הכי "קטן" (עם הכי מעט הרשאות) שעדיין מספיק כדי לבצע את המשימה?`;

    const { options, correctIndex } = shuffleOptions(rng, correct, otherRoles);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
