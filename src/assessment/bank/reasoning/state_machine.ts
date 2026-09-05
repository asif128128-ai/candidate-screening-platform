// reasoning.state_machine — ASSESSMENT_DESIGN.md §3.2 worked example 4.
// SVG state diagram (4 states, transitions) + an event sequence -> final
// state. Any event not drawn from the current state is ignored.
import type { ItemTemplate, Difficulty } from "../../types";
import type { Rng } from "../../rng";
import { shuffleOptions } from "../helpers";

const STATES = ["Open", "InProgress", "Blocked", "Done"] as const;
type State = (typeof STATES)[number];

interface Transition {
  from: State;
  event: string;
  to: State;
}

const TRANSITIONS: Transition[] = [
  { from: "Open", event: "assign", to: "InProgress" },
  { from: "InProgress", event: "block", to: "Blocked" },
  { from: "Blocked", event: "unblock", to: "InProgress" },
  { from: "InProgress", event: "finish", to: "Done" },
  { from: "Done", event: "reopen", to: "Open" },
];

function renderDiagramText(): string {
  return TRANSITIONS.map((t) => `${t.from} --${t.event}--> ${t.to}`).join("\n");
}

function step(state: State, event: string): State {
  const t = TRANSITIONS.find((tr) => tr.from === state && tr.event === event);
  return t ? t.to : state; // any event not drawn from the current state is ignored
}

export const template: ItemTemplate = {
  id: "reasoning.state_machine",
  version: 1,
  pillar: "reasoning",
  kind: "single_choice",
  difficulties: [1, 2, 3],
  conventionsStated: "כל אירוע שלא מצויר מהמצב הנוכחי מתעלמים ממנו",
  generate(rng: Rng, difficulty: Difficulty) {
    const eventCount = difficulty === 1 ? 4 : difficulty === 2 ? 6 : 8;
    const allEvents = TRANSITIONS.map((t) => t.event);
    const events: string[] = [];
    for (let i = 0; i < eventCount; i++) events.push(rng.pick(allEvents));

    let state: State = "Open";
    for (const ev of events) state = step(state, ev);
    const correct = state;

    const wrongStates = STATES.filter((s) => s !== correct);
    const prompt =
      `${renderDiagramText()}\n\n(כל אירוע שלא מצויר מהמצב הנוכחי מתעלמים ממנו)\n\n` +
      `משימה מתחילה במצב \`Open\`. מתרחשים לפי הסדר האירועים: ${events.join(", ")}.\n\n` +
      "באיזה מצב המשימה בסוף?";

    const { options, correctIndex } = shuffleOptions(rng, correct, wrongStates);
    return {
      content: { prompt, options },
      answerKey: { kind: "single_choice", correctIndex },
    };
  },
};
