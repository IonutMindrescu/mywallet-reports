import { describe, expect, it } from 'vitest';
import { detectOwnAccounts } from '../src/lib/accounts';
import { categorize } from '../src/lib/categories';
import { analyzeLoans } from '../src/lib/loans';
import { findBrand, normalizeMerchant } from '../src/lib/merchants';
import type { Tx } from '../src/lib/types';

let seq = 0;
function tx(date: string, amount: number, type: string, counterparty: string, details: string[] = []): Tx {
  seq++;
  return {
    id: `t${seq}`, date, bookDate: date, type, amount, balance: 0, counterparty,
    merchant: normalizeMerchant(counterparty, type, details), details, currency: 'RON', seq,
  };
}
const pos = (date: string, amount: number, where: string) =>
  tx(date, amount, 'Cumparare POS', where, [`Tranzactie la:${where}`, 'Numar card:**** 0000']);
const out = (date: string, amount: number, name: string, iban: string, note?: string) =>
  tx(date, -amount, "Transfer Home'Bank", name, [`Beneficiar:${name}`, `In contul:${iban}`, ...(note ? [`Detalii:${note}`] : [])]);
const inc = (date: string, amount: number, name: string, iban: string, note?: string) =>
  tx(date, amount, 'Incasare', name, [`Ordonator:${name}`, `Din contul:${iban}`, ...(note ? [`Detalii:${note}`] : [])]);

const cats = (txs: Tx[]) => categorize(txs, {}).map((t) => t.cat);

describe('brand matching', () => {
  it('prefers named brands over generic keywords', () => {
    expect(findBrand('PayU*eMAG.ro/Market  RO  BUCURESTI')?.[1]).toBe('online');
    expect(findBrand('PayU*twisto_eMAG.ro  RO  ROMANIA')).toEqual(['Twisto', 'loans']);
  });
  it('does not match brands inside other words or in the city field', () => {
    expect(findBrand('FIXBOX SRL  RO  BUCURESTI')?.[0]).not.toBe('Microsoft');
    expect(findBrand('PayPoint*SOMETHING  RO  CITY')?.[0]).not.toBe('PayPo');
    expect(findBrand('SOME BISTRO  RO  MUNICIPIUL BU')?.[1]).toBe('restaurants');
    expect(findBrand('MUNICIPIUL ORAS  RO  ORAS')?.[1]).toBe('taxes');
  });
  it('classifies generic merchant names', () => {
    const c = cats([
      pos('2026-01-02', -40, 'INMEDIO 123  RO  ORAS'),
      pos('2026-01-02', -60, 'PIZZA NAPOLI  RO  ORAS'),
      pos('2026-01-02', -200, 'SERVICE ROTI AUTO SRL  RO  ORAS'),
      pos('2026-01-02', -80, 'NTP*unknownshop  RO  BUCURESTI'),
      pos('2026-01-02', -90, 'ROSE FLOWERS  RO  ORAS'),
      pos('2026-01-02', -50, 'HELLCASE  CY  CYPRUS'),
    ]);
    expect(c).toEqual(['tobacco', 'restaurants', 'auto', 'online', 'gifts', 'entertainment']);
  });
});

describe('own accounts', () => {
  const ME = 'Popescu Ion Andrei';
  const data = () => [
    out('2026-01-03', 500, ME, 'RO11BANK0000000000000001'),
    inc('2026-01-05', 200, 'Ion Andrei Popescu', 'RO11BANK0000000000000001'),
    out('2026-01-06', 300, ME, 'RO11BANK0000000000000002'),
    inc('2026-01-08', 300, 'Ion Popescu', 'RO99REVO0000000000000003', 'Economii'),
    // A relative (same surname) — transfers both ways but a single account.
    out('2026-01-09', 100, 'Maria Popescu', 'RO11BANK0000000000000004'),
    inc('2026-01-10', 50, 'Maria Popescu', 'RO11BANK0000000000000004'),
    // Mixed names on a relative's account: one transfer typed with the holder's name.
    out('2026-01-11', 70, 'Popescu Ion', 'RO11BANK0000000000000005'),
    out('2026-01-12', 70, 'Elena Popescu', 'RO11BANK0000000000000005'),
    // Stranger sharing a first name.
    out('2026-01-13', 40, 'Ion Vasile', 'RO11BANK0000000000000006'),
  ];
  it('finds only the holder accounts', () => {
    const { accounts } = detectOwnAccounts(data());
    expect([...accounts].sort()).toEqual(['RO11BANK0000000000000001', 'RO11BANK0000000000000002', 'RO99REVO0000000000000003']);
  });
  it('categorizes them as own transfers, others stay transfers', () => {
    expect(cats(data())).toEqual([
      'own-transfer', 'own-transfer', 'own-transfer', 'own-transfer',
      'transfer-out', 'transfer-in', 'transfer-out', 'transfer-out', 'transfer-out',
    ]);
  });
  it('respects a "not my account" answer', () => {
    const c = categorize(data(), {}, ['andrei ion popescu']).map((t) => t.cat);
    expect(c[0]).toBe('transfer-out');
  });
  it('treats transfers into a credit-card account as debt service', () => {
    const card = 'RO11BANK0000000000000009';
    const txs = [...data(), tx('2026-01-15', -50, 'Alimentare Card Credit (debit direct)', '', [`In contul:${card}`]), out('2026-01-16', 900, ME, card)];
    const c = cats(txs);
    expect(c.slice(-2)).toEqual(['loans', 'loans']);
    const la = analyzeLoans(categorize(txs, {}), {}, '2026-01-20', 'all', new Set());
    expect(la.loans.find((l) => l.account === card)?.kind).toBe('card');
  });
});

describe('transfers and income', () => {
  it('reads intent from the transfer note', () => {
    expect(cats([
      out('2026-02-01', 300, 'Alex Ionescu', 'RO11BANK0000000000000010', 'cadou'),
      out('2026-02-01', 2000, 'Alex Ionescu', 'RO11BANK0000000000000010', 'cazare mare'),
      out('2026-02-01', 1500, 'Alex Ionescu', 'RO11BANK0000000000000010', 'chirie feb'),
    ])).toEqual(['gifts', 'travel', 'rent']);
  });
  it('splits income into salary, reimbursements, sales and refunds', () => {
    expect(cats([
      inc('2026-02-10', 9000, 'ACME SRL', 'RO11BANK0000000000000020', 'salariu'),
      inc('2026-02-11', 120, 'ACME SRL', 'RO11BANK0000000000000020', 'avans cheltuieli'),
      inc('2026-02-12', 300, 'PAYU SA', 'RO11BANK0000000000000021', 'OLX Delivery order X'),
      inc('2026-02-13', 250, 'DELIVERY SOLUTIONS SA', 'RO11BANK0000000000000022', '1C2C123'),
      inc('2026-02-14', 90, 'SHOP SRL', 'RO11BANK0000000000000023', 'STORNO 123'),
    ])).toEqual(['salary', 'refund', 'sales', 'sales', 'refund']);
  });
  it('routes BNPL card payments to loans and a transfer to the lender to credit flows', () => {
    const txs = categorize([
      pos('2026-03-01', -700, 'PayU*Heyblu.ro  RO  ROMANIA'),
      pos('2026-04-01', -700, 'PayU*Heyblu.ro  RO  ROMANIA'),
      tx('2026-04-20', -5000, 'Transfer', 'HEYBLU FINANCIAL SERVICES', ['Beneficiar:HEYBLU FINANCIAL SERVICES', 'In contul:RO11BANK0000000000000030', 'Detalii:Ref ctr']),
      tx('2026-04-21', -500, 'Plati cu cardul de tip transfer fonduri', 'SOME BANK  RO  CITY', ['Tranzactie la:SOME BANK  RO  CITY']),
    ], {});
    expect(txs.map((t) => t.cat)).toEqual(['loans', 'loans', 'credit-flows', 'wallets']);
    const la = analyzeLoans(txs, {}, '2026-04-25', 'all', new Set());
    const l = la.loans.find((x) => x.name === 'Heyblu');
    expect(l?.payoff?.amount).toBe(5000);
    expect(l?.status).toBe('activ');
  });
});
