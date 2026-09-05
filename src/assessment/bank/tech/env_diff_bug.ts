// tech.env_diff_bug — ASSESSMENT_DESIGN.md §3.4 worked example 7. .env for
// staging vs prod with one meaningful diff + one harmless -> why prod fails.
// conventions_stated: n/a (derivable from the artifact alone).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  error: string;
  meaningfulKey: string;
  stagingVal: string;
  prodVal: string;
  harmlessKey: string;
  stagingHarmless: string;
  prodHarmless: string;
  correct: string;
  wrong: string[];
}

const CASES: Case[] = [
  {
    error: "connect ETIMEDOUT",
    meaningfulKey: "DATABASE_URL",
    stagingVal: "postgres://app:***@db-stg.internal:5432/app",
    prodVal: "postgres://app:***@db-prod.internal:5433/app",
    harmlessKey: "LOG_LEVEL",
    stagingHarmless: "debug",
    prodHarmless: "info",
    correct: "הפורט של מסד הנתונים ב-production שונה (5433) — כנראה שגיאת הקלדה או שהחומה (firewall) לא פותחת אותו",
    wrong: [
      "LOG_LEVEL=info מסתיר את השגיאה האמיתית",
      "ALLOWED_ORIGIN שונה ולכן הדפדפן חוסם את הבקשה",
      "DB_POOL_SIZE קטן מדי ל-production",
    ],
  },
  {
    error: "ECONNREFUSED to redis",
    meaningfulKey: "REDIS_URL",
    stagingVal: "redis://cache-stg.internal:6379",
    prodVal: "redis://cache-stg.internal:6380",
    harmlessKey: "NODE_ENV",
    stagingHarmless: "staging",
    prodHarmless: "production",
    correct: "REDIS_URL ב-production עדיין מצביע לשרת staging (cache-stg) אבל על פורט אחר שלא פתוח שם",
    wrong: [
      "NODE_ENV=production גורם ל-Node לחסום חיבורים",
      "אין קשר בין שגיאת Redis לבין קובץ הסביבה",
      "צריך להתקין מחדש את חבילת ה-Redis client",
    ],
  },
  {
    error: "certificate signed by unknown authority",
    meaningfulKey: "API_BASE_URL",
    stagingVal: "https://api-stg.example.co.il",
    prodVal: "http://api.example.co.il",
    harmlessKey: "TIMEOUT_MS",
    stagingHarmless: "5000",
    prodHarmless: "8000",
    correct: "ב-production הכתובת עברה ל-http (לא https) בעוד שקוד הלקוח מצפה לאישור TLS — כנראה טעות בהעתקה של הכתובת",
    wrong: [
      "TIMEOUT_MS גבוה מדי גורם לשגיאת אישור",
      "יש להאריך את תוקף התעודה הדיגיטלית של הלקוח",
      "צריך לשנות את גרסת Node בפרודקשן",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.env_diff_bug",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const c = rng.pick(CASES);
    const stagingEnv = `# staging\n${c.meaningfulKey}=${c.stagingVal}\n${c.harmlessKey}=${c.stagingHarmless}`;
    const prodEnv = `# production\n${c.meaningfulKey}=${c.prodVal}\n${c.harmlessKey}=${c.prodHarmless}`;

    const prompt =
      `האפליקציה עובדת ב-staging ונכשלת ב-production עם השגיאה \`${c.error}\`. אלה קובצי הסביבה (ערכים סודיים הוסתרו):\n\n` +
      `\`\`\`\n${stagingEnv}\n\n${prodEnv}\n\`\`\`\n\nמה ההסבר הסביר ביותר?`;

    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
