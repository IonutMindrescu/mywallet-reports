import { CAT } from './categories';
import type { CTx } from './types';

export const DAY = 86400000;
export const toDate = (iso: string) => new Date(iso + 'T00:00:00');
export const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
import { dayIndex, monthEnd, monthOf, monthStart, shiftKey } from './months';
export { monthOf, monthStart, monthEnd };
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY) + 1;

/** Month buckets (calendar months or salary cycles) touched by [from, to]. */
export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const last = monthOf(to);
  for (let k = monthOf(from); k <= last; k = shiftKey(k, 1)) out.push(k);
  return out;
}

/** Calendar months touched by [from, to] (for calendar-shaped visuals). */
export function calendarMonthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let y = +from.slice(0, 4), m = +from.slice(5, 7);
  const ey = +to.slice(0, 4), em = +to.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = toDate(from); d <= toDate(to); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) out.push(isoOf(d));
  return out;
}

export interface Ctx {
  /** Transactions inside the selected period (all, including excluded categories). */
  all: CTx[];
  /** Counted transactions (excluded categories removed). */
  txs: CTx[];
  spend: CTx[];
  income: CTx[];
  from: string;
  to: string;
  excluded: Set<string>;
}

export function buildCtx(all: CTx[], from: string, to: string, excluded: Set<string>): Ctx {
  const inRange = all.filter((t) => t.date >= from && t.date <= to);
  const txs = inRange.filter((t) => !excluded.has(t.cat));
  return {
    all: inRange,
    txs,
    spend: txs.filter((t) => t.amount < 0),
    income: txs.filter((t) => t.amount > 0),
    from,
    to,
    excluded,
  };
}

const sum = (arr: CTx[]) => arr.reduce((s, t) => s + Math.abs(t.amount), 0);

export function totals(c: Ctx) {
  const income = sum(c.income);
  const spend = sum(c.spend);
  const days = Math.max(1, daysBetween(c.from, c.to));
  return {
    income,
    spend,
    net: income - spend,
    savingsRate: income > 0 ? (income - spend) / income : null,
    avgDaily: spend / days,
    days,
    count: c.txs.length,
    spendCount: c.spend.length,
    avgTicket: c.spend.length ? spend / c.spend.length : 0,
  };
}

export interface CatAgg {
  cat: string;
  total: number;
  count: number;
  share: number;
  merchants: { name: string; key: string; total: number; count: number }[];
}

export function byCategory(list: CTx[]): CatAgg[] {
  const m = new Map<string, { total: number; count: number; merchants: Map<string, { name: string; key: string; total: number; count: number }> }>();
  let grand = 0;
  for (const t of list) {
    const v = Math.abs(t.amount);
    grand += v;
    let e = m.get(t.cat);
    if (!e) m.set(t.cat, (e = { total: 0, count: 0, merchants: new Map() }));
    e.total += v;
    e.count++;
    let me = e.merchants.get(t.mkey);
    if (!me) e.merchants.set(t.mkey, (me = { name: t.merchant, key: t.mkey, total: 0, count: 0 }));
    me.total += v;
    me.count++;
  }
  return [...m.entries()]
    .map(([cat, e]) => ({
      cat,
      total: e.total,
      count: e.count,
      share: grand ? e.total / grand : 0,
      merchants: [...e.merchants.values()].sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface MerchAgg {
  key: string;
  name: string;
  cat: string;
  total: number;
  count: number;
  avg: number;
  first: string;
  last: string;
  months: number;
}

export function byMerchant(list: CTx[]): MerchAgg[] {
  const m = new Map<string, MerchAgg & { monthSet: Set<string> }>();
  for (const t of list) {
    const v = Math.abs(t.amount);
    let e = m.get(t.mkey);
    if (!e) m.set(t.mkey, (e = { key: t.mkey, name: t.merchant, cat: t.cat, total: 0, count: 0, avg: 0, first: t.date, last: t.date, months: 0, monthSet: new Set() }));
    e.total += v;
    e.count++;
    if (t.date < e.first) e.first = t.date;
    if (t.date > e.last) e.last = t.date;
    e.monthSet.add(monthOf(t.date));
  }
  return [...m.values()]
    .map(({ monthSet, ...e }) => ({ ...e, avg: e.total / e.count, months: monthSet.size }))
    .sort((a, b) => b.total - a.total);
}

export interface MonthAgg {
  month: string;
  income: number;
  spend: number;
  net: number;
  byCat: Record<string, number>;
  count: number;
}

export function byMonth(c: Ctx): MonthAgg[] {
  const months = monthsInRange(c.from, c.to);
  const m = new Map<string, MonthAgg>(months.map((k) => [k, { month: k, income: 0, spend: 0, net: 0, byCat: {}, count: 0 }]));
  for (const t of c.txs) {
    const e = m.get(monthOf(t.date));
    if (!e) continue;
    e.count++;
    if (t.amount > 0) e.income += t.amount;
    else {
      e.spend -= t.amount;
      e.byCat[t.cat] = (e.byCat[t.cat] ?? 0) - t.amount;
    }
  }
  return [...m.values()].map((e) => ({ ...e, net: e.income - e.spend }));
}

export function dailySpend(c: Ctx): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of c.spend) m.set(t.date, (m.get(t.date) ?? 0) - t.amount);
  return m;
}

export function dailyFlow(c: Ctx) {
  const days = daysInRange(c.from, c.to);
  const inc = new Map<string, number>();
  const out = new Map<string, number>();
  for (const t of c.txs) {
    if (t.amount > 0) inc.set(t.date, (inc.get(t.date) ?? 0) + t.amount);
    else out.set(t.date, (out.get(t.date) ?? 0) - t.amount);
  }
  return days.map((d) => ({ day: d, income: inc.get(d) ?? 0, spend: out.get(d) ?? 0 }));
}

/** Average spend per weekday (Mon..Sun), normalized by the number of such weekdays in the period. */
export function weekdayPattern(c: Ctx) {
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  const occurrences = Array(7).fill(0);
  for (const d of daysInRange(c.from, c.to)) occurrences[(toDate(d).getDay() + 6) % 7]++;
  for (const t of c.spend) {
    const w = (toDate(t.date).getDay() + 6) % 7;
    totals[w] -= t.amount;
    counts[w]++;
  }
  return totals.map((v, i) => ({ total: v, count: counts[i], avg: occurrences[i] ? v / occurrences[i] : 0 }));
}

export function dayOfMonthPattern(c: Ctx) {
  const arr = Array(31).fill(0);
  for (const t of c.spend) arr[toDate(t.date).getDate() - 1] -= t.amount;
  return arr;
}

/** Cumulative spend by day-of-month for each month in the period. */
export function cumulativeByMonth(c: Ctx) {
  const months = monthsInRange(c.from, c.to);
  const res: Record<string, number[]> = {};
  for (const m of months) res[m] = Array(31).fill(0);
  for (const t of c.spend) {
    const m = monthOf(t.date);
    if (res[m]) res[m][Math.min(30, dayIndex(t.date))] -= t.amount;
  }
  for (const m of months) {
    let acc = 0;
    res[m] = res[m].map((v) => (acc += v));
  }
  return res;
}

/** Balance series from statement balances (last known balance per booking day). */
export function balanceSeries(all: CTx[], from: string, to: string) {
  const sorted = [...all].filter((t) => t.balance != null).sort((a, b) => (a.bookDate < b.bookDate ? -1 : a.bookDate > b.bookDate ? 1 : a.seq - b.seq));
  const byDay = new Map<string, number>();
  for (const t of sorted) byDay.set(t.bookDate, t.balance!);
  const pts = [...byDay.entries()].filter(([d]) => d >= from && d <= to);
  return pts;
}

export interface Recurring {
  key: string;
  name: string;
  cat: string;
  avg: number;
  last: number;
  first: number;
  lastDate: string;
  nextDate: string;
  months: number;
  total: number;
  annual: number;
  interval: number;
  priceChange: number;
  history: { date: string; amount: number }[];
}

const RECUR_CATS = new Set(['subscriptions', 'utilities', 'telecom', 'insurance', 'loans', 'sport', 'home', 'fees', 'transfer-out', 'education', 'rent']);

export function detectRecurring(all: CTx[], excluded: Set<string>): Recurring[] {
  const groups = new Map<string, CTx[]>();
  for (const t of all) {
    if (t.amount >= 0 || excluded.has(t.cat)) continue;
    if (['groceries', 'restaurants', 'delivery', 'fuel', 'transport', 'cash'].includes(t.cat)) continue;
    const g = groups.get(t.mkey);
    if (g) g.push(t);
    else groups.set(t.mkey, [t]);
  }
  const span = all.length ? daysBetween(all[0].date, all[all.length - 1].date) : 0;
  const minMonths = span < 75 ? 2 : 3;
  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    const months = new Set(list.map((t) => monthOf(t.date)));
    if (months.size < minMonths) continue;
    if (list.length / months.size > 1.6) continue;
    const amounts = list.map((t) => -t.amount);
    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
    const cv = mean ? sd / mean : 1;
    const cat = list[list.length - 1].cat;
    if (RECUR_CATS.has(cat) ? cv > 0.6 : cv > 0.12) continue;
    const gaps: number[] = [];
    for (let i = 1; i < list.length; i++) gaps.push(daysBetween(list[i - 1].date, list[i].date) - 1);
    gaps.sort((a, b) => a - b);
    const interval = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 30;
    if (interval < 20 || interval > 40) continue;
    const lastT = list[list.length - 1];
    const next = new Date(toDate(lastT.date).getTime() + interval * DAY);
    // Stopped: the next expected payment is long overdue (missed by more than ~3 weeks).
    if (span && daysBetween(isoOf(next), all[all.length - 1].date) > 21) continue;
    out.push({
      key,
      name: lastT.merchant,
      cat,
      avg: mean,
      last: -lastT.amount,
      first: amounts[0],
      lastDate: lastT.date,
      nextDate: isoOf(next),
      months: months.size,
      total: amounts.reduce((s, v) => s + v, 0),
      annual: mean * 12,
      interval,
      priceChange: amounts[0] ? (-lastT.amount - amounts[0]) / amounts[0] : 0,
      history: list.map((t) => ({ date: t.date, amount: -t.amount })),
    });
  }
  return out.sort((a, b) => b.annual - a.annual);
}

export interface Insight {
  icon: string;
  tone: 'good' | 'bad' | 'neutral' | 'info';
  title: string;
  text: string;
  value?: string;
}

export function buildInsights(c: Ctx, fmt: (v: number) => string, recurring: Recurring[]): Insight[] {
  const res: Insight[] = [];
  const T = totals(c);
  if (!c.txs.length) return res;
  const cats = byCategory(c.spend);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  if (T.savingsRate != null) {
    const r = T.savingsRate;
    res.push({
      icon: r >= 0 ? 'PiggyBank' : 'TrendingDown',
      tone: r >= 0.2 ? 'good' : r >= 0 ? 'neutral' : 'bad',
      title: r >= 0 ? 'Rata de economisire' : 'Ai cheltuit mai mult decât ai câștigat',
      value: pct(r),
      text:
        r >= 0
          ? `Din fiecare 100 lei încasați, ți-au rămas ${Math.round(r * 100)} lei. ${r >= 0.2 ? 'Peste pragul recomandat de 20% — excelent!' : 'Ținta recomandată e de cel puțin 20%.'}`
          : `Diferența de ${fmt(-T.net)} a venit din economii sau din soldul anterior.`,
    });
  }

  if (cats[0]) {
    const top = cats[0];
    res.push({
      icon: CAT[top.cat]?.icon ?? 'Tag',
      tone: 'info',
      title: `Cea mai mare categorie: ${CAT[top.cat]?.name ?? top.cat}`,
      value: pct(top.share),
      text: `${fmt(top.total)} în ${top.count} tranzacții. Cel mai mult la ${top.merchants[0]?.name} (${fmt(top.merchants[0]?.total ?? 0)}).`,
    });
  }

  // Month-over-month: last complete-ish month vs the average of previous months.
  const months = byMonth(c);
  if (months.length >= 3) {
    const last = months[months.length - 1];
    const prev = months.slice(0, -1);
    const partial = c.to < monthEnd(last.month);
    const target = partial ? months[months.length - 2] : last;
    const base = partial ? months.slice(0, -2) : prev;
    if (base.length >= 1) {
      let best: { cat: string; diff: number; ratio: number } | null = null;
      for (const cat of Object.keys(target.byCat)) {
        const avg = base.reduce((s, m) => s + (m.byCat[cat] ?? 0), 0) / base.length;
        const diff = target.byCat[cat] - avg;
        if (avg > 150 && diff > 0 && (!best || diff > best.diff)) best = { cat, diff, ratio: diff / avg };
      }
      if (best && best.ratio > 0.15) {
        res.push({
          icon: 'TrendingUp',
          tone: 'bad',
          title: `${CAT[best.cat]?.name} în creștere`,
          value: `+${pct(best.ratio)}`,
          text: `În ${monthLabel(target.month, true)} ai cheltuit cu ${fmt(best.diff)} mai mult decât media lunilor anterioare la această categorie.`,
        });
      }
    }
  }

  // Weekend vs weekdays
  const wp = weekdayPattern(c);
  const wkAvg = (wp[0].avg + wp[1].avg + wp[2].avg + wp[3].avg + wp[4].avg) / 5;
  const weAvg = (wp[5].avg + wp[6].avg) / 2;
  if (wkAvg > 0 && T.days >= 14) {
    const r = weAvg / wkAvg;
    res.push({
      icon: 'CalendarDays',
      tone: r > 1.3 ? 'bad' : 'neutral',
      title: r >= 1 ? 'Weekend-ul costă mai mult' : 'Cheltuiești mai mult în timpul săptămânii',
      value: `${r.toFixed(1)}×`,
      text: `O zi de weekend te costă în medie ${fmt(weAvg)}, față de ${fmt(wkAvg)} într-o zi lucrătoare.`,
    });
  }

  // Eating out
  const eat = cats.filter((x) => x.cat === 'restaurants' || x.cat === 'delivery');
  const eatTotal = eat.reduce((s, x) => s + x.total, 0);
  if (eatTotal > 0 && T.spend > 0) {
    const n = eat.reduce((s, x) => s + x.count, 0);
    res.push({
      icon: 'UtensilsCrossed',
      tone: eatTotal / T.spend > 0.15 ? 'bad' : 'neutral',
      title: 'Mâncat în oraș și livrări',
      value: pct(eatTotal / T.spend),
      text: `${fmt(eatTotal)} în ${n} comenzi/vizite — în medie ${fmt(eatTotal / n)} pe ocazie.`,
    });
  }

  // Small purchases
  const small = c.spend.filter((t) => -t.amount < 50);
  if (small.length >= 10) {
    const s = sum(small);
    res.push({
      icon: 'Coffee',
      tone: 'neutral',
      title: 'Efectul „cafelei zilnice”',
      value: String(small.length),
      text: `${small.length} plăți sub 50 lei au însumat ${fmt(s)} (${pct(s / T.spend)} din cheltuieli). Micile sume se adună!`,
    });
  }

  // Subscriptions
  const subs = recurring.filter((r) => r.cat === 'subscriptions');
  if (subs.length) {
    const annual = subs.reduce((s, r) => s + r.annual, 0);
    res.push({
      icon: 'Repeat',
      tone: 'info',
      title: `${subs.length} abonamente active`,
      value: fmt(annual),
      text: `Te costă aproximativ ${fmt(annual / 12)} pe lună, adică ${fmt(annual)} pe an: ${subs.map((s) => s.name).join(', ')}.`,
    });
  }

  // Fees
  const fees = c.spend.filter((t) => t.cat === 'fees');
  if (fees.length) {
    const f = sum(fees);
    res.push({
      icon: 'Landmark',
      tone: f > 100 ? 'bad' : 'neutral',
      title: 'Comisioane bancare',
      value: fmt(f),
      text: `Ai plătit ${fees.length} comisioane. ${f / Math.max(1, months.length) > 15 ? 'Merită să verifici un pachet de cont mai avantajos.' : 'Un nivel rezonabil.'}`,
    });
  }

  // Largest expense
  const big = [...c.spend].sort((a, b) => a.amount - b.amount)[0];
  if (big) {
    res.push({
      icon: 'Flame',
      tone: 'info',
      title: 'Cea mai mare cheltuială',
      value: fmt(-big.amount),
      text: `${big.merchant} pe ${dateLabel(big.date)} (${CAT[big.cat]?.name}).`,
    });
  }

  // Projection for a partial last month
  const lastMonth = monthOf(c.to);
  const daysIn = daysBetween(monthStart(lastMonth), monthEnd(lastMonth));
  const dayNow = daysBetween(monthStart(lastMonth), c.to);
  if (dayNow < daysIn && dayNow >= 5 && c.from <= monthStart(lastMonth)) {
    const mSpend = c.spend.filter((t) => monthOf(t.date) === lastMonth);
    const spent = sum(mSpend);
    const prevMonths = months.slice(0, -1).filter((m) => m.spend > 0);
    const avgPrev = prevMonths.length ? prevMonths.reduce((s, m) => s + m.spend, 0) / prevMonths.length : 0;
    // Large one-off payments are counted once; only everyday spending is extrapolated.
    // Everyday = card-style spending under 500; transfers, rent, loans, bills etc. are not extrapolated.
    const fixed = new Set(['transfer-out', 'loans', 'rent', 'insurance', 'taxes', 'utilities', 'telecom', 'subscriptions', 'fees']);
    const everyday = sum(mSpend.filter((t) => -t.amount <= 500 && !fixed.has(t.cat)));
    const pace = spent + (everyday / dayNow) * (daysIn - dayNow);
    res.push({
      icon: 'Gauge',
      tone: avgPrev && pace > avgPrev * 1.1 ? 'bad' : 'good',
      title: `Proiecție ${monthLabel(lastMonth, true)}`,
      value: fmt(pace),
      text: `Ai cheltuit ${fmt(spent)} în ${dayNow} zile. În ritmul ăsta, vei ajunge la ~${fmt(pace)}${avgPrev ? `, față de media de ${fmt(avgPrev)}/lună` : ''}.`,
    });
  }

  // Cash
  const cash = c.spend.filter((t) => t.cat === 'cash');
  if (cash.length && T.spend) {
    const s = sum(cash);
    res.push({
      icon: 'Banknote',
      tone: s / T.spend > 0.1 ? 'bad' : 'neutral',
      title: 'Numerar retras',
      value: fmt(s),
      text: `${pct(s / T.spend)} din cheltuieli au fost în numerar — bani pe care nu-i poți urmări pe categorii.`,
    });
  }

  return res;
}

const MONTHS_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
export const WEEKDAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
export const WEEKDAYS_SHORT = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

export function monthLabel(m: string, long = false, withYear = true) {
  const idx = +m.slice(5, 7) - 1;
  const name = long ? MONTHS_RO[idx] : MONTHS_SHORT[idx];
  return withYear ? `${name} ${long ? m.slice(0, 4) : "'" + m.slice(2, 4)}` : name;
}
export function dateLabel(iso: string, withYear = true) {
  const d = toDate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export interface SelfCandidate {
  key: string;
  name: string;
  inCount: number;
  outCount: number;
  inSum: number;
  outSum: number;
}

/** Counterparties with transfers in both directions — likely the user's own accounts at other banks. */
export function selfTransferCandidates(all: CTx[]): SelfCandidate[] {
  const m = new Map<string, SelfCandidate>();
  for (const t of all) {
    if (!['transfer-in', 'transfer-out'].includes(t.cat)) continue;
    let e = m.get(t.mkey);
    if (!e) m.set(t.mkey, (e = { key: t.mkey, name: t.merchant, inCount: 0, outCount: 0, inSum: 0, outSum: 0 }));
    if (t.amount > 0) { e.inCount++; e.inSum += t.amount; } else { e.outCount++; e.outSum -= t.amount; }
  }
  return [...m.values()]
    .filter((e) => e.inCount > 0 && e.outCount > 0 && e.inCount + e.outCount >= 3)
    .sort((a, b) => b.inSum + b.outSum - (a.inSum + a.outSum));
}
