import { daysBetween, monthEnd, monthOf, monthsInRange } from './analytics';
import { accountOf as acctOfDetails } from './accounts';
import { stripDiacritics } from './parser';
import type { CTx } from './types';

export type LoanKind = 'ipotecar' | 'personal' | 'auto' | 'card' | 'bnpl' | 'leasing' | 'altul';

export const LOAN_KINDS: [LoanKind, string][] = [
  ['ipotecar', 'Ipotecar / imobiliar'],
  ['personal', 'Nevoi personale'],
  ['auto', 'Auto'],
  ['leasing', 'Leasing'],
  ['card', 'Card de credit'],
  ['bnpl', 'Rate magazin / BNPL'],
  ['altul', 'Altul'],
];

export interface LoanSettings {
  name?: string;
  kind?: LoanKind;
  /** User-entered monthly installment (useful for a fresh loan with no payments yet). */
  manualRate?: number;
  hidden?: boolean;
  /** true = user says the loan is fully repaid; false = user reopened it (overrides automatic closing). */
  closed?: boolean;
}

export interface LoanEvent {
  date: string;
  type: 'drawdown' | 'payoff' | 'fee';
  amount: number;
  label: string;
  loanKey?: string;
}

export type LoanStatus = 'activ' | 'nou' | 'inchis';

export interface Loan {
  key: string;
  account?: string;
  name: string;
  kind: LoanKind;
  status: LoanStatus;
  /** Installment payments per month (rates only). */
  monthly: Record<string, number>;
  /** Linked insurance per month. */
  insurance: Record<string, number>;
  payments: CTx[];
  firstDate?: string;
  lastDate?: string;
  /** Typical monthly installment (median of the last 3 months with payments). */
  typicalRate: number;
  typicalInsurance: number;
  /** Rate used for the current debt-service figure (manual > typical; 0 if closed). */
  currentRate: number;
  totalPaid: number;
  drawdown?: LoanEvent;
  payoff?: LoanEvent;
  fees: number;
  auto: { name: string; kind: LoanKind };
  /** Paid off on the day another loan was drawn (refinancing): that loan's key. Such a loan is closed. */
  refinancedBy?: string;
  /** New loan with no installment yet: currentRate is estimated from the loans it refinanced. */
  estimated?: boolean;
}

export interface LoanAnalysis {
  loans: Loan[];
  /** Insurance tied to loans but without a loan account (group policies). */
  groupInsurance: Record<string, number>;
  groupInsuranceTypical: number;
  events: LoanEvent[];
  months: string[];
  /** Debt service paid per month (rates + linked insurance). */
  servicePerMonth: Record<string, number>;
  incomePerMonth: Record<string, number>;
  salaryPerMonth: Record<string, number>;
  currentService: number;
  incomeBasis: number;
  incomeLabel: string;
  dti: number | null;
}

const n = (s: string) => stripDiacritics(s).toLowerCase();

const accountOf = (t: CTx) => acctOfDetails(t.details);

const RE = {
  insurance: (t: CTx) => /asigur|credit protect/.test(n(t.type)) && /credit/.test(n(t.type)),
  fee: (t: CTx) => /plata anticipata|rnpm|publicitate mobiliara|analiza dosar|comision acordare|evaluare imobil/.test(n(t.type)),
  card: (t: CTx) => /card credit|card de credit/.test(n(t.type)),
  bnpl: (t: CTx) => /twisto|heyblu|\btbi\b|mokka|paypo|klarna|afterpay|leanpay/.test(n(t.merchant + ' ' + t.counterparty)),
  leasing: (t: CTx) => /leasing/.test(n(t.type + ' ' + t.counterparty)),
  mortgage: (t: CTx) => /ipotec|imobiliar|noua casa|prima casa/.test(n([t.type, ...t.details].join(' '))),
};

const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Typical monthly amount = median of the last 3 calendar months that had a payment. */
function typical(monthly: Record<string, number>) {
  const ms = Object.keys(monthly).sort().slice(-3);
  return median(ms.map((m) => monthly[m]));
}

export function analyzeLoans(
  all: CTx[],
  settings: Record<string, LoanSettings>,
  dataTo: string,
  incomeMode: 'salary' | 'all',
  excluded: Set<string>,
): LoanAnalysis {
  const loans = new Map<string, Loan>();
  const groupInsurance: Record<string, number> = {};
  const events: LoanEvent[] = [];
  let lastPayoffAccount: string | undefined;
  let lastPayoffDate = '';
  let seqLoan = 0;

  const getLoan = (key: string, t: CTx, account?: string): Loan => {
    let l = loans.get(key);
    if (!l) {
      seqLoan++;
      const kind: LoanKind = RE.card(t) ? 'card' : RE.bnpl(t) ? 'bnpl' : RE.leasing(t) ? 'leasing' : RE.mortgage(t) ? 'ipotecar' : 'personal';
      const tail = account ? ` …${account.slice(-4)}` : '';
      const autoName =
        kind === 'card' ? `Card de credit${tail}` : account ? `Credit${tail}` : t.merchant || `Credit #${seqLoan}`;
      l = {
        key, account, name: autoName, kind, status: 'activ', monthly: {}, insurance: {}, payments: [], typicalRate: 0, typicalInsurance: 0,
        currentRate: 0, totalPaid: 0, fees: 0, auto: { name: autoName, kind },
      };
      loans.set(key, l);
    }
    return l;
  };

  for (const t of all) {
    const m = monthOf(t.date);
    const acct = accountOf(t);
    if (t.cat === 'credit-flows') {
      if (t.amount > 0) {
        const key = acct ? 'acct:' + acct : 'draw:' + t.id;
        const ev: LoanEvent = { date: t.date, type: 'drawdown', amount: t.amount, label: 'Credit nou tras', loanKey: key };
        events.push(ev);
        const l = getLoan(key, t, acct);
        l.drawdown = ev;
      } else {
        // Payoff rows often lack the account; ING lists the early-repayment fee (with account) right before them.
        // Lenders paid by card (BNPL / IFN) have no account: match the payoff to the loan by merchant.
        const key =
          acct && loans.has('acct:' + acct)
            ? 'acct:' + acct
            : lastPayoffDate === t.date && lastPayoffAccount
              ? 'acct:' + lastPayoffAccount
              : loans.has('m:' + t.mkey)
                ? 'm:' + t.mkey
                : acct
                  ? 'acct:' + acct
                  : undefined;
        const ev: LoanEvent = { date: t.date, type: 'payoff', amount: -t.amount, label: 'Rambursare anticipată / refinanțare', loanKey: key };
        events.push(ev);
        if (key && loans.has(key)) loans.get(key)!.payoff = ev;
      }
      continue;
    }
    if (t.amount >= 0) continue;
    if (RE.fee(t)) {
      const key = acct ? 'acct:' + acct : undefined;
      events.push({ date: t.date, type: 'fee', amount: -t.amount, label: t.type, loanKey: key && loans.has(key) ? key : undefined });
      if (key && loans.has(key)) loans.get(key)!.fees += -t.amount;
      if (/plata anticipata/.test(n(t.type)) && acct) {
        lastPayoffAccount = acct;
        lastPayoffDate = t.date;
      }
      continue;
    }
    if (RE.insurance(t)) {
      const key = acct ? 'acct:' + acct : undefined;
      if (key && loans.has(key)) {
        const l = loans.get(key)!;
        l.insurance[m] = (l.insurance[m] ?? 0) - t.amount;
      } else if (key) {
        // Insurance may precede the first rate in the same month — create the loan lazily.
        const l = getLoan(key, t, acct);
        l.insurance[m] = (l.insurance[m] ?? 0) - t.amount;
      } else {
        groupInsurance[m] = (groupInsurance[m] ?? 0) - t.amount;
      }
      continue;
    }
    if (t.cat !== 'loans') continue;
    const key = acct ? 'acct:' + acct : 'm:' + t.mkey;
    const l = getLoan(key, t, acct);
    if (RE.card(t) && l.auto.kind !== 'card') {
      // The account was first seen on a plain transfer; a card top-up row reveals it is a credit card.
      l.kind = l.auto.kind = 'card';
      l.name = l.auto.name = `Card de credit${acct ? ` …${acct.slice(-4)}` : ''}`;
    }
    l.monthly[m] = (l.monthly[m] ?? 0) - t.amount;
    l.payments.push(t);
    l.totalPaid += -t.amount;
    if (!l.firstDate || t.date < l.firstDate) l.firstDate = t.date;
    if (!l.lastDate || t.date > l.lastDate) l.lastDate = t.date;
  }

  // Attach payoff events that arrived before the loan entry existed (or by account).
  for (const ev of events) if (ev.type === 'payoff' && ev.loanKey && loans.has(ev.loanKey)) loans.get(ev.loanKey)!.payoff = ev;

  for (const l of loans.values()) {
    const s = settings[l.key] ?? {};
    if (s.name) l.name = s.name;
    if (s.kind) l.kind = s.kind;
    l.typicalRate = typical(l.monthly);
    l.typicalInsurance = typical(l.insurance);
  }
  // Status. An early repayment on its own can be partial, so it does not close a loan. A loan is closed when the user
  // says so, when no installment was seen for 45+ days, or when it was refinanced: paid off on the same day another
  // loan was drawn, with no installment afterwards.
  for (const l of loans.values()) {
    if (l.payoff && !(l.lastDate && l.lastDate > l.payoff.date)) {
      const by = [...loans.values()].find((x) => x !== l && x.drawdown?.date === l.payoff!.date);
      if (by) l.refinancedBy = by.key;
    }
  }
  for (const l of loans.values()) {
    const s = settings[l.key] ?? {};
    const stale = l.lastDate ? daysBetween(l.lastDate, dataTo) > 45 : false;
    if (s.closed === true) l.status = 'inchis';
    else if (!l.payments.length && l.drawdown) l.status = 'nou';
    else if (s.closed === false) l.status = 'activ';
    else if (l.refinancedBy || (stale && l.kind !== 'card')) l.status = 'inchis';
    else l.status = 'activ';
    l.currentRate = l.status === 'inchis' ? 0 : s.manualRate ?? l.typicalRate;
  }
  // A new refinancing loan without installments yet: until its first rate (or a manual one), estimate it from
  // what the refinanced loans cost per month (rate + insurance), so the debt ratio does not drop artificially.
  for (const l of loans.values()) {
    if (l.status !== 'nou' || settings[l.key]?.manualRate != null) continue;
    const old = [...loans.values()].filter((x) => x.refinancedBy === l.key && x.status === 'inchis');
    const est = old.reduce((sum, x) => sum + x.typicalRate + x.typicalInsurance, 0);
    if (est > 0) {
      l.currentRate = est;
      l.estimated = true;
    }
  }

  // Income
  const incomePerMonth: Record<string, number> = {};
  const salaryPerMonth: Record<string, number> = {};
  for (const t of all) {
    if (t.amount <= 0 || excluded.has(t.cat)) continue;
    const m = monthOf(t.date);
    incomePerMonth[m] = (incomePerMonth[m] ?? 0) + t.amount;
    if (t.cat === 'salary') salaryPerMonth[m] = (salaryPerMonth[m] ?? 0) + t.amount;
  }
  const first = all[0]?.date ?? dataTo;
  const months = monthsInRange(first, dataTo);
  // Use complete months only for the income average (the last month may be partial).
  const lastFull = daysBetween(dataTo, monthEnd(monthOf(dataTo))) <= 3 ? months : months.slice(0, -1);
  const useSalary = incomeMode === 'salary' && Object.keys(salaryPerMonth).length > 0;
  const src = useSalary ? salaryPerMonth : incomePerMonth;
  const basisMonths = lastFull.filter((m) => (src[m] ?? 0) > 0).slice(-3);
  const incomeBasis = basisMonths.length ? basisMonths.reduce((s, m) => s + src[m], 0) / basisMonths.length : 0;

  const groupInsuranceTypical = typical(groupInsurance);
  const visible = [...loans.values()].filter((l) => !settings[l.key]?.hidden);
  const currentService =
    visible.reduce((s, l) => s + l.currentRate + (l.status === 'inchis' ? 0 : l.typicalInsurance), 0) + groupInsuranceTypical;

  const servicePerMonth: Record<string, number> = {};
  for (const m of months) {
    servicePerMonth[m] =
      visible.reduce((s, l) => s + (l.monthly[m] ?? 0) + (l.insurance[m] ?? 0), 0) + (groupInsurance[m] ?? 0);
  }

  const order: Record<LoanStatus, number> = { activ: 0, nou: 1, inchis: 2 };
  return {
    loans: [...loans.values()].sort((a, b) => order[a.status] - order[b.status] || b.currentRate - a.currentRate || b.totalPaid - a.totalPaid),
    groupInsurance,
    groupInsuranceTypical,
    events: events.sort((a, b) => (a.date < b.date ? 1 : -1)),
    months,
    servicePerMonth,
    incomePerMonth,
    salaryPerMonth,
    currentService,
    incomeBasis,
    incomeLabel: useSalary ? 'salariul mediu net' : 'venitul mediu lunar',
    dti: incomeBasis > 0 ? currentService / incomeBasis : null,
  };
}

export function dtiZone(v: number): { label: string; color: string; text: string } {
  if (v < 0.3) return { label: 'Confortabil', color: '#34d399', text: 'Sub 30% — ai spațiu de manevră în buget.' };
  if (v < 0.4) return { label: 'Atenție', color: '#fbbf24', text: 'Între 30% și 40% — aproape de limita BNR.' };
  if (v < 0.45) return { label: 'La limită', color: '#fb923c', text: 'Peste 40% — limita BNR pentru credite noi (45% doar pentru prima locuință în lei).' };
  return { label: 'Ridicat', color: '#fb7185', text: 'Peste 45% — un credit nou ar fi greu de obținut, iar bugetul e sensibil la șocuri.' };
}
