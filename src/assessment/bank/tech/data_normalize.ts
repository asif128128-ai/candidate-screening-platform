// tech.data_normalize — ASSESSMENT_DESIGN.md §3.4. Column of messy
// phones/dates/names -> correct normalization rule.
//
// d1 keeps the phone-number case (a single well-known target format, E.164,
// with no ambiguity in the source values) plus a new equally
// single-rule email case. d2 keeps the dates and names cases, which each
// require noticing more than one thing at once (day/month ambiguity in the
// dates; splitting + whitespace + casing convention, all at once, for
// names) — genuinely more to reason about than "pick the one right format".
import type { Difficulty, ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  title: string;
  values: string[];
  correct: string;
  wrong: string[];
}

const CASES_EASY: Case[] = [
  {
    title: "טור מספרי טלפון",
    values: ["050-1234567", "0521234567", "+972-52-9876543", "03 6001234"],
    correct: 'להמיר את כולם לפורמט E.164 אחיד (למשל +972521234567) לפני שמירה, ולא רק להסיר מקפים',
    wrong: [
      "להשאיר כל מספר בפורמט שבו הוא הוזן במקור, כי כל מערכת שממירה מיוזמתה עלולה לפגוע בערכים תקינים",
      "להסיר רק את המקפים ולהשאיר את שאר ההבדלים בפורמט כפי שהם, מבלי לאחד קידומת מדינה",
      "לשמור רק את 4 הספרות האחרונות של כל מספר לצורך פרטיות, ולוותר על שאר הספרות במסד הנתונים",
    ],
  },
  {
    title: "טור כתובות אימייל",
    values: ["Dana@Example.com", " dana@example.com", "DANA@EXAMPLE.COM ", "dana@example.com"],
    correct: "להמיר הכול לאותיות קטנות ולהסיר רווחים מיותרים לפני שמירה, כדי שאותה כתובת לא תיחשב כפולה",
    wrong: [
      "להשאיר את הרישיות (אותיות גדולות/קטנות) כפי שהוזנה במקור, כי כתובות אימייל נחשבות רגישות לרישיות ברוב המקרים",
      "למחוק לגמרי כל רשומה שמכילה רווחים מיותרים בכתובת, במקום פשוט לנקות ולשמור אותה",
      "להוסיף רישיות אחידה של אות ראשונה גדולה בכל כתובת, בדומה למוסכמה המקובלת לשם פרטי",
    ],
  },
];

const CASES_MODERATE: Case[] = [
  {
    title: "טור תאריכים",
    values: ["01/02/2026", "2026-02-01", "1.2.26", "Feb 1, 2026"],
    correct: "להמיר את כולם לפורמט ISO אחיד (YYYY-MM-DD) כדי למנוע בלבול בין יום לחודש",
    wrong: [
      "להשאיר את כל התאריכים כטקסט חופשי בדיוק כפי שהוזנו, כדי לא לאבד מידע מקורי כלשהו",
      "להניח שכל התאריכים מוזנים באותו פורמט DD/MM/YYYY בלי לבדוק כל מקור בנפרד לפני ההמרה",
      "למחוק מראש כל תאריך שאינו כבר בפורמט ISO, במקום לנרמל אותו לפורמט האחיד הרצוי",
    ],
  },
  {
    title: 'טור שמות',
    values: ["דנה כהן", "כהן, דנה", "DANA COHEN", "דנה   כהן"],
    correct: "לפצל לשם פרטי ומשפחה בנפרד, לנרמל רווחים כפולים, ולהחליט על מוסכמה אחידה לרישיות (אותיות לטיניות)",
    wrong: [
      "להשאיר את כל השמות בדיוק כפי שהוזנו במקור, כולל הבדלי הסדר והרישיות בין המקורות השונים",
      "להמיר את כל השמות לאותיות גדולות בלבד ולא לגעת בסדר שם פרטי/משפחה או ברווחים הכפולים",
      "למחוק כל רשומה שמכילה רווחים כפולים בשם, במקום לנרמל אותם לרווח בודד ולשמור את הרשומה",
    ],
  },
];

export const template: ItemTemplate = {
  id: "tech.data_normalize",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1, 2],
  conventionsStated: "n/a",
  generate(rng: Rng, difficulty: Difficulty) {
    const c = rng.pick(difficulty === 1 ? CASES_EASY : CASES_MODERATE);
    const prompt = `${c.title} מגיע ממקורות שונים בפורמטים לא אחידים:\n\n${c.values.map((v) => `- \`${v}\``).join("\n")}\n\nמה כלל הנרמול הנכון לפני שמירה במסד הנתונים?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
