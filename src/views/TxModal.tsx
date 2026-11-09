import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dateLabel, toDate } from '../lib/analytics';
import { CAT } from '../lib/categories';
import type { CTx } from '../lib/types';
import { type AppData, CatIcon, type TxFilter } from './shared';

/** What the modal shows: a set of transactions plus how to open the same set on the Transactions page. */
export interface TxModalSpec {
  title: string;
  /** Overrides the default subtitle (the selected period). */
  sub?: string;
  /** Category used for the icon / accent colour. */
  cat: string;
  txs: CTx[];
  dir?: 'in' | 'out';
  /** Filter for the full Transactions page; omitted when no single filter matches this set. */
  filter?: TxFilter;
  /** Breakdown shown above the list; defaults to merchants. */
  groupBy?: 'cat' | 'merchant';
}

/** Same matching rules as the Transactions page (search text aside). */
export function txMatches(f: TxFilter) {
  return (t: CTx) =>
    (!f.cat || t.cat === f.cat) &&
    (!f.merchant || t.mkey === f.merchant) &&
    (!f.date || t.date === f.date) &&
    (!f.dir || (f.dir === 'in' ? t.amount > 0 : t.amount < 0));
}

/** Category with the most money in the set (icon for sets that are not a single category). */
function topCat(txs: CTx[]): string {
  const m = new Map<string, number>();
  for (const t of txs) m.set(t.cat, (m.get(t.cat) ?? 0) + Math.abs(t.amount));
  let best = 'other';
  let max = -1;
  for (const [c, v] of m) if (v > max) [best, max] = [c, v];
  return best;
}

/** Builds a modal for a Transactions-page filter, over the transactions of the selected period. */
export function specFromFilter(f: TxFilter, list: CTx[]): TxModalSpec {
  const txs = list.filter(txMatches(f));
  const dir = f.dir ?? (txs.every((t) => t.amount < 0) ? 'out' : txs.every((t) => t.amount > 0) ? 'in' : undefined);
  const catName = f.cat ? CAT[f.cat]?.name ?? f.cat : undefined;
  const merchant = f.merchant ? txs[0]?.merchant ?? f.merchant : undefined;
  const day = f.date ? dateLabel(f.date) : undefined;
  const title = merchant ?? catName ?? (day ? `${f.dir === 'out' ? 'Cheltuieli' : f.dir === 'in' ? 'Încasări' : 'Tranzacții'} · ${day}` : 'Tranzacții');
  const weekday = f.date ? toDate(f.date).toLocaleDateString('ro-RO', { weekday: 'long' }) : undefined;
  const sub = merchant ? [catName, day].filter(Boolean).join(' · ') : weekday && weekday[0].toUpperCase() + weekday.slice(1);
  return {
    title,
    sub: sub || undefined,
    cat: f.cat ?? topCat(txs),
    txs,
    dir,
    filter: f,
  };
}

interface Group {
  key: string;
  name: string;
  cat: string;
  total: number;
  count: number;
}

const PAGE = 100;

function groupsOf(spec: TxModalSpec): Group[] {
  const by = spec.groupBy ?? 'merchant';
  const m = new Map<string, Group>();
  for (const t of spec.txs) {
    const key = by === 'cat' ? t.cat : t.mkey;
    let g = m.get(key);
    if (!g) m.set(key, (g = { key, name: by === 'cat' ? CAT[t.cat]?.name ?? t.cat : t.merchant, cat: t.cat, total: 0, count: 0 }));
    g.total += Math.abs(t.amount);
    g.count++;
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

function drill(spec: TxModalSpec, g: Group): TxModalSpec {
  const byCat = (spec.groupBy ?? 'merchant') === 'cat';
  const base: TxFilter = spec.filter ?? (spec.dir ? { dir: spec.dir } : {});
  return {
    title: g.name,
    sub: spec.title,
    cat: byCat ? g.key : g.cat,
    dir: spec.dir,
    txs: spec.txs.filter((t) => (byCat ? t.cat : t.mkey) === g.key),
    filter: byCat ? { ...base, cat: g.key } : { ...base, merchant: g.key },
  };
}

export function TxModal({ d, spec, onClose }: { d: AppData; spec: TxModalSpec; onClose: () => void }) {
  const { fmt, ctx } = d;
  const [stack, setStack] = useState<TxModalSpec[]>([spec]);
  const [limit, setLimit] = useState(PAGE);
  const panel = useRef<HTMLDivElement>(null);
  const cur = stack[stack.length - 1];
  const color = CAT[cur.cat]?.color ?? '#a78bfa';
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  const list = useMemo(() => [...cur.txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.seq - a.seq)), [cur]);
  const groups = useMemo(() => groupsOf(cur), [cur]);
  const net = cur.txs.reduce((s, t) => s + t.amount, 0);
  const avg = cur.txs.length ? cur.txs.reduce((s, t) => s + Math.abs(t.amount), 0) / cur.txs.length : 0;
  const showGroups = groups.length > 1;
  const top = groups.slice(0, 6);
  const sub = [cur.sub, cur.filter?.date ? null : `${dateLabel(ctx.from)} – ${dateLabel(ctx.to)}`].filter(Boolean).join(' · ');

  const push = (next: TxModalSpec) => {
    setStack((s) => [...s, next]);
    setLimit(PAGE);
    panel.current?.scrollTo?.({ top: 0 });
  };
  const back = () => {
    setStack((s) => s.slice(0, -1));
    setLimit(PAGE);
  };
  const openFull = () => {
    if (!cur.filter) return;
    onClose();
    d.goTx(cur.filter);
  };

  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tx-modal-title" tabIndex={-1} ref={panel}
        style={{ '--accent': color } as React.CSSProperties}>
        <div className="modal-h">
          {stack.length > 1 && (
            <button className="icon-btn" onClick={back} title="Înapoi" aria-label="Înapoi"><ArrowLeft size={17} /></button>
          )}
          <CatIcon cat={cur.cat} size={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 id="tx-modal-title" className="modal-t">{cur.title}</h3>
            <div className="card-s">{sub}</div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Închide (Esc)" aria-label="Închide"><X size={18} /></button>
        </div>

        <div className="modal-stats">
          <div>
            <span className="faint">Total</span>
            <b className="num" style={{ color: net > 0 ? 'var(--green)' : color }}>{net > 0 ? '+' : ''}{fmt(net)}</b>
          </div>
          <div>
            <span className="faint">Tranzacții</span>
            <b className="num">{cur.txs.length}</b>
          </div>
          <div>
            <span className="faint">Medie</span>
            <b className="num">{fmt(avg)}</b>
          </div>
        </div>

        <div className="modal-body">
          {showGroups && (
            <div className="modal-groups">
              <div className="modal-label">{(cur.groupBy ?? 'merchant') === 'cat' ? 'Pe categorii' : 'Pe comercianți'}</div>
              {top.map((g) => (
                <div key={g.key} className="rank-item" onClick={() => push(drill(cur, g))} title="Vezi doar aceste tranzacții">
                  <CatIcon cat={g.cat} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div className="row between" style={{ gap: 8 }}>
                      <span className="tx-merchant ellipsis">{g.name}</span>
                      <span className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{g.count} tranz.</span>
                    </div>
                    <div className="rank-bar"><i style={{ width: `${(g.total / groups[0].total) * 100}%`, background: CAT[g.cat]?.color ?? color }} /></div>
                  </div>
                  <span className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(g.total)}</span>
                </div>
              ))}
              {groups.length > top.length && (
                <div className="faint" style={{ fontSize: 12, padding: '4px 10px' }}>
                  + încă {groups.length - top.length} {(cur.groupBy ?? 'merchant') === 'cat' ? 'categorii' : 'comercianți'} în lista de mai jos
                </div>
              )}
            </div>
          )}

          <div className="modal-label">Tranzacții</div>
          <div className="modal-list">
            {list.slice(0, limit).map((t) => (
              <div key={t.id} className="modal-row">
                <span className="faint num" style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{dateLabel(t.date)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="tx-merchant ellipsis">{t.merchant}</div>
                  <div className="tx-type ellipsis">{(cur.groupBy === 'cat' ? `${CAT[t.cat]?.name ?? t.cat} · ` : '') + t.type}</div>
                </div>
                <span className={`num ${t.amount > 0 ? 'pos' : ''}`} style={{ fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {t.amount > 0 ? '+' : ''}{fmt(t.amount)}
                </span>
              </div>
            ))}
            {list.length > limit && (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <button className="btn ghost sm" onClick={() => setLimit(limit + 300)}>Arată mai multe ({list.length - limit} rămase)</button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-f">
          {cur.filter ? (
            <span className="faint" style={{ fontSize: 12 }}>Căutare, export și recategorisire în pagina completă</span>
          ) : (
            <span className="faint" style={{ fontSize: 12 }}>Alege o categorie de mai sus ca s-o deschizi în Tranzacții</span>
          )}
          <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
            <button className="btn ghost sm" onClick={onClose}>Închide</button>
            {cur.filter && (
              <button className="btn sm" onClick={openFull}>Vezi toate în Tranzacții <ArrowRight size={14} /></button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
