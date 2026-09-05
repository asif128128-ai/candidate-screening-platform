import type postgres from "postgres";
import { Resend } from "resend";
import { loadEnv } from "@/lib/env";
import { withSystem } from "@/db/postgres";
import {
  renderAdminInviteNotice,
  renderApplicationReceived,
  renderNotMovingForward,
  renderResumeOtp,
  type EmailContent,
} from "./templates";

// ARCHITECTURE.md §1 / §8 "Email deliverability": "Rows are inserted
// transactionally and delivered right after commit (same request) with
// retry by the sweep." `enqueueEmail` does the transactional insert (call
// it from inside a candidate/system transaction); `sendQueuedEmailBestEffort`
// does the post-commit delivery attempt — failures are swallowed (the row
// stays pending with `attempts` incremented for the sweep to retry) because
// a candidate's request must never fail just because Resend had a bad
// moment (ARCHITECTURE.md §8 "email failures never block a candidate flow").

export type EmailTemplate =
  | "application_received"
  | "resume_otp"
  | "not_moving_forward"
  | "admin_invite_notice";

export interface EnqueueEmailInput {
  toEmail: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
  applicationId?: string;
}

/** Inserts a row into `email_outbox`. Call inside an already-open transaction so it commits atomically with the rest of the request. */
export async function enqueueEmail(
  tx: postgres.TransactionSql,
  input: EnqueueEmailInput,
): Promise<number> {
  const rows = await tx<{ id: number }[]>`
    insert into email_outbox (to_email, template, payload, application_id)
    values (${input.toEmail}, ${input.template}, ${JSON.stringify(input.payload)}::jsonb, ${input.applicationId ?? null})
    returning id
  `;
  return rows[0]!.id;
}

function renderTemplate(template: EmailTemplate, payload: Record<string, unknown>): EmailContent {
  switch (template) {
    case "application_received":
      return renderApplicationReceived(payload as never);
    case "resume_otp":
      return renderResumeOtp(payload as never);
    case "not_moving_forward":
      return renderNotMovingForward(payload as never);
    case "admin_invite_notice":
      return renderAdminInviteNotice(payload as never);
  }
}

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (resendClient) return resendClient;
  const env = loadEnv();
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Best-effort immediate send for one outbox row, run *after* the enqueueing
 * transaction has committed. Never throws — callers should fire-and-forget
 * this (e.g. `void sendQueuedEmailBestEffort(id)`), since a candidate's
 * request must succeed regardless of email provider health. The hourly
 * sweep (owned by the foundation schema's `run_maintenance_sweep`) is the
 * backstop that retries rows still unsent.
 */
export async function sendQueuedEmailBestEffort(outboxId: number): Promise<void> {
  const env = loadEnv();
  if (env.EMAIL_ENABLED !== "true") return; // dev default; resume code path never depends on this

  try {
    await withSystem(async (tx) => {
      const rows = await tx<
        { id: number; to_email: string; template: EmailTemplate; payload: Record<string, unknown>; sent_at: Date | null }[]
      >`select id, to_email, template, payload, sent_at from email_outbox where id = ${outboxId}`;
      const row = rows[0];
      if (!row || row.sent_at) return;

      const content = renderTemplate(row.template, row.payload);
      try {
        const client = getResendClient();
        const { error } = await client.emails.send({
          from: env.EMAIL_FROM ?? "no-reply@example.com",
          to: row.to_email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
        if (error) throw new Error(error.message);
        await tx`update email_outbox set sent_at = now() where id = ${row.id}`;
      } catch (err) {
        await tx`
          update email_outbox
            set attempts = attempts + 1, last_error = ${String(err).slice(0, 500)}
            where id = ${row.id}
        `;
      }
    });
  } catch (err) {
    // DB itself unavailable for the update — swallow; the sweep will pick
    // this row up on its next pass regardless (it re-reads `sent_at is null`).
    console.error(
      JSON.stringify({ event: "email_send_wrapper_failed", outboxId, error: String(err) }),
    );
  }
}
