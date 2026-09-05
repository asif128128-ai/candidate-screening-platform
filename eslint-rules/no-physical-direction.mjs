// ARCHITECTURE.md §9 (RTL): "logical utilities (ms-, me-, ps-, pe-, start-,
// end-) are used exclusively; a lint rule ... forbids ml-/mr-/pl-/pr-/left-/
// right- in the codebase." This is the smallest reasonable implementation of
// that rule: a plain-object ESLint rule (no build step) that flags forbidden
// Tailwind class prefixes wherever a string literal contains them, so it
// catches `className`, `clsx(...)`, template literals, etc. See
// IMPLEMENTATION_NOTES.md for why this approach (vs. a full
// eslint-plugin-tailwindcss custom rule) was chosen.

/** Forbidden physical-direction utility prefixes (with variants like hover:/rtl:/md:). */
const FORBIDDEN = /(^|[\s"'`:])(ml|mr|pl|pr|left|right)-(?=[0-9a-zA-Z[])/;

// Utilities that legitimately start with these letters but are NOT physical
// direction utilities (avoid false positives).
const ALLOW = /\b(relative|rounded|ring|rows?|row-|rotate)-?/;

function checkLiteral(node, context, value) {
  if (typeof value !== "string") return;
  if (!FORBIDDEN.test(value)) return;
  // Reduce false positives: only flag when a forbidden token appears as a
  // whitespace/quote/colon-delimited class candidate.
  const tokens = value.split(/\s+/);
  for (const token of tokens) {
    const bare = token.replace(/^[a-z0-9:-]*:/i, ""); // strip variants like hover:, md:, rtl:
    if (/^(ml|mr|pl|pr)-[^\s]+$/.test(bare) || /^(left|right)-[^\s]+$/.test(bare)) {
      if (ALLOW.test(bare)) continue;
      context.report({
        node,
        message: `Physical-direction utility "${token}" is forbidden — use the logical equivalent (ms-/me-/ps-/pe-/start-/end-) per ARCHITECTURE.md §9.`,
      });
      return;
    }
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid physical-direction Tailwind utilities (ml-/mr-/pl-/pr-/left-/right-); use logical properties for RTL support.",
    },
    schema: [],
  },
  create(context) {
    return {
      Literal(node) {
        checkLiteral(node, context, node.value);
      },
      TemplateElement(node) {
        checkLiteral(node, context, node.value.raw);
      },
    };
  },
};

export default {
  rules: {
    "no-physical-direction": rule,
  },
};
