import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { dateLabel, monthLabel, monthsInRange } from '../lib/analytics';
import { monthEnd, monthOf, monthStart, type MonthMode, shiftKey } from '../lib/months';

export type Period = { kind: 'all' | '3m' | '6m' | '12m' | 'ytd' | 'month'; month?: string };

export function resolvePeriod(p: Period, dataFrom: string, dataTo: string): { from: string; to: string } {
  const clamp = (f: string, t: string) => ({ from: f < dataFrom ? dataFrom : f, to: t > dataTo ? dataTo : t });
  const lastKey = monthOf(dataTo);
  switch (p.kind) {
    case 'month': {
      const m = p.month ?? lastKey;
      return clamp(monthStart(m), monthEnd(m));
    }
    case '3m':
    case '6m':
    case '12m': {
      const n = parseInt(p.kind, 10);
      return clamp(monthStart(shiftKey(lastKey, -(n - 1))), dataTo);
    }
    case 'ytd':
      return clamp(monthStart(`${dataTo.slice(0, 4)}-01`), dataTo);
    default:
      return { from: dataFrom, to: dataTo };
  }
}

interface Props {
  period: Period;
  setPeriod: (p: Period) => void;
  dataFrom: string;
  dataTo: string;
  from: string;
  to: string;
  monthMode: MonthMode;
  setMonthMode: (m: MonthMode) => void;
  payday: number;
  autoPayday: number | null;
  setPayday: (d: number | null) => void;
}

export function PeriodBar({ period, setPeriod, dataFrom, dataTo, from, to, monthMode, setMonthMode, payday, autoPayday, setPayday }: Props) {
  const months = monthsInRange(dataFrom, dataTo);
  const presets: { k: Period['kind']; label: string; min: number }[] = [
    { k: 'all', label: 'Tot', min: 0 },
    { k: 'month', label: 'O lună', min: 2 },
    { k: '3m', label: '3 luni', min: 4 },
    { k: '6m', label: '6 luni', min: 7 },
    { k: '12m', label: '12 luni', min: 13 },
    { k: 'ytd', label: `Anul ${dataTo.slice(0, 4)}`, min: 2 },
  ];
  const showYtd = dataFrom.slice(0, 4) < dataTo.slice(0, 4);
  const cur = period.kind === 'month' ? period.month ?? months[months.length - 1] : null;
  const idx = cur ? months.indexOf(cur) : -1;
  const go = (i: number) => months[i] && setPeriod({ kind: 'month', month: months[i] });
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the selected month chip visible inside the horizontally scrolling strip.
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('.chip.on');
    if (!strip || !chip) return;
    const left = chip.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + chip.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollTo({ left: left - (strip.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
  }, [cur, monthMode]);
  const range = (m: string) => `${dateLabel(monthStart(m), false)} – ${dateLabel(monthEnd(m), false)}`;

  return (
    <div className="period">
      <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
        <div className="seg" title="Cum se definește o lună">
          <button className={monthMode === 'calendar' ? 'on' : ''} onClick={() => setMonthMode('calendar')}>Lună calendaristică</button>
          <button className={monthMode === 'salary' ? 'on' : ''} onClick={() => setMonthMode('salary')}>De la salariu</button>
        </div>
        {monthMode === 'salary' && (
          <label className="row faint" style={{ gap: 6, fontSize: 12 }} title="Dacă ziua pică în weekend, ciclul începe vinerea dinainte. Lunile în care salariul apare în extras folosesc data reală.">
            ziua salariului
            <input
              className="input"
              type="number"
              min={1}
              max={31}
              value={payday}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setPayday(Number.isFinite(v) && v >= 1 && v <= 31 ? v : null);
              }}
              style={{ width: 58, padding: '5px 8px' }}
            />
            {autoPayday != null && autoPayday !== payday && (
              <button className="chip" onClick={() => setPayday(null)}>auto: {autoPayday}</button>
            )}
          </label>
        )}
      </div>
      <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
        <span className="faint" style={{ fontSize: 12 }}>
          {dateLabel(from)} – {dateLabel(to)}
        </span>
        <div className="seg">
          {presets
            .filter((p) => (p.k === 'ytd' ? showYtd : months.length >= p.min))
            .map((p) => (
              <button
                key={p.k}
                className={period.kind === p.k ? 'on' : ''}
                onClick={() => setPeriod(p.k === 'month' ? { kind: 'month', month: cur ?? months[months.length - 1] } : { kind: p.k })}
              >
                {p.label}
              </button>
            ))}
        </div>
      </div>
      {months.length > 1 && (
        <div className="row" style={{ gap: 6, maxWidth: '100%', minWidth: 0 }}>
          {cur && (
            <button className="icon-btn plain" disabled={idx <= 0} onClick={() => go(idx - 1)} aria-label="Luna anterioară">
              <ChevronLeft size={16} />
            </button>
          )}
          <div className="months-strip" ref={stripRef}>
            {months.map((m) => (
              <button
                key={m}
                title={range(m)}
                className={`chip ${cur === m ? 'on' : ''}`}
                onClick={() => setPeriod({ kind: 'month', month: m })}
              >
                {monthLabel(m)}
                {monthMode === 'salary' && cur === m && <span style={{ opacity: 0.75 }}> · {range(m)}</span>}
              </button>
            ))}
          </div>
          {cur && (
            <button className="icon-btn plain" disabled={idx >= months.length - 1} onClick={() => go(idx + 1)} aria-label="Luna următoare">
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
