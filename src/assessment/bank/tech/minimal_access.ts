// tech.minimal_access — ASSESSMENT_DESIGN.md §3.4 (renamed from
// tech.least_privilege per DECISIONS_LOG.md #8). A permission matrix +
// task -> the smallest grant that gets the task done; never assumes prior
// RBAC vocabulary.
//
// Difficulty scales via matrix size/shape and task complexity: d1 is a
// small 3-role cumulative ladder with a single-action task; d2 is the
// original 4-role cumulative ladder; d3 uses a 5-role matrix that is NOT a
// clean ladder (one role has a non-cumulative exception permission) plus a
// task requiring two actions at once, so the shortcut "just take the
// highest action index" heuristic no longer works — the candidate has to
// actually read the matrix.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const ROLES_SMALL = ["צופה", "עורך", "מנהל"];
const ACTIONS_SMALL = ["לצפות בדוחות", "לערוך טיוטה", "לפרסם דוח סופי"];

const ROLES = ["צופה", "עורך", "מפרסם", "מנהל"];
const ACTIONS = ["לצפות בדוחות", "לערוך טיוטה", "לפרסם דוח סופי", "לנהל הרשאות משתמשים"];

// role i can do actions 0..i (cumulative, matches a realistic RBAC ladder)
function canDoLadder(roleIdx: number, actionIdx: number): boolean {
  return actionIdx <= roleIdx;
}

function renderMatrix(roles: readonly string[], actions: readonly string[], canDo: (r: number, a: number) => boolean): string {
  const header = `| תפקיד | ${actions.join(" | ")} |`;
  const sep = `|---|${actions.map(() => "---").join("|")}|`;
  const rows = roles.map((role, r) => `| ${role} | ${actions.map((_, a) => (canDo(r, a) ? "✔" : "✘")).join(" | ")} |`).join("\n");
  return `${header}\n${sep}\n${rows}`;
}

const TASK_POOL_SMALL = [
  { actionIdx: 0, desc: "צריך רק לצפות בדוחות הקיימים, ולא לגעת בהם" },
  { actionIdx: 1, desc: "צריך לערוך טיוטת דוח לפני שהוא יוצא" },
  { actionIdx: 2, desc: "צריך לפרסם דוח סופי ללקוח" },
];

const TASK_POOL = [
  { actionIdx: 0, desc: "צריך רק לצפות בדוחות הקיימים, ולא לגעת בהם" },
  { actionIdx: 1, desc: "צריך לערוך טיוטת דוח לפני שהוא יוצא" },
  { actionIdx: 2, desc: "צריך לפרסם דוח סופי ללקוח" },
  { actionIdx: 3, desc: "צריך להוסיף עובד חדש למערכת ולתת לו הרשאה" },
];

// A 5-role matrix that is NOT a clean cumulative ladder: "auditor" (index 2)
// can view reports AND export logs (a specialized side permission) but
// cannot edit or publish — a genuine exception a "just take the max index"
// shortcut would get wrong.
const ROLES_HARD = ["צופה", "עורך", "מבקר (auditor)", "מפרסם", "מנהל"];
const ACTIONS_HARD = ["לצפות בדוחות", "לערוך טיוטה", "לייצא לוגי ביקורת", "לפרסם דוח סופי", "לנהל הרשאות משתמשים"];
// Explicit table, not a formula: role 2 (auditor) is a genuine exception to
// the ladder (view + export only), which is the whole point of this
// difficulty tier — an index-comparison shortcut gets it wrong.
// actions: 0=view, 1=edit draft, 2=export audit logs, 3=publish, 4=manage users
const HARD_PERMISSIONS: readonly (readonly number[])[] = [
  [0], // viewer
  [0, 1], // editor
  [0, 2], // auditor — exception: view + export, NOT edit/publish
  [0, 1, 3], // publisher
  [0, 1, 2, 3, 4], // admin — everything
];
function canDoHard(roleIdx: number, actionIdx: number): boolean {
  return (HARD_PERMISSIONS[roleIdx] ?? []).includes(actionIdx);
}

const TASK_POOL_HARD = [
  // Needs BOTH "edit draft" and "export audit logs" — only "מנהל" has both
  // (auditor lacks edit; editor lacks export).
  { desc: "צריך גם לערוך טיוטת דוח וגם לייצא את לוגי הביקורת שלו לצורך תיעוד", needsActions: [1, 2] },
  // Needs BOTH "view" and "export audit logs" — auditor already has both, and is smaller than editor+export (which isn't even possible below מנהל).
  { desc: "צריך רק לצפות בדוחות ולייצא את לוגי הביקורת שלהם — שום דבר אחר", needsActions: [0, 2] },
  { desc: "צריך לפרסם דוח סופי ללקוח, בלי צורך בייצוא לוגים", needsActions: [3] },
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
  generate(rng: Rng, difficulty: Difficulty) {
    if (difficulty === 1) {
      const task = rng.pick(TASK_POOL_SMALL);
      const minimalRoleIdx = ROLES_SMALL.findIndex((_, r) => canDoLadder(r, task.actionIdx));
      const correct = ROLES_SMALL[minimalRoleIdx] as string;
      const otherRoles = ROLES_SMALL.filter((_, r) => r !== minimalRoleIdx);
      const matrix = renderMatrix(ROLES_SMALL, ACTIONS_SMALL, canDoLadder);
      const prompt = `${matrix}\n\nמשימה: אדם בצוות ${task.desc}. איזה תפקיד הכי "קטן" (עם הכי מעט הרשאות) שעדיין מספיק כדי לבצע את המשימה?`;
      const { options, correctIndex } = shuffleOptions(rng, correct, otherRoles);
      return { content: { prompt, options }, answerKey: { kind: "single_choice", correctIndex } };
    }

    if (difficulty === 2) {
      const task = rng.pick(TASK_POOL);
      const minimalRoleIdx = ROLES.findIndex((_, r) => canDoLadder(r, task.actionIdx));
      const correct = ROLES[minimalRoleIdx] as string;
      const otherRoles = ROLES.filter((_, r) => r !== minimalRoleIdx);
      const matrix = renderMatrix(ROLES, ACTIONS, canDoLadder);
      const prompt = `${matrix}\n\nמשימה: אדם בצוות ${task.desc}. איזה תפקיד הכי "קטן" (עם הכי מעט הרשאות) שעדיין מספיק כדי לבצע את המשימה?`;
      const { options, correctIndex } = shuffleOptions(rng, correct, otherRoles);
      return { content: { prompt, options }, answerKey: { kind: "single_choice", correctIndex } };
    }

    // d3: non-ladder matrix + a two-action task.
    const task = rng.pick(TASK_POOL_HARD);
    const minimalRoleIdx = ROLES_HARD.findIndex((_, r) => task.needsActions.every((a) => canDoHard(r, a)));
    const correct = ROLES_HARD[minimalRoleIdx] as string;
    const otherRoles = ROLES_HARD.filter((_, r) => r !== minimalRoleIdx);
    const matrix = renderMatrix(ROLES_HARD, ACTIONS_HARD, canDoHard);
    const prompt = `${matrix}\n\nמשימה: אדם בצוות ${task.desc}. איזה תפקיד הכי "קטן" (עם הכי מעט הרשאות) שעדיין מספיק כדי לבצע את המשימה?`;
    const { options, correctIndex } = shuffleOptions(rng, correct, otherRoles);
    return { content: { prompt, options }, answerKey: { kind: "single_choice", correctIndex } };
  },
};
