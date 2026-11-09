import { describe, expect, it } from 'vitest';
import { categorize } from '../src/lib/categories';
import { analyzeLoans } from '../src/lib/loans';
import { parseStatement } from '../src/lib/parser';

const rows = [
  'Data,,,Detalii tranzactie,,Debit,Credit,Sold',
  '10 septembrie 2026,,,Incasare,,,"10.000,00","20.000,00"',
  ',,,Ordonator:ACME SRL,,,,',
  ',,,Detalii:Salariu august,,,,',
  '12 septembrie 2026,,,Rata Credit,,"2.000,00",,"18.000,00"',
  ',,,In contul:RO00INGB0000000000001111,,,,',
  '12 septembrie 2026,,,Prima asigurare ING Credit Protect,,"100,00",,"17.900,00"',
  ',,,In contul:RO00INGB0000000000001111,,,,',
  '14 septembrie 2026,,,Rata Credit,,"1.000,00",,"16.900,00"',
  ',,,In contul:RO00INGB0000000000002222,,,,',
  '10 octombrie 2026,,,Incasare,,,"10.000,00","26.900,00"',
  ',,,Ordonator:ACME SRL,,,,',
  ',,,Detalii:Salariu septembrie,,,,',
  '12 octombrie 2026,,,Rata Credit,,"2.000,00",,"24.900,00"',
  ',,,In contul:RO00INGB0000000000001111,,,,',
  '14 octombrie 2026,,,Rata Credit,,"1.000,00",,"23.900,00"',
  ',,,In contul:RO00INGB0000000000002222,,,,',
  '06 noiembrie 2026,,,Comision plata anticipata,,"500,00",,"23.400,00"',
  ',,,In contul:RO00INGB0000000000001111,,,,',
  '06 noiembrie 2026,,,Recalculari aferente creditului,,"80.000,00",,"-56.600,00"',
  ',,,Referinta:1,,,,',
  '06 noiembrie 2026,,,Alocare fonduri credit,,,"90.000,00","33.400,00"',
  ',,,Din contul:RO00INGB0000000000003333,,,,',
];

describe('loan analysis', () => {
  const all = categorize(parseStatement(rows.join('\n')).txs, {});
  const ex = new Set(['own-transfer', 'wallets', 'credit-flows']);
  const a = analyzeLoans(all, {}, '2026-11-09', 'salary', ex);
  const byTail = (t: string) => a.loans.find((l) => l.account?.endsWith(t))!;

  it('groups by loan account and detects refinancing', () => {
    expect(a.loans).toHaveLength(3);
    // Paid off on the day a new loan was drawn → refinanced → closed.
    expect(byTail('1111').status).toBe('inchis');
    expect(byTail('1111').refinancedBy).toBe(byTail('3333').key);
    expect(byTail('1111').payoff?.amount).toBe(80000);
    expect(byTail('1111').typicalInsurance).toBe(100);
    expect(byTail('2222').status).toBe('activ');
    expect(byTail('2222').refinancedBy).toBeUndefined();
    expect(byTail('2222').typicalRate).toBe(1000);
    expect(byTail('3333').status).toBe('nou');
  });
  it('estimates the new loan from the refinanced ones until its first installment', () => {
    expect(byTail('3333').estimated).toBe(true);
    expect(byTail('3333').currentRate).toBe(2100);
    expect(a.currentService).toBe(3100);
    expect(a.incomeBasis).toBe(10000);
    expect(a.dti).toBeCloseTo(0.31);
    // A manual rate replaces the estimate.
    const manual = analyzeLoans(all, { [byTail('3333').key]: { manualRate: 2500 } }, '2026-11-09', 'salary', ex);
    expect(manual.dti).toBeCloseTo(0.35);
    // The first installment in a later statement replaces it too.
    const later = [...rows, '11 noiembrie 2026,,,Rata Credit,,"2.400,00",,"31.000,00"', ',,,In contul:RO00INGB0000000000003333,,,,'];
    const b = analyzeLoans(categorize(parseStatement(later.join('\n')).txs, {}), {}, '2026-11-12', 'salary', ex);
    expect(b.loans.find((l) => l.account?.endsWith('3333'))!.estimated).toBeFalsy();
    expect(b.currentService).toBe(3400);
  });
  it('keeps a loan active after an early repayment without refinancing, unless closed or reopened by the user', () => {
    const noDraw = rows.slice(0, -2);
    const c = analyzeLoans(categorize(parseStatement(noDraw.join('\n')).txs, {}), {}, '2026-11-09', 'salary', ex);
    const l = c.loans.find((x) => x.account?.endsWith('1111'))!;
    expect(l.status).toBe('activ');
    expect(c.currentService).toBe(3100);
    expect(analyzeLoans(categorize(parseStatement(noDraw.join('\n')).txs, {}), { [l.key]: { closed: true } }, '2026-11-09', 'salary', ex).currentService).toBe(1000);
    const reopened = analyzeLoans(all, { [byTail('1111').key]: { closed: false } }, '2026-11-09', 'salary', ex);
    expect(reopened.loans.find((x) => x.account?.endsWith('1111'))!.status).toBe('activ');
  });
});
