// tech.env_diff_bug — ASSESSMENT_DESIGN.md §3.4 worked example 7. .env for
// staging vs prod with one meaningful diff + one harmless -> why prod fails.
// conventions_stated: n/a (derivable from the artifact alone).
//
// Difficulty scales via how many harmless-looking vars surround the real
// diff, and how directly the error message points at it: d1 has a single
// harmless var and an error message that names the failing subsystem; d2 is
// the original two-harmless-var version; d3 adds a second harmless-looking
// var (a more plausible red herring) and a more generic error message that
// doesn't hand the candidate the subsystem for free.
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface HarmlessVar {
  key: string;
  stagingVal: string;
  prodVal: string;
}

interface Case {
  error: string;
  meaningfulKey: string;
  stagingVal: string;
  prodVal: string;
  harmlessKey: string;
  stagingHarmless: string;
  prodHarmless: string;
  /** d3 only: a second, more-plausible-looking harmless var. */
  extraHarmless?: HarmlessVar;
  /** d3 only: a more generic error message that doesn't name the subsystem. */
  genericError?: string;
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
    extraHarmless: { key: "CACHE_TTL_SECONDS", stagingVal: "60", prodVal: "300" },
    genericError: "האפליקציה נתקעת ונכשלת אחרי כ-30 שניות מדי פעם",
    correct: "הפורט של מסד הנתונים ב-production שונה (5433) — כנראה שגיאת הקלדה או שהחומה (firewall) לא פותחת אותו",
    wrong: [
      "LOG_LEVEL=info ב-production מסתיר לגמרי את השגיאה האמיתית שהייתה אמורה להופיע ברמת debug בסביבת staging",
      "ALLOWED_ORIGIN שונה בטעות בין שתי הסביבות, ולכן הדפדפן חוסם את הבקשה לפני שהיא בכלל מגיעה לשרת",
      "DB_POOL_SIZE קטן מדי משמעותית ל-production, כך שהחיבורים נתקעים בהמתנה ארוכה עד לפקיעת הזמן",
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
    extraHarmless: { key: "FEATURE_FLAG_NEW_CHECKOUT", stagingVal: "false", prodVal: "true" },
    genericError: "האפליקציה נכשלת מדי פעם כשהיא מנסה לגשת לשירות פנימי",
    correct: "REDIS_URL ב-production עדיין מצביע לשרת staging (cache-stg) אבל על פורט אחר שלא פתוח שם",
    wrong: [
      "NODE_ENV=production גורם ל-Node לחסום חיבורים יוצאים לשירותים פנימיים כמו Redis באופן מובנה",
      "אין קשר בין שגיאת ה-Redis לבין קובץ הסביבה, מדובר בתקלה זמנית ברשת של הספק",
      "צריך להתקין מחדש את חבילת ה-Redis client, כי הגרסה הנוכחית כנראה פגומה או לא תואמת",
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
    extraHarmless: { key: "CDN_ENABLED", stagingVal: "false", prodVal: "true" },
    genericError: "בקשות מהלקוח נכשלות מיד אחרי שהן נשלחות",
    correct: "ב-production הכתובת עברה ל-http (לא https) בעוד שקוד הלקוח מצפה לאישור TLS — כנראה טעות בהעתקה של הכתובת",
    wrong: [
      "TIMEOUT_MS גבוה מדי משמעותית בהגדרות ה-production, וגורם לשגיאת אישור עוד לפני שהחיבור מספיק להיסגר כראוי",
      "יש להאריך בדחיפות את תוקף התעודה הדיגיטלית של הלקוח שפגה בטעות בזמן הפריסה האחרונה שבוצעה",
      "צריך לשנות בהקדם את גרסת Node בפרודקשן, כי הגרסה הישנה לא תומכת כראוי בפרוטוקול TLS העדכני",
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
  generate(rng: Rng, difficulty: Difficulty) {
    const c = rng.pick(CASES);
    // d1: no harmless decoy var at all (only the real diff is visible) — the
    // simplest possible version. d2: the original single-decoy version. d3:
    // a second, more-plausible decoy on top.
    const harmless: HarmlessVar[] =
      difficulty === 1
        ? []
        : difficulty === 2
          ? [{ key: c.harmlessKey, stagingVal: c.stagingHarmless, prodVal: c.prodHarmless }]
          : [
              { key: c.harmlessKey, stagingVal: c.stagingHarmless, prodVal: c.prodHarmless },
              ...(c.extraHarmless ? [c.extraHarmless] : []),
            ];
    const stagingEnv = [
      `# staging`,
      `${c.meaningfulKey}=${c.stagingVal}`,
      ...harmless.map((e) => `${e.key}=${e.stagingVal}`),
    ].join("\n");
    const prodEnv = [
      `# production`,
      `${c.meaningfulKey}=${c.prodVal}`,
      ...harmless.map((e) => `${e.key}=${e.prodVal}`),
    ].join("\n");

    // d3 uses a more generic error message that doesn't name the failing
    // subsystem, forcing the diff itself (not the error text) to carry the
    // reasoning.
    const errorText = difficulty === 3 && c.genericError ? c.genericError : c.error;

    const prompt =
      `האפליקציה עובדת ב-staging ונכשלת ב-production עם השגיאה \`${errorText}\`. אלה קובצי הסביבה (ערכים סודיים הוסתרו):\n\n` +
      `\`\`\`\n${stagingEnv}\n\n${prodEnv}\n\`\`\`\n\nמה ההסבר הסביר ביותר?`;

    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
