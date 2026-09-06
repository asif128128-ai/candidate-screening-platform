// ARCHITECTURE.md §1 (Email row) / DATA_MODEL.md §3.18: renders the four
// `email_outbox.template` kinds. Plain, mobile-safe HTML (no external
// assets — CSP `img-src`/`style-src` restrictions apply to admin pages, and
// email clients ignore CSP anyway, but keeping it self-contained avoids any
// tracking-pixel-style surprise). Hebrew, RTL.
//
// `application_received` and `resume_otp` are candidate-flow's own emails.
// `not_moving_forward` (CANDIDATE_FLOW.md §6) and `admin_invite_notice` are
// triggered by admin-ui code this engineer doesn't own, but the sender
// dispatcher (send.ts) needs to handle every `email_outbox.template` value
// to be a real "first sender code" implementation rather than a partial
// one — so their renderers live here too, kept intentionally minimal.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function wrap(bodyHtml: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Heebo,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#1a1a1a">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:24px">
${bodyHtml}
</div>
</body></html>`;
}

export interface ApplicationReceivedPayload {
  firstName: string;
  jobTitle: string;
  resumeCodeDisplay: string;
  resumeUrl: string;
  responseByDateHe: string;
}

export interface ResumeOtpPayload {
  code: string;
  expiresMinutes: number;
}

export interface NotMovingForwardPayload {
  jobTitle: string;
  privacyContactEmail: string;
}

export interface AdminInviteNoticePayload {
  displayName: string;
  invitedByName: string;
  appBaseUrl: string;
}

export function renderApplicationReceived(p: ApplicationReceivedPayload): EmailContent {
  return {
    subject: `השלב הבא במועמדות שלך — המבחן המקוון (${p.jobTitle})`,
    html: wrap(`
      <p>שלום ${p.firstName},</p>
      <p>הפרטים שלך נשמרו למשרה "${p.jobTitle}".</p>
      <p>כדי שהמועמדות תיבחן, נשאר להשלים את המבחן המקוון — כ-20 דקות, במחשב. מומלץ לעשות את זה בהקדם, ברצף אחד.</p>
      <p><a href="${p.resumeUrl}">להמשך המבחן</a></p>
      <p>קוד החזרה שלך: <strong style="direction:ltr;unicode-bidi:isolate;font-family:monospace">${p.resumeCodeDisplay}</strong></p>
      <p>שמרו את הקוד — יחד עם האימייל שלכם הוא מאפשר לחזור לתהליך מכל מחשב.</p>
    `),
    text: `שלום ${p.firstName},\nהפרטים שלך נשמרו למשרה "${p.jobTitle}". כדי שהמועמדות תיבחן, נשאר להשלים את המבחן המקוון (כ-20 דקות, במחשב).\nלהמשך: ${p.resumeUrl}\nקוד החזרה: ${p.resumeCodeDisplay}`,
  };
}

export function renderResumeOtp(p: ResumeOtpPayload): EmailContent {
  return {
    subject: "קוד חד-פעמי לחזרה לתהליך המועמדות",
    html: wrap(`
      <p>הקוד שלך לכניסה חוזרת:</p>
      <p style="font-size:28px;letter-spacing:4px;direction:ltr;unicode-bidi:isolate;font-family:monospace"><strong>${p.code}</strong></p>
      <p>הקוד תקף ל-${p.expiresMinutes} דקות. אם לא ביקשתם קוד זה, אפשר להתעלם מהמייל.</p>
    `),
    text: `הקוד שלך: ${p.code} (תקף ל-${p.expiresMinutes} דקות)`,
  };
}

export function renderNotMovingForward(p: NotMovingForwardPayload): EmailContent {
  return {
    subject: `בנוגע למועמדות שלך — ${p.jobTitle}`,
    html: wrap(`
      <p>תודה שהקדשת זמן לתהליך אצלנו. הפעם החלטנו לא להמשיך, וזו לא אמירה על היכולות שלך — התחרות הייתה גבוהה.</p>
      <p>נשמח לראות אותך שוב במשרות עתידיות.</p>
      <p>לבקשות לגבי הפרטים שלך: <a href="mailto:${p.privacyContactEmail}">${p.privacyContactEmail}</a></p>
    `),
    text: `תודה שהקדשת זמן לתהליך אצלנו. הפעם החלטנו לא להמשיך. לבקשות לגבי הפרטים שלך: ${p.privacyContactEmail}`,
  };
}

export function renderAdminInviteNotice(p: AdminInviteNoticePayload): EmailContent {
  return {
    subject: "הוזמנת כמנהל/ת גיוס במערכת",
    html: wrap(`
      <p>שלום ${p.displayName},</p>
      <p>${p.invitedByName} הזמין/ה אותך כמנהל/ת גיוס. היכנסו כאן להשלמת ההרשמה (כולל הגדרת אימות דו-שלבי):</p>
      <p><a href="${p.appBaseUrl}/admin/login">${p.appBaseUrl}/admin/login</a></p>
    `),
    text: `שלום ${p.displayName}, ${p.invitedByName} הזמין/ה אותך כמנהל/ת גיוס. היכנסו ל-${p.appBaseUrl}/admin/login להשלמת ההרשמה.`,
  };
}
