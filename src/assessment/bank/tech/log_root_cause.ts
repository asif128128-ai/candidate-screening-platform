// tech.log_root_cause — ASSESSMENT_DESIGN.md §3.4. 6-line log with one
// causal chain and one red herring -> most likely cause. conventions_stated: n/a.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";
import { pad2, shuffleOptions } from "../helpers";

interface Scenario {
  buildLog: (rng: Rng) => string;
  correct: string;
  wrong: string[];
}

const SCENARIOS: Scenario[] = [
  {
    buildLog: (r) => {
      const t0 = r.nextIntBetween(9, 11);
      return [
        `${pad2(t0)}:00:01 INFO  db-pool  size=20 in_use=19`,
        `${pad2(t0)}:00:04 WARN  db-pool  in_use=20 waiting=3`,
        `${pad2(t0)}:00:07 ERROR api      request timeout after 5000ms (waiting for db connection)`,
        `${pad2(t0)}:00:08 ERROR api      request timeout after 5000ms (waiting for db connection)`,
        `${pad2(t0)}:00:09 INFO  cache    hit_rate=0.91`,
        `${pad2(t0)}:00:11 ERROR api      request timeout after 5000ms (waiting for db connection)`,
      ].join("\n");
    },
    correct: "מאגר חיבורי הדאטהבייס (connection pool) התמלא, ובקשות ממתינות לחיבור פנוי עד שהן פוקעות בזמן",
    wrong: [
      "שיעור הפגיעה במטמון (cache hit rate) ירד מתחת לסף הסביר, וזה מה שגורם לבקשות להתעכב ולפקוע",
      "השרת עצמו קרס בפתאומיות ולא מגיב לאף בקשה נכנסת חדשה, וזו הסיבה לשגיאות התזמון שנרשמות בלוג",
      "יש בעיית רשת חיצונית שלא קשורה כלל למערכת הפנימית, וזו הסיבה שהבקשות לא מגיעות לשרת מלכתחילה",
    ],
  },
  {
    buildLog: (r) => {
      const t0 = r.nextIntBetween(1, 5);
      return [
        `${pad2(t0)}:12:01 INFO  deploy   version=2.4.1 rolled out`,
        `${pad2(t0)}:12:03 INFO  cache    hit_rate=0.88`,
        `${pad2(t0)}:12:05 ERROR api      500 Internal Server Error path=/orders`,
        `${pad2(t0)}:12:06 ERROR api      TypeError: cannot read property 'total' of undefined`,
        `${pad2(t0)}:12:07 ERROR api      500 Internal Server Error path=/orders`,
        `${pad2(t0)}:12:09 INFO  auth     login ok user=771`,
      ].join("\n");
    },
    correct: "הפריסה האחרונה (version 2.4.1) הכניסה שגיאת קוד בנתיב /orders",
    wrong: [
      "המשתמש 771 לא הצליח להתחבר בזמן, וזו הסיבה לשגיאות 500 שנרשמות בנתיב ה-orders",
      "שיעור הפגיעה במטמון ירד באופן חד, וזה מה שגורם לשגיאות ה-500 בנתיב /orders",
      "יש בעיה בהרשאות של המשתמש שמונעת ממנו לגשת לנתיב /orders, וזה מה שמניב את השגיאות",
    ],
  },
  {
    buildLog: (r) => {
      const t0 = r.nextIntBetween(14, 20);
      return [
        `${pad2(t0)}:30:00 INFO  worker   queue_size=5`,
        `${pad2(t0)}:30:15 INFO  worker   queue_size=40`,
        `${pad2(t0)}:30:16 WARN  worker   queue_size=120`,
        `${pad2(t0)}:30:17 ERROR worker   OOM: heap limit exceeded`,
        `${pad2(t0)}:30:18 INFO  cache    hit_rate=0.85`,
        `${pad2(t0)}:30:20 ERROR worker   process restarted after crash`,
      ].join("\n");
    },
    correct: "תור המשימות (queue) גדל מהר יותר משהעובד (worker) מספיק לעבד, וגרם לחריגת זיכרון",
    wrong: [
      "שיעור הפגיעה במטמון ירד בפתאומיות, וזה מה שגרם לעובד (worker) לחרוג מהזיכרון ולקרוס",
      "יש בעיית הרשאות בעובד (worker) שמונעת ממנו לגשת לתור, וזו הסיבה לחריגת הזיכרון",
      "השרת הופעל מחדש בכוונה לצורך תחזוקה מתוכננת, וזו הסיבה לגידול החד בתור המשימות",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.log_root_cause",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const scenario = rng.pick(SCENARIOS);
    const log = scenario.buildLog(rng);
    const distractorCount = difficulty === 1 ? 2 : 3;
    const distractors = rng.sample(scenario.wrong, distractorCount);

    const prompt = `\`\`\`\n${log}\n\`\`\`\n\nמה הסיבה הסבירה ביותר לבעיה?`;
    const { options, correctIndex } = shuffleOptions(rng, scenario.correct, distractors);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
