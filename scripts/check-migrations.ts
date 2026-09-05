// DEPLOYMENT.md §5, §13: CI check enforcing the expand/contract rule.
// Fails on DROP COLUMN / DROP TABLE / RENAME / ALTER ... SET NOT NULL /
// ALTER ... TYPE in any migration file newer than the last-deployed one,
// unless the statement is preceded by a `-- contract: <release>` comment
// on its own line directly above it.
//
// "Newer than the last-deployed one" is approximated here as: any
// migration file that is new or modified relative to the `main` branch
// (via `git diff --name-only origin/main...HEAD`), which is what the CI
// job in DEPLOYMENT.md §13 runs on every PR. Falls back to checking every
// migration file if git history isn't available (e.g. a shallow clone).
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DESTRUCTIVE = [
  /\bdrop\s+column\b/i,
  /\bdrop\s+table\b/i,
  /\brename\b/i,
  /\balter\s+.*\bset\s+not\s+null\b/i,
  /\balter\s+.*\btype\b/i,
];

function changedMigrationFiles(): string[] {
  try {
    const out = execSync("git diff --name-only origin/main...HEAD -- supabase/migrations", {
      encoding: "utf8",
    }).trim();
    return out ? out.split("\n") : [];
  } catch {
    const dir = join(process.cwd(), "supabase", "migrations");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => join("supabase", "migrations", f));
  }
}

function checkFile(path: string): string[] {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return []; // file was deleted in this diff
  }
  const lines = content.split("\n");
  const problems: string[] = [];

  lines.forEach((line, i) => {
    if (DESTRUCTIVE.some((re) => re.test(line))) {
      const prev = lines[i - 1] ?? "";
      if (!/^\s*--\s*contract:/i.test(prev)) {
        problems.push(
          `${path}:${i + 1}: destructive statement without a preceding "-- contract: <release>" comment:\n    ${line.trim()}`,
        );
      }
    }
  });

  return problems;
}

function main() {
  const files = changedMigrationFiles().filter((f) => f.endsWith(".sql"));
  const allProblems = files.flatMap(checkFile);

  if (allProblems.length > 0) {
    console.error("Migration expand/contract check failed:\n");
    for (const p of allProblems) console.error(`  - ${p}`);
    console.error(
      '\nIf this is a deliberate, reviewed contract step, prefix the statement with a\n' +
        '"-- contract: <release that stopped using it>" comment on the line above it.',
    );
    process.exit(1);
  }

  console.log(`[check-migrations] OK — ${files.length} migration file(s) checked, no unguarded destructive statements.`);
}

main();
