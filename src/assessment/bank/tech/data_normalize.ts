// tech.data_normalize — ASSESSMENT_DESIGN.md §3.4. Column of messy
// phones/dates/names -> correct normalization rule.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Case {
  title: string;
  values: string[];
  correct: string;
  wrong: string[];
}

const CASES: Case[] = [
  {
    title: "טור מספרי טלפון",
    values: ["050-1234567", "0521234567", "+972-52-9876543", "03 6001234"],
    correct: 'להמיר את כולם לפורמט E.164 אחיד (למשל +972521234567) לפני שמירה, ולא רק להסיר מקפים',
    wrong: [
      "להשאיר כל מספר בפורמט שבו הוא הוזן",
      "להסיר רק את המקפים ולהשאיר את שאר הפורמט",
      "לשמור רק את 4 הספרות האחרונות לצורך פרטיות",
    ],
  },
  {
    title: "טור תאריכים",
    values: ["01/02/2026", "2026-02-01", "1.2.26", "Feb 1, 2026"],
    correct: "להמיר את כולם לפורמט ISO אחיד (YYYY-MM-DD) כדי למנוע בלבול בין יום לחודש",
    wrong: [
      "להשאיר את כל התאריכים כטקסט חופשי",
      "להניח שכולם באותו פורמט DD/MM/YYYY בלי לבדוק",
      "למחוק כל תאריך שלא בפורמט ISO מראש",
    ],
  },
  {
    title: 'טור שמות',
    values: ["דנה כהן", "כהן, דנה", "DANA COHEN", "דנה   כהן"],
    correct: "לפצל לשם פרטי ומשפחה בנפרד, לנרמל רווחים כפולים, ולהחליט על מוסכמה אחידה לרישיות (אותיות לטיניות)",
    wrong: [
      "להשאיר את כל השמות כפי שהוזנו במקור",
      "להמיר הכול לאותיות גדולות בלבד ולא לגעת בשאר",
      "למחוק רשומות עם רווחים כפולים",
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
  generate(rng: Rng) {
    const c = rng.pick(CASES);
    const prompt = `${c.title} מגיע ממקורות שונים בפורמטים לא אחידים:\n\n${c.values.map((v) => `- \`${v}\``).join("\n")}\n\nמה כלל הנרמול הנכון לפני שמירה במסד הנתונים?`;
    const { options, correctIndex } = shuffleOptions(rng, c.correct, c.wrong);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
