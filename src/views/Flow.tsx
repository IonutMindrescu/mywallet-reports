import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '../components/EChart';
import { byCategory, totals } from '../lib/analytics';
import { CAT } from '../lib/categories';
import { pct } from '../lib/format';
import { round } from './charts';
import { KpiRow } from './Overview';
import { type AppData, Card, NoData, Seg, useViewportWidth } from './shared';
import type { TxModalSpec } from './TxModal';

const BUD = 'Bugetul tău';

export function Flow({ d }: { d: AppData }) {
  const { ctx, fmt } = d;
  const [detail, setDetail] = useState<'cats' | 'merchants'>('cats');
  const vw = useViewportWidth();
  const narrow = vw < 700;

  const { option, targets } = useMemo(() => {
    // Node name -> transactions behind it (for the click-through modal)
    const targets = new Map<string, TxModalSpec>();
    const inc = byCategory(ctx.income);
    const out = byCategory(ctx.spend);
    const T = totals(ctx);
    const nodes: { name: string; itemStyle: { color: string }; depth?: number; cursor?: string; label?: { show: boolean } }[] = [];
    const links: { source: string; target: string; value: number }[] = [];
    const add = (name: string, color: string, depth: number) => {
      if (!nodes.find((n) => n.name === name)) nodes.push({ name, itemStyle: { color }, depth });
    };
    add(BUD, '#8b5cf6', 1);
    for (const c of inc) {
      const n = CAT[c.cat]?.name ?? c.cat;
      add(n, CAT[c.cat]?.color ?? '#34d399', 0);
      links.push({ source: n, target: BUD, value: round(c.total) });
      targets.set(n, { title: n, cat: c.cat, dir: 'in', txs: ctx.income.filter((t) => t.cat === c.cat), filter: { cat: c.cat, dir: 'in' } });
    }
    if (T.net < 0) {
      add('Din economii / sold', '#fb7185', 0);
      links.push({ source: 'Din economii / sold', target: BUD, value: round(-T.net) });
    }
    const MAX = 12;
    const main = out.slice(0, MAX);
    const rest = out.slice(MAX);
    for (const c of main) {
      const n = CAT[c.cat]?.name ?? c.cat;
      add(n, CAT[c.cat]?.color ?? '#a78bfa', 2);
      links.push({ source: BUD, target: n, value: round(c.total) });
      const catSpec: TxModalSpec = { title: n, cat: c.cat, dir: 'out', txs: ctx.spend.filter((t) => t.cat === c.cat), filter: { cat: c.cat, dir: 'out' } };
      targets.set(n, catSpec);
      if (detail === 'merchants') {
        const ms = c.merchants.slice(0, 3);
        let other = c.total;
        for (const m of ms) {
          const mn = `${m.name} `;
          add(mn, CAT[c.cat]?.color ?? '#a78bfa', 3);
          links.push({ source: n, target: mn, value: round(m.total) });
          if (!targets.has(mn)) {
            targets.set(mn, { title: m.name, cat: c.cat, dir: 'out', txs: catSpec.txs.filter((t) => t.mkey === m.key), filter: { cat: c.cat, merchant: m.key, dir: 'out' } });
          }
          other -= m.total;
        }
        if (other > 1 && c.merchants.length > 3) {
          const on = `Alții · ${n}`;
          add(on, '#475569', 3);
          links.push({ source: n, target: on, value: round(other) });
          targets.set(on, catSpec);
        }
      }
    }
    if (rest.length) {
      add('Alte categorii', '#64748b', 2);
      links.push({ source: BUD, target: 'Alte categorii', value: round(rest.reduce((s, c) => s + c.total, 0)) });
      const restCats = new Set(rest.map((c) => c.cat));
      targets.set('Alte categorii', { title: 'Alte categorii', cat: 'other', dir: 'out', groupBy: 'cat', txs: ctx.spend.filter((t) => restCats.has(t.cat)) });
    }
    if (T.net > 0) {
      add('Economisit', '#22d3ee', 2);
      links.push({ source: BUD, target: 'Economisit', value: round(T.net) });
    }
    for (const nd of nodes) if (!targets.has(nd.name)) nd.cursor = 'default';
    if (narrow) {
      // On phones only the last column has room for labels; the others show on hover.
      const maxDepth = Math.max(...nodes.map((nd) => nd.depth ?? 0));
      for (const nd of nodes) if ((nd.depth ?? 0) < maxDepth) nd.label = { show: false };
    }
    const option: EChartsOption = {
      tooltip: { trigger: 'item', valueFormatter: (v) => fmt(Number(v)) },
      series: [{
        type: 'sankey', data: nodes, links, left: 8, right: narrow ? 118 : detail === 'merchants' ? 200 : 230, top: 10, bottom: 10, nodeWidth: narrow ? 10 : 14, nodeGap: narrow ? 16 : 14,
        layoutIterations: 64, nodeAlign: 'justify', draggable: true,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.32 },
        itemStyle: { borderRadius: 4, borderWidth: 0 },
        label: narrow
          ? { color: '#e8ebff', fontSize: 10, width: 108, overflow: 'truncate', formatter: (p) => p.name.trim() }
          : { color: '#e8ebff', fontSize: 11, width: (detail === 'merchants' ? 200 : 230) - 14, overflow: 'truncate', formatter: (p) => `${p.name.trim()}  {v|${fmt(Number(p.value), 0)}}`, rich: { v: { color: '#a5adcb', fontSize: 11 } } },
      }],
    };
    return { option, targets };
  }, [ctx, fmt, detail, narrow]);

  const onChartClick = (p: { dataType?: string; name?: string; data?: unknown }) => {
    let name = p.name;
    if (p.dataType === 'edge') {
      const e = p.data as { source: string; target: string };
      name = e.target === BUD ? e.source : e.target;
    }
    const spec = name != null ? targets.get(name) : undefined;
    if (spec) d.openTxModal(spec);
  };

  if (!ctx.txs.length) return <NoData />;
  const T = totals(ctx);
  const out = byCategory(ctx.spend);
  const needs = ['groceries', 'utilities', 'telecom', 'health', 'transport', 'fuel', 'insurance', 'loans', 'taxes', 'fees', 'rent', 'kids', 'education'];
  const needsT = out.filter((c) => needs.includes(c.cat)).reduce((s, c) => s + c.total, 0);
  const wantsT = T.spend - needsT;
  const rule = T.income > 0
    ? [
        { k: 'Nevoi', v: needsT / T.income, target: 0.5, color: '#22d3ee', s: 'alimente, utilități, transport, sănătate, rate, chirie…' },
        { k: 'Dorințe', v: wantsT / T.income, target: 0.3, color: '#f472b6', s: 'restaurante, shopping, distracție, călătorii…' },
        { k: 'Economii', v: Math.max(0, T.net) / T.income, target: 0.2, color: '#34d399', s: 'ce rămâne din venituri' },
      ]
    : [];

  return (
    <div className="stack">
      <KpiRow d={d} />
      <Card title="Fluxul banilor" sub="Din ce surse vin banii și pe ce categorii pleacă · click pe un flux ca să vezi tranzacțiile · poți trage nodurile"
        actions={<Seg value={detail} options={[['cats', 'Categorii'], ['merchants', '+ comercianți']]} onChange={setDetail} />}>
        <EChart option={option} height={detail === 'merchants' ? 820 : 560} onClick={onChartClick} />
      </Card>
      {rule.length > 0 && (
        <Card title="Regula 50 / 30 / 20" sub="Cum se compară bugetul tău cu un reper popular de bugetare (procent din venituri)">
          <div className="grid g-3">
            {rule.map((r) => (
              <div key={r.k} className="sub-card">
                <div className="row between">
                  <b>{r.k}</b>
                  <span className="faint">țintă {pct(r.target)}</span>
                </div>
                <div className="sub-amount num" style={{ color: r.color }}>{pct(r.v)}</div>
                <div className="rank-bar" style={{ height: 8, position: 'relative' }}>
                  <i style={{ width: `${Math.min(100, r.v * 100)}%`, background: r.color }} />
                  <span style={{ position: 'absolute', left: `${r.target * 100}%`, top: -3, width: 2, height: 14, background: '#fff', opacity: 0.6 }} />
                </div>
                <div className="faint" style={{ fontSize: 12 }}>{r.s}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
