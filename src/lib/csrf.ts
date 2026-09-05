import { loadEnv } from "./env";

// ARCHITECTURE.md §6: "JSON route handlers require Content-Type:
// application/json and validate Origin against APP_BASE_URL." The CV
// upload route is multipart (not JSON) but is still a state-changing POST,
// so it gets the Origin half of this check.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin requests from older browsers may omit Origin; fail open here, rely on SameSite=Lax cookie
  const env = loadEnv();
  try {
    return new URL(origin).origin === new URL(env.APP_BASE_URL).origin;
  } catch {
    return false;
  }
}
