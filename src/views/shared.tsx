import { type ReactNode, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import type { Ctx, Recurring } from '../lib/analytics';
import { CAT } from '../lib/categories';
import type { CTx } from '../lib/types';
import type { TxModalSpec } from './TxModal';

export type ViewId = 'overview' | 'categories' | 'merchants' | 'patterns' | 'recurring' | 'loans' | 'flow' | 'transactions';

export interface TxFilter {
  cat?: string;
  merchant?: string;
  q?: string;
  date?: string;
  dir?: 'in' | 'out';
}

export interface AppData {
  ctx: Ctx;
  prevCtx: Ctx | null;
  all: CTx[];
  recurring: Recurring[];
  fmt: (v: number, digits?: number) => string;
  currency: string;
  excluded: Set<string>;
  toggleExcluded: (cat: string) => void;
  overrides: Record<string, string>;
  setOverride: (key: string, cat: string | null) => void;
  /** Navigate to the Transactions page with a filter. */
  goTx: (f: TxFilter) => void;
  /** Show the transactions matching a filter in a modal (with a link to the full page). */
  peekTx: (f: TxFilter) => void;
  /** Show an arbitrary set of transactions in the modal. */
  openTxModal: (spec: TxModalSpec) => void;
  txFilter: TxFilter;
  setTxFilter: (f: TxFilter) => void;
  dataFrom: string;
  dataTo: string;
  setView: (v: ViewId) => void;
}

export function Card({ title, sub, actions, children, className = '', style }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-h">
          <div>
            {title && <h3 className="card-t">{title}</h3>}
            {sub && <div className="card-s">{sub}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function CatTag({ cat }: { cat: string }) {
  const c = CAT[cat];
  if (!c) return null;
  return (
    <span className="tag" style={{ color: c.color, borderColor: c.color + '44', background: c.color + '14' }}>
      <Icon name={c.icon} size={12} />
      <span className="tag-text">{c.name}</span>
    </span>
  );
}

export function CatIcon({ cat, size = 36 }: { cat: string; size?: number }) {
  const c = CAT[cat] ?? CAT.other;
  return (
    <div className="rank-ico" style={{ width: size, height: size, background: c.color + '1f', color: c.color }}>
      <Icon name={c.icon} size={Math.round(size * 0.47)} />
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([k, l]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function NoData({ text = 'Nu există date pentru perioada selectată.' }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

export const tooltipMoney = (fmt: (v: number) => string) => (v: unknown) => fmt(Number(v));

/** Viewport width, updated on resize (for chart options that must adapt to small screens). */
export function useViewportWidth(): number {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return w;
}
