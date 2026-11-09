import { detectDelimiter, tokenizeCsv } from './csv';
import { normalizeMerchant } from './merchants';
import type { Tx } from './types';

const MONTHS: Record<string, number> = {
  ianuarie: 1, februarie: 2, martie: 3, aprilie: 4, mai: 5, iunie: 6,
  iulie: 7, august: 8, septembrie: 9, octombrie: 10, noiembrie: 11, decembrie: 12,
  ian: 1, feb: 2, mar: 3, apr: 4, iun: 6, iul: 7, aug: 8, sep: 9, sept: 9, oct: 10, noi: 11, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, october: 10, november: 11, december: 12,
};

export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[șşŞȘ]/g, (c) => (c === c.toLowerCase() ? 's' : 'S'))
    .replace(/[țţŢȚ]/g, (c) => (c === c.toLowerCase() ? 't' : 'T'));
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function validDate(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1;
}

/** Parse Romanian bank dates: "09 noiembrie 2026", "09-11-2026", "09.11.2026", "2026-11-09". */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = stripDiacritics(raw.trim().toLowerCase());
  let m = s.match(/^(\d{1,2})[\s.\-/]+([a-z]+)\.?[\s.\-/]+(\d{4})/);
  if (m) {
    const mon = MONTHS[m[2]] ?? MONTHS[m[2].slice(0, 3)];
    const d = +m[1], y = +m[3];
    if (mon && validDate(y, mon, d)) return iso(y, mon, d);
    return null;
  }
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    return validDate(y, mo, d) ? iso(y, mo, d) : null;
  }
  m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return validDate(y, mo, d) ? iso(y, mo, d) : null;
  }
  return null;
}

/** Parse "1.234,56" / "28,08" / "-12.5" / "1 234,56 RON" → number (NaN when empty). */
export function parseAmount(raw: string | undefined): number {
  if (raw == null) return NaN;
  let s = raw.replace(/[^\d,.\-]/g, '');
  if (!s || s === '-') return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : NaN;
}

export class ParseError extends Error {}

export interface ParseResult {
  txs: Tx[];
  currency: string;
  iban?: string;
  warnings: string[];
}

const keyOf = (s: string) => stripDiacritics(s).toLowerCase().replace(/\s+/g, ' ').trim();

interface Draft {
  bookDate: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
  details: string[];
  seq: number;
}

const SKIP_ROW = /^(rulaj|sold|total|sume blocate|disponibil)/i;

export function parseStatement(text: string): ParseResult {
  const delimiter = detectDelimiter(text);
  const rows = tokenizeCsv(text, delimiter).map((r) => r.map((c) => c.trim()));
  const warnings: string[] = [];

  // 1. Locate the header row by content.
  let headerIdx = -1;
  let col = { date: -1, details: -1, debit: -1, credit: -1, balance: -1 };
  for (let i = 0; i < Math.min(rows.length, 80); i++) {
    const cells = rows[i].map(keyOf);
    const dateC = cells.findIndex((c) => c === 'data' || c === 'data tranzactie' || c === 'data operatiunii' || c === 'data inregistrare');
    const debitC = cells.findIndex((c) => c.startsWith('debit'));
    const creditC = cells.findIndex((c) => c.startsWith('credit'));
    if (dateC >= 0 && debitC >= 0 && creditC >= 0) {
      headerIdx = i;
      col = {
        date: dateC,
        details: cells.findIndex((c) => c.includes('detalii') || c.includes('descriere') || c.includes('explicatii')),
        debit: debitC,
        credit: creditC,
        balance: cells.findIndex((c) => c.startsWith('balanta') || c.startsWith('sold')),
      };
      if (col.details < 0) col.details = dateC + 1;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new ParseError(
      'Nu am găsit capul de tabel (coloanele „Data”, „Debit”, „Credit”). Verifică dacă fișierul este un extras de cont CSV.',
    );
  }

  // 2. Preamble: currency + IBAN.
  const preamble = rows.slice(0, headerIdx).map((r) => r.join(' ')).join('\n');
  const curMatch = preamble.match(/\b(RON|EUR|USD|GBP|CHF|HUF)\b/);
  const ibanMatch = preamble.replace(/\s+/g, ' ').match(/\bRO\d{2}\s?[A-Z]{4}(?:\s?[0-9A-Z]){16}\b/);
  const currency = curMatch ? curMatch[1] : 'RON';
  const iban = ibanMatch ? ibanMatch[0].replace(/\s/g, '') : undefined;

  // 3. Walk rows: a record starts on a row with a valid date; following rows without date are details.
  const drafts: Draft[] = [];
  let cur: Draft | null = null;
  const close = () => {
    if (cur) drafts.push(cur);
    cur = null;
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some((c) => c)) {
      close(); // blank row ends a record (protects against statement footers)
      continue;
    }
    const dateCell = r[col.date] ?? '';
    const detail = r[col.details] ?? '';
    const typeText = detail || r.slice(col.date + 1, col.debit).filter(Boolean).join(' ');

    if (SKIP_ROW.test(keyOf(typeText)) || SKIP_ROW.test(keyOf(dateCell))) {
      close();
      continue;
    }
    const date = parseDate(dateCell);
    if (date) {
      close();
      cur = {
        bookDate: date,
        type: typeText,
        debit: parseAmount(r[col.debit]),
        credit: parseAmount(r[col.credit]),
        balance: col.balance >= 0 ? parseAmount(r[col.balance]) : NaN,
        details: [],
        seq: drafts.length,
      };
      continue;
    }
    if (cur && !dateCell) {
      const d: Draft = cur;
      const line = r.slice(col.date + 1, col.debit).filter(Boolean).join(' ') || detail;
      if (line) d.details.push(line);
      if (Number.isNaN(d.debit)) d.debit = parseAmount(r[col.debit]);
      if (Number.isNaN(d.credit)) d.credit = parseAmount(r[col.credit]);
      if (Number.isNaN(d.balance) && col.balance >= 0) d.balance = parseAmount(r[col.balance]);
      continue;
    }
    close();
  }
  close();

  // 4. Build transactions.
  const txs: Tx[] = [];
  const seenIds = new Map<string, number>();
  for (const d of drafts) {
    // Drop trailing free-text lines (signatures, bank footer) after the last "Key: value" line.
    let lastKv = -1;
    d.details.forEach((l, i) => { if (l.indexOf(':') > 0) lastKv = i; });
    if (lastKv >= 0) d.details = d.details.slice(0, lastKv + 1);
    const debit = Number.isNaN(d.debit) ? 0 : Math.abs(d.debit);
    const credit = Number.isNaN(d.credit) ? 0 : Math.abs(d.credit);
    const amount = Math.round((credit - debit) * 100) / 100;
    if (amount === 0) continue;

    const info: Record<string, string> = {};
    for (const line of d.details) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = keyOf(line.slice(0, idx));
        const v = line.slice(idx + 1).trim();
        if (v && !info[k]) info[k] = v;
      }
    }
    const authDate = parseDate(info['data autorizarii'] ?? info['data tranzactiei'] ?? '');
    const counterparty =
      info['tranzactie la'] ??
      info['comerciant'] ??
      (amount < 0 ? info['beneficiar'] ?? info['catre'] : info['ordonator'] ?? info['platitor'] ?? info['de la']) ??
      info['beneficiar'] ??
      info['ordonator'] ??
      '';
    const auth = info['numar autorizare'] ?? info['nr. autorizare'] ?? info['referinta'];
    const card = info['numar card'];
    const balance = Number.isNaN(d.balance) ? null : d.balance;

    const baseId = [d.bookDate, amount.toFixed(2), balance?.toFixed(2) ?? '', auth ?? '', keyOf(d.type)].join('|');
    const occ = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, occ + 1);
    txs.push({
      id: occ ? `${baseId}#${occ}` : baseId,
      date: authDate && authDate <= d.bookDate ? authDate : d.bookDate,
      bookDate: d.bookDate,
      type: d.type,
      amount,
      balance,
      counterparty,
      merchant: normalizeMerchant(counterparty, d.type, d.details),
      details: d.details,
      card,
      auth,
      currency,
      seq: d.seq,
    });
  }
  if (!txs.length) warnings.push('Fișierul nu conține tranzacții.');
  return { txs, currency, iban, warnings };
}
