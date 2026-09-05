// tech.cloud_waste — ASSESSMENT_DESIGN.md §3.4. Resource list with usage
// -> which change saves the most without risk.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Resource {
  name: string;
  spec: string;
  usagePct: number;
  monthlyCost: number;
}

function renderResources(resources: Resource[]): string {
  const header = "| שרת | תצורה | ניצול ממוצע | עלות חודשית |";
  const sep = "|---|---|---|---|";
  const rows = resources
    .map((r) => `| ${r.name} | ${r.spec} | ${r.usagePct}% | ${r.monthlyCost} ₪ |`)
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
  generate(rng: Rng) {
    const resources: Resource[] = [
      { name: "web-1", spec: "4 vCPU / 16GB", usagePct: rng.nextIntBetween(60, 85), monthlyCost: 900 },
      { name: "worker-2", spec: "8 vCPU / 32GB", usagePct: rng.nextIntBetween(3, 8), monthlyCost: 1800 },
      { name: "db-replica", spec: "2 vCPU / 8GB", usagePct: rng.nextIntBetween(40, 60), monthlyCost: 600 },
      { name: "staging-clone", spec: "4 vCPU / 16GB", usagePct: rng.nextIntBetween(1, 4), monthlyCost: 900 },
    ];
    // Ensure exactly one resource is the clear low-usage / high-cost outlier
    // (worker-2), and one very-low-usage cheap resource (staging-clone) to
    // create a real "biggest win without risk" decision rather than an
    // obvious single outlier.

    const table = renderResources(resources);
    const prompt =
      `${table}\n\nרשימת השרתים למעלה מציגה ניצול ממוצע (CPU) על פני החודש האחרון. איזה שינוי חוסך הכי הרבה בלי לפגוע בפעילות?`;

    const correct = "להקטין (downsize) את worker-2 — ניצול חד-ספרתי על תצורה יקרה מאוד הוא הבזבוז הגדול ביותר כאן";
    const wrong = [
      "לכבות את db-replica — יש לה תפקיד גיבוי גם בניצול בינוני",
      "להקטין את web-1 — הניצול שלו כבר גבוה יחסית, זה מסוכן",
      "למחוק את staging-clone לגמרי בלי לבדוק אם היא בשימוש כרגע",
    ];

    const { options, correctIndex } = shuffleOptions(rng, correct, wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
