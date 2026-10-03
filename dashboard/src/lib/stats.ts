/** Statistics helpers behind every number in the reports. See the internal numbers charter. Pure functions, no dependencies. */

export type Trust = "none" | "early" | "ok";

/** How much to trust a number based on its sample size n. */
export function trust(n: number): Trust {
  if (n < 10) return "none";
  if (n < 30) return "early";
  return "ok";
}
export const TRUST_LABEL: Record<Trust, string> = { none: "لا تكفي", early: "مبدئية", ok: "معقولة" };

/** Wilson score interval for a proportion k/n (95% by default). Better than the textbook "p ± 1.96·se" for small n and for p near 0 or 1. */
export function wilson(k: number, n: number, z = 1.96): { p: number; low: number; high: number } {
  if (!(n > 0) || k < 0 || k > n) throw new RangeError("wilson: need 0 <= k <= n and n > 0");
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Rule of three: if an event happened 0 times in n trials, the true rate is below about 3/n (95% confidence). */
export function ruleOfThree(n: number): number {
  return n > 0 ? Math.min(1, 3 / n) : 1;
}

export type Verdict = "higher" | "lower" | "same" | "unknown";

/** Compare two COUNTS from two periods of EQUAL length (Poisson: difference vs. sqrt of the total). |z| < 2 is ordinary fluctuation. */
export function compareCounts(current: number, previous: number): { verdict: Verdict; z: number | null } {
  const total = current + previous;
  if (total < 10) return { verdict: "unknown", z: null };
  const z = (current - previous) / Math.sqrt(total);
  return { verdict: z >= 2 ? "higher" : z <= -2 ? "lower" : "same", z };
}

/** Compare two proportions conservatively: only call it a difference when the two Wilson intervals do not overlap. */
export function compareProportions(k1: number, n1: number, k0: number, n0: number): Verdict {
  if (n1 < 10 || n0 < 10) return "unknown";
  const a = wilson(k1, n1), b = wilson(k0, n0);
  if (a.low > b.high) return "higher";
  if (a.high < b.low) return "lower";
  return "same";
}

/** Arabic number agreement: 1 -> singular, 2 -> dual, 3-10 -> plural, 11+ -> singular after the number. forms = [singular, dual, plural, singularAfterNumber]. */
export function count(n: number, [one, two, few, many]: [string, string, string, string]): string {
  if (n === 1) return one + " واحدة".replace(" واحدة", one.endsWith("ة") ? " واحدة" : " واحد");
  if (n === 2) return two;
  return n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;
}

/** Whole-number percent for display. */
export const pct = (x: number): number => Math.round(x * 100);
/** Seconds as a short Arabic phrase. */
export function secondsText(s: number): string {
  if (s < 90) return count(Math.round(s), ["ثانية", "ثانيتين", "ثوانٍ", "ثانية"]);
  if (s < 5400) return count(Math.round(s / 60), ["دقيقة", "دقيقتين", "دقائق", "دقيقة"]);
  return `${(s / 3600).toFixed(1)} ساعة`;
}
