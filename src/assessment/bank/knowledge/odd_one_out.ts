// knowledge.odd_one_out — three items from one technology category plus one
// outsider. ASSESSMENT_DESIGN.md §3.5.
//
// A speed-block family of the same name was retired in Round 3 because its
// categories were everyday vocabulary (weekdays, colours) — a children's
// puzzle. This one is categorically different: every group is a real
// technology family, so answering requires knowing what these things *are*.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const CATEGORIES: Array<{ name: string; members: string[] }> = [
  { name: "דפדפנים", members: ["Chrome", "Firefox", "Safari", "Edge"] },
  { name: "מערכות הפעלה", members: ["Windows", "Linux", "macOS", "Android"] },
  { name: "מסדי נתונים", members: ["PostgreSQL", "MySQL", "MongoDB", "SQLite"] },
  { name: "שפות תכנות", members: ["Python", "JavaScript", "Java", "Go"] },
  { name: "ספקי ענן", members: ["AWS", "Azure", "Google Cloud", "DigitalOcean"] },
  { name: "כלי ניהול גרסאות", members: ["Git", "SVN", "Mercurial", "Perforce"] },
  { name: "פורמטים של תמונה", members: ["PNG", "JPEG", "GIF", "WebP"] },
  { name: "פרוטוקולים", members: ["HTTP", "FTP", "SMTP", "SSH"] },
];

export const template: ItemTemplate = {
  id: "knowledge.odd_one_out",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const [home, away] = rng.sample(CATEGORIES, 2) as [
      (typeof CATEGORIES)[number],
      (typeof CATEGORIES)[number],
    ];
    const siblings = rng.sample(home.members, 3);
    const outsider = rng.pick(away.members);

    const { options, correctIndex } = shuffleOptions(rng, outsider, siblings);

    return {
      content: { prompt: "איזה מהבאים לא שייך לקבוצה?", options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
