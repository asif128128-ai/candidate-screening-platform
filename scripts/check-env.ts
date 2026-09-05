// DEPLOYMENT.md §2, §3: runs at process start (`prestart`) and refuses to
// boot with a readable Hebrew/English message if any required variable is
// missing or malformed.
import "dotenv/config";
import { loadEnv, assertProductionInvariants } from "../src/lib/env";

try {
  const env = loadEnv();
  assertProductionInvariants(env);
  console.log("[check-env] OK — environment looks valid.");
  process.exit(0);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
