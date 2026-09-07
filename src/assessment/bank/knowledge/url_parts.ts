// knowledge.url_parts — reading the anatomy of a URL, including what `www`
// actually is. ASSESSMENT_DESIGN.md §3.5.
//
// Generated rather than hand-written so the answer is never a memorized
// string: the URL is assembled from random parts each time and the item asks
// about a randomly chosen component of it.
import type { ItemTemplate } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const HOSTS = ["shop", "crm", "portal", "data", "app", "reports"];
const DOMAINS = ["example", "hachevra", "metargem", "orenlog", "shivuk"];
const TLDS = ["co.il", "com", "net", "org"];
const PATHS = ["orders", "users/42", "reports/monthly", "api/v2/items", "settings/billing"];
const QUERIES = ["page=2", "status=open", "from=2026-01-01", "limit=50"];

type Part = "protocol" | "subdomain" | "domain" | "path" | "query";

const ASK: Record<Part, string> = {
  protocol: "מהו הפרוטוקול בכתובת הבאה?",
  subdomain: "מהו תת-הדומיין (subdomain) בכתובת הבאה?",
  domain: "מהו הדומיין בכתובת הבאה?",
  path: "מהו הנתיב (path) בכתובת הבאה?",
  query: "מהם פרמטרי השאילתה (query) בכתובת הבאה?",
};

export const template: ItemTemplate = {
  id: "knowledge.url_parts",
  version: 1,
  pillar: "tech",
  kind: "single_choice",
  difficulties: [1],
  conventionsStated: "n/a",
  generate(rng: Rng) {
    const protocol = rng.pick(["https", "http"]);
    // `www` is deliberately in the subdomain pool: candidates routinely think
    // it is a required part of every address rather than one subdomain among
    // many, and this is the item that surfaces that.
    const subdomain = rng.pick([...HOSTS, "www"]);
    const domain = rng.pick(DOMAINS);
    const tld = rng.pick(TLDS);
    const path = rng.pick(PATHS);
    const query = rng.pick(QUERIES);

    const url = `${protocol}://${subdomain}.${domain}.${tld}/${path}?${query}`;

    const values: Record<Part, string> = {
      protocol,
      subdomain,
      domain: `${domain}.${tld}`,
      path: `/${path}`,
      query,
    };

    const part = rng.pick(Object.keys(values) as Part[]);
    const correct = values[part];
    const distractors = (Object.keys(values) as Part[])
      .filter((p) => p !== part)
      .map((p) => values[p])
      .filter((v) => v !== correct);

    const { options, correctIndex } = shuffleOptions(rng, correct, rng.sample(distractors, 3));

    return {
      content: { prompt: `${ASK[part]}\n\n\`${url}\``, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
