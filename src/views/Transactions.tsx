import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { dateLabel } from '../lib/analytics';
import { CAT, CATEGORIES } from '../lib/categories';
import { stripDiacritics } from '../lib/parser';
import type { CTx } from '../lib/types';
import { type AppData, Card, CatIcon, NoData } from './shared';
import { txMatches } from './TxModal';

export function CategorySelect({ value, onChange, overridden }: { value: string; onChange: (c: string | null) => void; overridden?: boolean }) {
  const c = CAT[value];
  const groups: [string, string][] = [['expense', 'Cheltuieli'], ['income', 'Venituri'], ['transfer', 'Transferuri']];
  return (
    <select
      className="cat-select"
      value={value}
      style={{ color: c?.color, background: (c?.color ?? '#888') + '14', borderColor: overridden ? (c?.color ?? '#888') + '88' : undefined }}
      title={overridden ? 'Categorie setată manual' : 'Categorie automată — click pentru a schimba'}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value === '__auto' ? null : e.target.value)}
    >
      {overridden && <option value="__auto">↺ Revino la automat</option>}
      {groups.map(([k, l]) => (
        <optgroup key={k} label={l}>
          {CATEGORIES.filter((x) => x.kind === k).map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

type SortKey = 'date' | 'amount' | 'merchant';

function exportCsv(list: CTx[]) {
  const head = ['Data', 'Data inregistrare', 'Comerciant', 'Categorie', 'Tip', 'Suma', 'Sold', 'Moneda', 'Detalii'];
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = list.map((t) => [t.date, t.bookDate, t.merchant, CAT[t.cat]?.name ?? t.cat, t.type, t.amount.toFixed(2), t.balance?.toFixed(2) ?? '', t.currency, t.details.join(' | ')].map((x) => esc(String(x))).join(','));
  const blob = new Blob(['﻿' + [head.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tranzactii-categorisite.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function Transactions({ d }: { d: AppData }) {
  const { ctx, fmt, txFilter: f, setTxFilter } = d;
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: 'date', asc: false });
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(150);
  const [showExcluded, setShowExcluded] = useState(true);

  const list = useMemo(() => {
    const nq = f.q ? stripDiacritics(f.q.toLowerCase()) : '';
    const match = txMatches(f);
    let l = (showExcluded ? ctx.all : ctx.txs).filter(
      (t) => match(t) && (!nq || stripDiacritics([t.merchant, t.type, ...t.details, CAT[t.cat]?.name ?? ''].join(' ').toLowerCase()).includes(nq)),
    );
    const dir = sort.asc ? 1 : -1;
    l = [...l].sort((a, b) => {
      if (sort.k === 'amount') return (a.amount - b.amount) * dir;
      if (sort.k === 'merchant') return a.merchant.localeCompare(b.merchant, 'ro') * dir;
      return (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq) * dir;
    });
    return l;
  }, [ctx, f, sort, showExcluded]);

  const sumIn = list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const sumOut = list.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const merchantName = f.merchant ? d.all.find((t) => t.mkey === f.merchant)?.merchant : null;
  const th = (k: SortKey, label: string, right = false) => (
    <th style={{ textAlign: right ? 'right' : 'left' }} onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : k === 'merchant' }))}>
      {label} {sort.k === k ? (sort.asc ? '↑' : '↓') : ''}
    </th>
  );
  const chip = (label: string, clear: () => void) => (
    <button className="chip on" onClick={clear}>
      {label} <X size={11} style={{ verticalAlign: -1 }} />
    </button>
  );

  return (
    <Card
      title={`${list.length} tranzacții`}
      sub={
        <span>
          <span className="pos">+{fmt(sumIn)}</span> · <span>−{fmt(sumOut)}</span> · net <b>{fmt(sumIn - sumOut)}</b>
        </span>
      }
      actions={
        <div className="row wrap">
          <div className="search">
            <Search size={15} />
            <input className="input" placeholder="Caută în comercianți, detalii…" value={f.q ?? ''} onChange={(e) => setTxFilter({ ...f, q: e.target.value })} />
          </div>
          <select className="select" value={f.cat ?? ''} onChange={(e) => setTxFilter({ ...f, cat: e.target.value || undefined })}>
            <option value="">Toate categoriile</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="select" value={f.dir ?? ''} onChange={(e) => setTxFilter({ ...f, dir: (e.target.value || undefined) as 'in' | 'out' | undefined })}>
            <option value="">Intrări + ieșiri</option>
            <option value="out">Doar cheltuieli</option>
            <option value="in">Doar încasări</option>
          </select>
          <button className="btn ghost sm" onClick={() => exportCsv(list)} title="Descarcă lista filtrată ca CSV (generat local)">
            <Download size={14} /> Export
          </button>
        </div>
      }
    >
      <div className="row wrap" style={{ marginBottom: 12, gap: 6 }}>
        {f.cat && chip(CAT[f.cat]?.name ?? f.cat, () => setTxFilter({ ...f, cat: undefined }))}
        {f.merchant && chip(merchantName ?? f.merchant, () => setTxFilter({ ...f, merchant: undefined }))}
        {f.date && chip(dateLabel(f.date), () => setTxFilter({ ...f, date: undefined }))}
        {(f.cat || f.merchant || f.date || f.q || f.dir) && (
          <button className="chip" onClick={() => setTxFilter({})}>Resetează filtrele</button>
        )}
        <label className="faint row" style={{ marginLeft: 'auto', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} /> arată și transferurile excluse
        </label>
      </div>
      {!list.length ? (
        <NoData text="Nicio tranzacție nu corespunde filtrelor." />
      ) : (
        <div className="table-wrap" style={{ maxHeight: '70vh' }}>
          <table className="tx">
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                {th('date', 'Data')}
                {th('merchant', 'Comerciant / Detalii')}
                <th>Categorie</th>
                {th('amount', 'Sumă', true)}
                <th style={{ textAlign: 'right' }}>Sold</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((t) => {
                const isOpen = open === t.id;
                const excluded = d.excluded.has(t.cat);
                return (
                  <Fragment key={t.id}>
                    <tr className={isOpen ? 'open' : ''} onClick={() => setOpen(isOpen ? null : t.id)} style={{ cursor: 'pointer', opacity: excluded ? 0.55 : 1 }}>
                      <td className="faint">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{dateLabel(t.date)}</td>
                      <td>
                        <div className="row">
                          <CatIcon cat={t.cat} size={30} />
                          <div style={{ minWidth: 0 }}>
                            <div className="tx-merchant">{t.merchant}</div>
                            <div className="tx-type">{t.type}{excluded ? ' · exclus din totaluri' : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <CategorySelect value={t.cat} overridden={!!(d.overrides[t.mkey] || d.overrides['tx:' + t.id])} onChange={(c) => {
                          if (c == null) { d.setOverride('tx:' + t.id, null); d.setOverride(t.mkey, null); }
                          else d.setOverride(t.mkey, c);
                        }} />
                      </td>
                      <td className={`num ${t.amount > 0 ? 'pos' : ''}`} style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {t.amount > 0 ? '+' : ''}{fmt(t.amount)}
                      </td>
                      <td className="num faint" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{t.balance != null ? fmt(t.balance) : ''}</td>
                    </tr>
                    {isOpen && (
                      <tr className="open">
                        <td />
                        <td colSpan={5}>
                          <div className="tx-details">
                            <div><span className="faint">Tip:</span> {t.type}</div>
                            <div><span className="faint">Înregistrată:</span> {dateLabel(t.bookDate)}</div>
                            {t.details.map((x, i) => <div key={i}>{x}</div>)}
                          </div>
                          <div className="row wrap" style={{ marginTop: 10, gap: 8, fontSize: 12 }}>
                            <span className="faint">Categorie doar pentru această tranzacție:</span>
                            <CategorySelect value={t.cat} overridden={!!d.overrides['tx:' + t.id]} onChange={(c) => d.setOverride('tx:' + t.id, c)} />
                            <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTxFilter({ merchant: t.mkey }); }}>Toate de la {t.merchant}</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {list.length > limit && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <button className="btn ghost" onClick={() => setLimit(limit + 300)}>Arată mai multe ({list.length - limit} rămase)</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
