// speed.odd_one_out — ASSESSMENT_DESIGN.md §3.1, restricted per
// DECISIONS_LOG.md #8 to non-trivia, everyday/technical-generic categories
// (never protocol trivia).
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

interface Category {
  name: string;
  members: string[];
}

const CATEGORIES: Category[] = [
  { name: "ימי השבוע", members: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] },
  { name: "צבעים", members: ["אדום", "כחול", "ירוק", "צהוב", "סגול", "כתום", "ורוד"] },
  {
    name: "סוגי קבצי תמונה",
    members: [".png", ".jpg", ".gif", ".svg", ".webp", ".bmp"],
  },
  { name: "יחידות משקל", members: ["גרם", "קילוגרם", "טון", "מיליגרם"] },
  { name: "יחידות אורך", members: ["מטר", "ס\"מ", "ק\"מ", "מילימטר"] },
  { name: "עונות השנה", members: ["חורף", "אביב", "קיץ", "סתיו"] },
  { name: "כלי תחבורה יבשתית", members: ["אוטובוס", "רכבת", "מכונית", "אופניים", "קטנוע"] },
  { name: "כלי מטבח", members: ["סכין", "מזלג", "כף", "צלחת", "קערה"] },
  { name: "סוגי קבצי מסמך", members: [".pdf", ".docx", ".txt", ".pptx"] },
  { name: "יחידות זמן", members: ["שנייה", "דקה", "שעה", "יום", "שבוע"] },
];

export const template: ItemTemplate = {
  id: "speed.odd_one_out",
  version: 1,
  pillar: "speed",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const [mainCat, otherCat] = rng.sample(CATEGORIES, 2) as [Category, Category];
    const threeFromMain = rng.sample(mainCat.members, 3);
    const oneFromOther = rng.pick(otherCat.members);

    const prompt = "שלושה מהפריטים הבאים שייכים לאותה קטגוריה, ואחד שונה. איזה?";
    const { options, correctIndex } = shuffleOptions(rng, oneFromOther, threeFromMain);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
