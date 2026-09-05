// tech.cloud_waste — ASSESSMENT_DESIGN.md §3.4. Resource list with usage
// -> which change saves the most without risk.
//
// Difficulty scales via how many resources are in play and how well the
// "trap" resources are disguised: d1 has a single blatant outlier and no
// real decoys; d2 (the original version) adds one legitimate decoy (a
// backup-role replica that looks wasteful but isn't) and one honeypot
// (very cheap, very idle, but tempting to "just delete"); d3 adds a fifth
// resource whose low usage is explained by a periodic (not idle) workload,
// so the correct pick requires comparing two similarly-idle-looking
// resources rather than spotting one obvious outlier.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Resource {
  name: string;
  spec: string;
  usagePct: number;
  monthlyCost: number;
  note?: string;
}

function renderResources(resources: Resource[]): string {
  const header = "| שרת | תצורה | ניצול ממוצע | עלות חודשית | הערה |";
  const sep = "|---|---|---|---|---|";
  const rows = resources
    .map((r) => `| ${r.name} | ${r.spec} | ${r.usagePct}% | ${r.monthlyCost} ₪ | ${r.note ?? "—"} |`)
    .join("\n");
  return `${header}\n${sep}\n${rows}`;
}

export const template: ItemTemplate = {
  id: "tech.cloud_waste",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    if (difficulty === 1) {
      // Blatant single outlier, no real decoys.
      const resources: Resource[] = [
        { name: "web-1", spec: "4 vCPU / 16GB", usagePct: rng.nextIntBetween(60, 85), monthlyCost: 900 },
        { name: "worker-2", spec: "8 vCPU / 32GB", usagePct: rng.nextIntBetween(2, 6), monthlyCost: 1800 },
        { name: "db-1", spec: "2 vCPU / 8GB", usagePct: rng.nextIntBetween(50, 70), monthlyCost: 600 },
      ];
      const table = renderResources(resources);
      const prompt = `${table}\n\nרשימת השרתים למעלה מציגה ניצול ממוצע (CPU) על פני החודש האחרון. איזה שינוי חוסך הכי הרבה בלי לפגוע בפעילות?`;
      const correct = "להקטין (downsize) את worker-2 — ניצול חד-ספרתי על תצורה יקרה מאוד הוא הבזבוז הגדול ביותר כאן";
      const wrong = [
        "להקטין את web-1 — הניצול שלו כבר גבוה יחסית, זה מסוכן",
        "להקטין את db-1 — הניצול שלו סביר, אין כאן בזבוז",
      ];
      const { options, correctIndex } = shuffleOptions(rng, correct, wrong);
      return { content: { prompt, options }, answerKey: { kind: "single_choice", correctIndex } };
    }

    if (difficulty === 2) {
      const resources: Resource[] = [
        { name: "web-1", spec: "4 vCPU / 16GB", usagePct: rng.nextIntBetween(60, 85), monthlyCost: 900 },
        { name: "worker-2", spec: "8 vCPU / 32GB", usagePct: rng.nextIntBetween(3, 8), monthlyCost: 1800 },
        { name: "db-replica", spec: "2 vCPU / 8GB", usagePct: rng.nextIntBetween(40, 60), monthlyCost: 600, note: "תפקיד גיבוי (backup replica)" },
        { name: "staging-clone", spec: "4 vCPU / 16GB", usagePct: rng.nextIntBetween(1, 4), monthlyCost: 900, note: "עותק staging" },
      ];
      const table = renderResources(resources);
      const prompt = `${table}\n\nרשימת השרתים למעלה מציגה ניצול ממוצע (CPU) על פני החודש האחרון. איזה שינוי חוסך הכי הרבה בלי לפגוע בפעילות?`;
      const correct = "להקטין (downsize) את worker-2 — ניצול חד-ספרתי על תצורה יקרה מאוד הוא הבזבוז הגדול ביותר כאן";
      const wrong = [
        "לכבות את db-replica — יש לה תפקיד גיבוי גם בניצול בינוני",
        "להקטין את web-1 — הניצול שלו כבר גבוה יחסית, זה מסוכן",
        "למחוק את staging-clone לגמרי בלי לבדוק אם היא בשימוש כרגע",
      ];
      const { options, correctIndex } = shuffleOptions(rng, correct, wrong);
      return { content: { prompt, options }, answerKey: { kind: "single_choice", correctIndex } };
    }

    // d3: a 5th resource looks just as idle as the real outlier, but its
    // note explains the low average — it only spikes during a periodic
    // batch job, so downsizing it (unlike worker-2) would cause an outage.
    const resources: Resource[] = [
      { name: "web-1", spec: "4 vCPU / 16GB", usagePct: rng.nextIntBetween(60, 85), monthlyCost: 900 },
      { name: "worker-2", spec: "8 vCPU / 32GB", usagePct: rng.nextIntBetween(3, 8), monthlyCost: 1800 },
      { name: "db-replica", spec: "2 vCPU / 8GB", usagePct: rng.nextIntBetween(40, 60), monthlyCost: 600, note: "תפקיד גיבוי (backup replica)" },
      { name: "staging-clone", spec: "4 vCPU / 16GB", usagePct: rng.nextIntBetween(1, 4), monthlyCost: 900, note: "עותק staging" },
      {
        name: "batch-runner",
        spec: "8 vCPU / 32GB",
        usagePct: rng.nextIntBetween(2, 7),
        monthlyCost: 1700,
        note: "מריץ עיבוד סוף-חודש בלבד (peak ~90%)",
      },
    ];
    const table = renderResources(resources);
    const prompt = `${table}\n\nרשימת השרתים למעלה מציגה ניצול ממוצע (CPU) על פני החודש האחרון. איזה שינוי חוסך הכי הרבה בלי לפגוע בפעילות?`;
    const correct = "להקטין (downsize) את worker-2 — ניצול חד-ספרתי על תצורה יקרה מאוד, וללא הסבר עסקי לפער כמו ב-batch-runner";
    const wrong = [
      "לכבות את db-replica — יש לה תפקיד גיבוי גם בניצול בינוני",
      "להקטין את batch-runner — הממוצע נמוך, אבל ההערה מסבירה שיש עומס תקופתי אמיתי בסוף החודש",
      "למחוק את staging-clone לגמרי בלי לבדוק אם היא בשימוש כרגע",
    ];
    const { options, correctIndex } = shuffleOptions(rng, correct, wrong);
    return { content: { prompt, options }, answerKey: { kind: "single_choice", correctIndex } };
  },
};
