import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link/redirect/router helpers for candidate pages
// (owned by the candidate-flow engineer — CANDIDATE_FLOW.md).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
