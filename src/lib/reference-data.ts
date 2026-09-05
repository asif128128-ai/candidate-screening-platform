// CANDIDATE_FLOW.md §2.1: static autocomplete lists for the free-text
// institution/degree fields. Shared between the step-1 client form (as
// <datalist> options) and nowhere else — these are not validated against
// (free text is accepted; the list is a convenience).

export const INSTITUTIONS: readonly string[] = [
  "הטכניון",
  "אוניברסיטת תל אביב",
  "האוניברסיטה העברית בירושלים",
  "אוניברסיטת בן גוריון בנגב",
  "אוניברסיטת בר אילן",
  "אוניברסיטת חיפה",
  "מכון ויצמן למדע",
  "האוניברסיטה הפתוחה",
  "המרכז הבינתחומי הרצליה (רייכמן)",
  "מכללת אפקה",
  "שנקר",
  "המכללה הטכנולוגית חולון (HIT)",
  "מכללת ברוד",
  "סמי שמעון להנדסה",
  "מכללת ירושלים להנדסה (JCT)",
  "אוניברסיטת אריאל",
  "מכללת ספיר",
  "מכללת רופין",
  "עזריאלי מכללה אקדמית להנדסה ירושלים",
  "מכללת תל חי",
  "המכללה האקדמית כנרת",
  "המכללה האקדמית אונו",
  "המכללה למינהל (קולמן)",
  "אחר",
];

export const DEGREE_PROGRAMS: readonly string[] = [
  "מדעי המחשב",
  "הנדסת תוכנה",
  "הנדסת מחשבים",
  "הנדסת חשמל",
  "מערכות מידע",
  "מדעי הנתונים",
  "מתמטיקה",
  "פיזיקה",
  "אחר",
];

export const STUDY_YEARS: readonly { value: number; label: string }[] = [
  { value: 1, label: "מכינה / שנה א׳" },
  { value: 2, label: "שנה ב׳" },
  { value: 3, label: "שנה ג׳" },
  { value: 4, label: "שנה ד׳" },
  { value: 5, label: "שנה ה׳" },
  { value: 6, label: "תואר שני - שנה א׳" },
  { value: 7, label: "תואר שני - שנה ב׳ ומעלה" },
];
