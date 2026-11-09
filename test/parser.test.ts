import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAmount, parseDate, parseStatement } from '../src/lib/parser';
import { generateDemoCsv } from '../src/lib/demo';
import { categorize } from '../src/lib/categories';
import { cleanCounterparty } from '../src/lib/merchants';

describe('primitives', () => {
  it('parses Romanian amounts', () => {
    expect(parseAmount('28,08')).toBe(28.08);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('12.345.678,9')).toBe(12345678.9);
    expect(parseAmount('')).toBeNaN();
  });
  it('parses Romanian dates', () => {
    expect(parseDate('09 noiembrie 2026')).toBe('2026-11-09');
    expect(parseDate('1 Martie 2026')).toBe('2026-03-01');
    expect(parseDate('07-11-2026')).toBe('2026-11-07');
    expect(parseDate('07.11.2026')).toBe('2026-11-07');
    expect(parseDate('2026-11-07')).toBe('2026-11-07');
    expect(parseDate('Numar card')).toBeNull();
  });
  it('cleans merchants', () => {
    expect(cleanCounterparty('PayU*sameday.ro  RO  ROMANIA')).toBe('sameday.ro');
    expect(cleanCounterparty('TRATTORIA IL CALCIO  RO  BUCURESTI')).toBe('Trattoria Il Calcio');
  });
});

describe('sample fixture', () => {
  it('parses the single transaction', () => {
    const res = parseStatement(readFileSync(new URL('./fixtures/sample.csv', import.meta.url), 'utf8'));
    expect(res.txs).toHaveLength(1);
    const t = res.txs[0];
    expect(t.amount).toBe(-28.08);
    expect(t.balance).toBe(990.02);
    expect(t.bookDate).toBe('2026-11-09');
    expect(t.date).toBe('2026-11-07');
    expect(t.merchant).toBe('Sameday');
    expect(t.auth).toBe('033665');
    expect(t.card).toBe('**** 7822');
    expect(categorize(res.txs, {})[0].cat).toBe('online');
  });
});

describe('demo statement', () => {
  const csv = generateDemoCsv(new Date(2026, 10, 9));
  const res = parseStatement(csv);
  const ctx = categorize(res.txs, {});

  it('parses many transactions with metadata', () => {
    expect(res.currency).toBe('RON');
    expect(res.iban).toBe('RO49BTRLRONCRT0123456789');
    expect(res.txs.length).toBeGreaterThan(500);
    expect(res.txs.every((t) => t.amount !== 0)).toBe(true);
  });
  it('balances chain correctly', () => {
    expect(res.txs.some((t) => (t.balance ?? 0) < 0)).toBe(false);
    for (let i = 1; i < res.txs.length; i++) {
      const prev = res.txs[i - 1].balance!;
      const t = res.txs[i];
      expect(Math.round((prev + t.amount) * 100) / 100).toBe(t.balance);
    }
  });
  it('keeps identical same-day purchases apart', () => {
    const ids = new Set(res.txs.map((t) => t.id));
    expect(ids.size).toBe(res.txs.length);
  });
  it('categorizes key flows', () => {
    const byCat = (c: string) => ctx.filter((t) => t.cat === c);
    expect(byCat('salary').length).toBeGreaterThanOrEqual(12);
    expect(byCat('own-transfer').length).toBeGreaterThanOrEqual(11);
    expect(byCat('subscriptions').length).toBeGreaterThanOrEqual(30);
    expect(byCat('fees').length).toBeGreaterThanOrEqual(11);
    expect(byCat('cash').length).toBeGreaterThan(3);
    expect(byCat('refund').length).toBe(1);
    const other = byCat('other');
    expect(other.length, other.map((t) => t.merchant + ' / ' + t.type).join('\n')).toBe(0);
  });
});

describe('ING-style quirks', () => {
  const csv = [
    'Data,,,Detalii tranzactie,,Debit,Credit,Sold',
    '08 noiembrie 2026,,,Tranzactie Round Up,,"0,50",,"100,00"',
    ',,,Referinta:111,,,,',
    ',,,In contul:RO00INGB0000999900000000,,,,',
    '08 noiembrie 2026,,,Alocare fonduri credit,,,"250.000,00","250.100,00"',
    ',,,Referinta:222,,,,',
    '08 noiembrie 2026,,,Cumparare POS corectie,,,"12,00","250.112,00"',
    ',,,Tranzactie la:LIDL 123  RO  BUCURESTI,,,,',
    ',,,Ion Popescu,,,,',
    ',,,Director Sucursala,,,,',
  ].join('\n');
  const res = parseStatement(csv);
  const ctx = categorize(res.txs, {});
  it('categorizes credit flows, round ups and corrections', () => {
    expect(ctx.map((t) => t.cat)).toEqual(['own-transfer', 'credit-flows', 'refund']);
  });
  it('drops footer lines from the last transaction', () => {
    expect(res.txs[2].details).toEqual(['Tranzactie la:LIDL 123  RO  BUCURESTI']);
  });
});

describe('card metadata does not trigger loan rule', () => {
  it('keeps Netflix as subscription even with "Rata ING" detail', () => {
    const csv = [
      'Data,,,Detalii tranzactie,,Debit,Credit,Sold',
      '08 noiembrie 2026,,,Cumparare POS,,"59,99",,"100,00"',
      ',,,Tranzactie la:NETFLIX.COM  NL  AMSTERDAM,,,,',
      ',,,Rata ING:0,,,,',
    ].join('\n');
    expect(categorize(parseStatement(csv).txs, {})[0].cat).toBe('subscriptions');
  });
});
