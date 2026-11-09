import { afterAll, describe, expect, it } from 'vitest';
import { configureMonths, detectPayday, monthEnd, monthOf, monthStart, ruleDate } from '../src/lib/months';

describe('salary cycles', () => {
  afterAll(() => configureMonths('calendar', 10, []));
  it('moves weekend paydays to the previous Friday', () => {
    expect(ruleDate('2026-10', 10)).toBe('2026-10-09'); // Sat → Fri
    expect(ruleDate('2026-05', 10)).toBe('2026-05-08'); // Sun → Fri
    expect(ruleDate('2026-09', 10)).toBe('2026-09-10'); // Thu
  });
  it('detects the payday and ignores small extra payments', () => {
    const sal = [
      { date: '2026-06-10', amount: 17000 }, { date: '2026-06-30', amount: 1800 },
      { date: '2026-07-10', amount: 17000 }, { date: '2026-08-10', amount: 17000 },
      { date: '2026-09-10', amount: 17000 }, { date: '2026-10-09', amount: 17000 },
    ];
    const { payday, main } = detectPayday(sal);
    expect(payday).toBe(10);
    expect(main).toHaveLength(5);
    configureMonths('salary', payday!, main);
    expect(monthStart('2026-10')).toBe('2026-10-09');
    expect(monthEnd('2026-09')).toBe('2026-10-08');
    expect(monthOf('2026-10-08')).toBe('2026-09');
    expect(monthOf('2026-10-09')).toBe('2026-10');
    expect(monthStart('2026-11')).toBe('2026-11-10'); // future month → rule
    expect(monthOf('2026-11-09')).toBe('2026-10');
    expect(monthOf('2026-06-30')).toBe('2026-06');
  });
});
