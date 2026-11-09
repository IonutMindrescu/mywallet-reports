/**
 * "Month" buckets for the whole app. Either calendar months, or salary cycles:
 * a cycle starts on the day the main salary arrives and ends the day before the next one.
 * A cycle is keyed by the calendar month in which it starts ("2026-10" = 9 oct → 9 noi).
 */

export type MonthMode = 'calendar' | 'salary';

interface Cfg {
  mode: MonthMode;
  payday: number;
  /** Detected cycle start per calendar month key. */
  detected: Map<string, string>;
  cache: Map<string, string>;
}

let cfg: Cfg = { mode: 'calendar', payday: 10, detected: new Map(), cache: new Map() };

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function shiftKey(key: string, n: number): string {
  const d = new Date(+key.slice(0, 4), +key.slice(5, 7) - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Payday rule: day N of the month (clamped), moved to the previous Friday when it falls on a weekend. */
export function ruleDate(key: string, payday: number): string {
  const y = +key.slice(0, 4), m = +key.slice(5, 7);
  const last = new Date(y, m, 0).getDate();
  const d = new Date(y, m - 1, Math.min(payday, last));
  const wd = d.getDay();
  if (wd === 6) d.setDate(d.getDate() - 1);
  if (wd === 0) d.setDate(d.getDate() - 2);
  return isoOf(d);
}

export interface SalaryPayment {
  date: string;
  amount: number;
}

/** Pick the main salary payments (ignores small extra payments) and infer the usual payday. */
export function detectPayday(sal: SalaryPayment[]): { payday: number | null; main: SalaryPayment[] } {
  if (!sal.length) return { payday: null, main: [] };
  const sorted = [...sal].map((s) => s.amount).sort((a, b) => a - b);
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  const main = sal.filter((s) => s.amount >= p90 * 0.5);
  // Nominal payday = most frequent day among payments that did not land on a Friday
  // (Fridays are often the weekend-shifted date); fall back to all days.
  const days = (list: SalaryPayment[]) => list.map((s) => +s.date.slice(8, 10));
  const notFri = main.filter((s) => new Date(s.date + 'T00:00:00').getDay() !== 5);
  const pool = days(notFri.length >= 2 ? notFri : main);
  const freq = new Map<number, number>();
  pool.forEach((d) => freq.set(d, (freq.get(d) ?? 0) + 1));
  const payday = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  return { payday, main };
}

export function configureMonths(mode: MonthMode, payday: number, main: SalaryPayment[]) {
  const detected = new Map<string, string>();
  if (mode === 'salary') {
    // For each calendar month, the main salary payment closest to the rule date (within a week) starts the cycle.
    const byMonth = new Map<string, SalaryPayment[]>();
    for (const s of main) {
      const k = s.date.slice(0, 7);
      byMonth.set(k, [...(byMonth.get(k) ?? []), s]);
    }
    for (const [k, list] of byMonth) {
      const rule = new Date(ruleDate(k, payday) + 'T00:00:00').getTime();
      const best = list
        .map((s) => ({ s, diff: Math.abs(new Date(s.date + 'T00:00:00').getTime() - rule) / 864e5 }))
        .filter((x) => x.diff <= 7)
        .sort((a, b) => a.diff - b.diff)[0];
      if (best) detected.set(k, best.s.date);
    }
  }
  cfg = { mode, payday, detected, cache: new Map() };
}

export const monthMode = () => cfg.mode;

/** First day of a month bucket. */
export function monthStart(key: string): string {
  if (cfg.mode === 'calendar') return key + '-01';
  return cfg.detected.get(key) ?? ruleDate(key, cfg.payday);
}

/** Last day of a month bucket. */
export function monthEnd(key: string): string {
  if (cfg.mode === 'calendar') {
    const d = new Date(+key.slice(0, 4), +key.slice(5, 7), 0);
    return isoOf(d);
  }
  const next = new Date(monthStart(shiftKey(key, 1)) + 'T00:00:00');
  next.setDate(next.getDate() - 1);
  return isoOf(next);
}

/** Month bucket of a date. */
export function monthOf(iso: string): string {
  if (cfg.mode === 'calendar') return iso.slice(0, 7);
  let k = cfg.cache.get(iso);
  if (!k) {
    const cal = iso.slice(0, 7);
    k = iso >= monthStart(cal) ? cal : shiftKey(cal, -1);
    cfg.cache.set(iso, k);
  }
  return k;
}

/** 0-based day index inside its month bucket. */
export function dayIndex(iso: string): number {
  if (cfg.mode === 'calendar') return +iso.slice(8, 10) - 1;
  const start = new Date(monthStart(monthOf(iso)) + 'T00:00:00').getTime();
  return Math.round((new Date(iso + 'T00:00:00').getTime() - start) / 864e5);
}
