// DEPLOYMENT.md §8 step 11 (smoke test): force the hourly sweep to run
// immediately instead of waiting for the lock to expire, e.g. to prove a
// deleted candidate's CV actually leaves the bucket. Bypasses the
// once-per-hour throttle deliberately — never call this from a request
// handler, only from the CLI.
import "dotenv/config";
import { withSystem } from "../src/db/postgres";

async function main() {
  await withSystem(async (tx) => {
    await tx`update maintenance set last_sweep = 'epoch'`;
    await tx`select run_maintenance_sweep()`;
  });
  console.log("[sweep:now] sweep forced.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
