"use client";

import { useState, useTransition } from "react";
import { reconcileCvFilesAction } from "./actions";

export function ReconcileButtonClient() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ orphaned: string[]; error: string | null } | null>(null);

  return (
    <div>
      <button
        onClick={() => startTransition(async () => setResult(await reconcileCvFilesAction()))}
        disabled={isPending}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
      >
        בדיקת קבצים
      </button>
      {result?.error && <p className="mt-2 text-xs text-red-700">{result.error}</p>}
      {result && !result.error && (
        <p className="mt-2 text-xs text-neutral-600">
          {result.orphaned.length === 0 ? "לא נמצאו קבצים יתומים." : `נמצאו ${result.orphaned.length} קבצים יתומים: ${result.orphaned.join(", ")}`}
        </p>
      )}
    </div>
  );
}
