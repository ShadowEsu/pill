// Clause filter for every model output (port of web/src/lib/rules.ts filterWhy; code, not prompt). The one server-side copy:
// the Vercel functions import it and pill/pay/src/rules.ts re-exports it.

/** Words no model output may carry. Matched per clause, case-insensitive. */
export const BANNED = /\b(safe\w*|genuine\w*|fake\w*|counterfeit\w*|authentic\w*|verified|certified|guarantee\w*)\b/i;

/**
 * Split into clauses on `. ; : , —` and before `but`/`and`/`so`; drop every clause with a banned word.
 * `fellBack` is true when more than half the clauses were dropped (the caller then uses its template).
 */
export function filterClauses(text: string) {
  const clauses = text.trim().split(/(?<=[.;:,—])\s+|\s+(?=\b(?:but|and|so)\b)/).filter(Boolean);
  const dropped = clauses.filter((c) => BANNED.test(c));
  const kept = clauses.filter((c) => !BANNED.test(c));
  return { text: kept.join(' ').replace(/\s+/g, ' ').trim(), dropped, fellBack: kept.length < clauses.length / 2 || kept.length === 0 };
}
