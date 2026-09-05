import type { ZodError } from "zod";

// Shared shape for `useActionState` field-level errors across the
// candidate-flow forms (step 1/2/3, resume, privacy).
export interface FieldErrors {
  [field: string]: string;
}

export function zodErrorsToRecord(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key] = issue.message;
    }
  }
  return out;
}
