import { createHash } from "node:crypto";

// DATA_MODEL.md §3.8: `consents.text_version` is "a hash of the displayed
// text" — computed here so the exact text shown to the candidate is always
// what gets hashed (single source of truth), and a future copy change
// naturally produces a new hash without a manual version bump.

export const PRIVACY_NOTICE_TEXT_HE = `מה אנחנו אוספים ולמה. הפרטים שמילאת (שם, תאריך לידה, טלפון, אימייל, מוסד לימודים, מסלול, שנה, ממוצע, זמינות לראשון לציון, וקישורים/קורות חיים אם בחרת לצרף) משמשים אך ורק לצורך בחינת המועמדות למשרה זו. במהלך המבחן נשמרות התשובות, זמני התגובה ואירועי דפדפן בסיסיים (למשל מעבר בין חלונות), כדי להעריך את התוצאות ואת אמינותן.
מה לא. לא נעשה שימוש במצלמה או במיקרופון. לא נסיק מאפיינים רגישים (מגדר, מוצא, דת, בריאות וכד׳). תאריך הלידה משמש להצגה בלבד ואינו משפיע על הציון. הממוצע אינו פוסל מועמדות.
מי רואה. צוות הגיוס בלבד. הנתונים מאוחסנים אצל ספקי ענן (Supabase באיחוד האירופי, Render) בהצפנה בתעבורה ובמנוחה.
כמה זמן. כתובת ה-IP המלאה נמחקת אחרי 90 יום. נתוני ההתנהגות הגולמיים מהמבחן ותוכן השאלות נמחקים אחרי 12 חודשים (הציונים נשמרים). כל שאר הפרטים נמחקים אוטומטית 24 חודשים אחרי המועמדות האחרונה שלך, אלא אם התקבלת לעבודה או ביקשת שנשמור אותם למשרות עתידיות.
הזכויות שלך. אפשר לבקש עיון, תיקון או מחיקה של הפרטים בכל עת בטופס /privacy או במייל לצוות הגיוס. בקשות מטופלות תוך 30 יום. מחיקה מוחקת גם את תוצאות המבחן וקובץ קורות החיים.`;

export const ASSESSMENT_MONITORING_DISCLOSURE_TEXT_HE = `שקיפות לגבי ניטור במבחן. כדי להעריך את אמינות התוצאות, במהלך המבחן נשמרים: זמני תגובה לכל שאלה, אירועי דפדפן כמו יציאה מהחלון או מהמסך המלא, ניסיונות העתקה/הדבקה, שינויי גודל חלון, וכתובת ה-IP. אין שימוש במצלמה או במיקרופון, ואין הקלטה של המסך או של ההקלדה. הנתונים האלה משמשים רק כדי לסמן לצוות הגיוס האם התוצאה נראית אמינה — ואף פעם לא כדי לקבוע אוטומטית שמישהו "רימה".`;

export function hashConsentText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const PRIVACY_V1_TEXT_HASH = hashConsentText(PRIVACY_NOTICE_TEXT_HE);
export const ASSESSMENT_MONITORING_V1_TEXT_HASH = hashConsentText(
  ASSESSMENT_MONITORING_DISCLOSURE_TEXT_HE,
);

export const CONSENT_KINDS = {
  privacy: "privacy_v1",
  assessmentMonitoring: "assessment_monitoring_v1",
} as const;
