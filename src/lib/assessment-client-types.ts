// Client-safe type mirrors of the assessment hot-path API's JSON shapes.
// Deliberately does NOT import src/db/queries/assessment.ts (server-only:
// node:crypto, postgres) — only `import type` from the pure assessment/*
// modules, which erase completely at compile time and add nothing to the
// client bundle (ARCHITECTURE.md §7's runner bundle budget).

import type { ItemContent, ItemKind } from "@/assessment/types";

export interface ClientCurrentItem {
  itemId: string;
  position: number;
  totalItems: number;
  blockKey: string;
  pillar: string;
  kind: ItemKind;
  difficulty: number;
  timeLimitS: number;
  content: ItemContent;
  servedAt: string;
  deadlineAt: string;
  outageCreditMs: number;
  itemToken: string;
}

export type CurrentApiResponse =
  | { status: "active"; item: ClientCurrentItem; serverNow: string; sessionExpiresAt: string }
  | { status: "completed"; redirectTo: string }
  | { error: string };

export type AnswerApiResponse =
  | { status: "active"; item: ClientCurrentItem; serverNow: string; sessionExpiresAt: string }
  | { status: "block_boundary"; nextBlockKey: string; nextPosition: number }
  | { status: "completed"; redirectTo: string }
  | { error: string };
