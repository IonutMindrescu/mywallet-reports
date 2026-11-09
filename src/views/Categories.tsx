import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '../components/EChart';
import { byCategory, byMonth, monthLabel, monthOf, type CatAgg } from '../lib/analytics';
import { CAT, CATEGORIES } from '../lib/categories';
import { compact, pct } from '../lib/format';
import { axisMoney, round } from './charts';
import { type AppData, Card, CatIcon, NoData, Seg } from './shared';

type Mode = 'sunburst' | 'treemap' | 'bars';
type Trend = 'stack' | 'percent' | 'lines';

export function Categories({ d }: { d: AppData }) {
  const { ctx, fmt } = d;
  const [mode, setMode] = useState<Mode>('sunburst');
  const [dir, setDir] = useState<'out' | 'in'>('out');
  const [trend, setTrend] = useState<Trend>('stack');
  const [sel, setSel] = useState<string | null>(null);

  const list = dir === 'out' ? ctx.spend : ctx.income;
  const cats = useMemo(() => byCategory(list), [list]);
  const prevCats = useMemo(() => (d.prevCtx ? byCategory(dir === 'out' ? d.prevCtx.spend : d.prevCtx.income) : []), [d.prevCtx, dir]);
  const months = useMemo(() => byMonth(ctx), [ctx]);
  const selected = cats.find((c) => c.cat === sel) ?? null;

  const main = useMemo<EChartsOption>(() => {
    const children = (c: CatAgg) => {
      const top = c.merchants.slice(0, 12);
      const rest = c.merchants.slice(12).reduce((s, m) => s + m.total, 0);
      return [
        ...top.map((m) => ({ name: m.name, value: round(m.total), id: 'm:' + m.key })),
        ...(rest > 0 ? [{ name: 'Alții', value: round(rest), id: 'rest:' + c.cat }] : []),
      ];
    };
    const tree = cats.map((c) => ({
      name: CAT[c.cat]?.name ?? c.cat,
      id: c.cat,
      value: round(c.total),
      itemStyle: { color: CAT[c.cat]?.color },
      children: children(c),
    }));
    if (mode === 'sunburst') {
      return {
        tooltip: { valueFormatter: (v) => fmt(Number(v)) },
        series: [{
          type: 'sunburst', data: tree, radius: ['18%', '96%'], sort: undefined,
          itemStyle: { borderColor: 'rgba(6,7,26,0.9)', borderWidth: 2, borderRadius: 6 },
          emphasis: { focus: 'ancestor' },
          levels: [
            {},
            { r0: '18%', r: '58%', label: { rotate: 'tangential', fontSize: 11, color: '#fff', minAngle: 14, overflow: 'truncate', width: 80 } },
            { r0: '59%', r: '96%', itemStyle: { opacity: 0.72 }, label: { position: 'outside', fontSize: 10, color: '#a5adcb', minAngle: 6, show: true, silent: false, overflow: 'truncate', width: 90 } },
          ],
          label: { color: '#fff' },
        }],
      };
    }
    if (mode === 'treemap') {
      return {
        tooltip: { valueFormatter: (v) => fmt(Number(v)) },
        series: [{
          type: 'treemap', data: tree, roam: false, nodeClick: 'zoomToNode', width: '100%', height: '92%', top: 0,
          breadcrumb: { show: true, bottom: 0, itemStyle: { color: 'rgba(20,23,52,0.9)', borderColor: 'rgba(167,139,250,0.3)', textStyle: { color: '#e8ebff' } } },
          upperLabel: { show: true, height: 26, color: '#fff', fontWeight: 600, formatter: (p) => `${p.name}  ${compact(Number(p.value))}` },
          label: { formatter: (p) => `${p.name}\n${compact(Number(p.value))}`, fontSize: 11 },
          itemStyle: { borderColor: 'rgba(6,7,26,0.9)', borderWidth: 2, gapWidth: 2, borderRadius: 6 },
          levels: [
            { itemStyle: { borderWidth: 0, gapWidth: 4 } },
            { itemStyle: { gapWidth: 2, borderColorSaturation: 0.4 }, colorSaturation: [0.35, 0.6] },
          ],
        }],
      };
    }
    const top = cats.slice(0, 15).reverse();
    return {
      grid: { left: 8, right: 70, top: 4, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => fmt(Number(v)) },
      xAxis: { type: 'value', ...axisMoney },
      yAxis: { type: 'category', data: top.map((c) => CAT[c.cat]?.name ?? c.cat), axisLabel: { color: '#e8ebff' } },
      series: [{
        type: 'bar', barMaxWidth: 18,
        data: top.map((c) => ({ value: round(c.total), id: c.cat, itemStyle: { color: CAT[c.cat]?.color, borderRadius: [0, 8, 8, 0] } })),
        label: { show: true, position: 'right', color: '#a5adcb', formatter: (p) => compact(Number(p.value)) },
      }],
    };
  }, [cats, mode, fmt]);

  const trendOpt = useMemo<EChartsOption>(() => {
    const ids = (selected ? [selected.cat] : cats.slice(0, 9).map((c) => c.cat));
    const percent = trend === 'percent';
    const lines = trend === 'lines';
    const series = ids.map((id) => ({
      name: CAT[id]?.name ?? id,
      type: (lines ? 'line' : 'bar') as 'line' | 'bar',
      stack: lines ? undefined : 'a',
      smooth: true,
      barMaxWidth: 34,
      symbolSize: 6,
      itemStyle: { color: CAT[id]?.color },
      lineStyle: { width: 2.5 },
      emphasis: { focus: 'series' as const },
      data: months.map((m) => {
        const v = dir === 'out' ? m.byCat[id] ?? 0 : ctx.income.filter((t) => t.cat === id && monthOf(t.date) === m.month).reduce((s, t) => s + t.amount, 0);
        const total = dir === 'out' ? m.spend : m.income;
        return percent ? (total ? round((v / total) * 100) : 0) : round(v);
      }),
    }));
    return {
      grid: { left: 8, right: 8, top: 40, bottom: 4, containLabel: true },
      legend: { type: 'scroll', top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => (percent ? `${v}%` : fmt(Number(v))) },
      xAxis: { type: 'category', data: months.map((m) => monthLabel(m.month)) },
      yAxis: { type: 'value', max: percent ? 100 : undefined, axisLabel: { formatter: (v: number) => (percent ? v + '%' : compact(v)) } },
      series,
    };
  }, [cats, months, trend, selected, fmt, dir, ctx.income]);

  if (!ctx.all.length) return <NoData />;
  const total = cats.reduce((s, c) => s + c.total, 0);
  const excludedCats = CATEGORIES.filter((c) => d.excluded.has(c.id));

  return (
    <div className="stack">
      <div className="row between wrap">
        <Seg value={dir} options={[['out', 'Cheltuieli'], ['in', 'Venituri']]} onChange={(v) => { setDir(v); setSel(null); }} />
        <span className="faint" style={{ fontSize: 12.5 }}>
          Total {dir === 'out' ? 'cheltuieli' : 'venituri'}: <b className="num" style={{ color: 'var(--text)' }}>{fmt(total)}</b> în {list.length} tranzacții
        </span>
      </div>

      <div className="grid g-21">
        <Card
          title={dir === 'out' ? 'Harta cheltuielilor' : 'Harta veniturilor'}
          sub={mode === 'treemap' ? 'Click pe o categorie pentru zoom' : 'Categorii → comercianți'}
          actions={<Seg value={mode} options={[['sunburst', 'Sunburst'], ['treemap', 'Treemap'], ['bars', 'Bare']]} onChange={setMode} />}
        >
          {cats.length ? (
            <EChart
              option={main}
              height={480}
              onClick={(p) => {
                const id = (p.data as { id?: string })?.id;
                if (id && CAT[id]) setSel(id === sel ? null : id);
                else if (id?.startsWith('m:')) d.goTx({ merchant: id.slice(2) });
              }}
            />
          ) : (
            <NoData />
          )}
        </Card>
        <Card title="Categorii" sub="Click pentru detalii · ochiul exclude categoria din totaluri">
          <div className="rank" style={{ maxHeight: 486, overflowY: 'auto', marginRight: -8, paddingRight: 4 }}>
            {cats.map((c) => {
              const prev = prevCats.find((p) => p.cat === c.cat)?.total;
              const ch = prev ? (c.total - prev) / prev : null;
              return (
                <div key={c.cat} className={`rank-item ${sel === c.cat ? 'on' : ''}`} onClick={() => setSel(sel === c.cat ? null : c.cat)}>
                  <CatIcon cat={c.cat} />
                  <div style={{ minWidth: 0 }}>
                    <div className="rank-name">{CAT[c.cat]?.name}</div>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="rank-bar" style={{ flex: 1 }}><i style={{ width: `${c.share * 100}%`, background: CAT[c.cat]?.color }} /></div>
                      <span className="faint" style={{ fontSize: 11, marginTop: 6 }}>{pct(c.share, 1)}</span>
                    </div>
                  </div>
                  <div className="rank-val">
                    <b>{fmt(c.total, 0)}</b>
                    <div>
                      {c.count} tranz.
                      {ch != null && Math.abs(ch) >= 0.05 && (
                        <span style={{ color: (dir === 'out' ? ch > 0 : ch < 0) ? 'var(--red)' : 'var(--green)', marginLeft: 4 }}>
                          {ch > 0 ? '▲' : '▼'}{pct(Math.abs(ch))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {excludedCats.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div className="faint" style={{ fontSize: 11.5, marginBottom: 8 }}>Excluse din totaluri (mutări între conturile tale):</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {excludedCats.map((c) => (
                  <button key={c.id} className="chip" onClick={() => d.toggleExcluded(c.id)} title="Include în totaluri">
                    <EyeOff size={11} style={{ verticalAlign: -1 }} /> {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {selected && (
        <Card
          className="fade-in"
          title={<span className="row"><CatIcon cat={selected.cat} size={30} /> {CAT[selected.cat]?.name}</span>}
          sub={`${fmt(selected.total)} · ${selected.count} tranzacții · medie ${fmt(selected.total / selected.count)}`}
          actions={
            <div className="row">
              <button className="btn ghost sm" onClick={() => d.toggleExcluded(selected.cat)}>
                {d.excluded.has(selected.cat) ? <Eye size={13} /> : <EyeOff size={13} />}
                {d.excluded.has(selected.cat) ? 'Include în totaluri' : 'Exclude din totaluri'}
              </button>
              <button className="btn sm" onClick={() => d.goTx({ cat: selected.cat })}>Vezi tranzacțiile</button>
            </div>
          }
        >
          <div className="grid g-3">
            {selected.merchants.slice(0, 9).map((m) => (
              <div className="rank-item" key={m.key} onClick={() => d.goTx({ merchant: m.key })} style={{ background: 'rgba(14,16,40,.5)' }}>
                <CatIcon cat={selected.cat} size={32} />
                <div style={{ minWidth: 0 }}>
                  <div className="rank-name">{m.name}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{m.count}× · {pct(m.total / selected.total)}</div>
                </div>
                <div className="rank-val"><b>{fmt(m.total, 0)}</b></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {months.length > 1 && (
        <Card
          title={selected ? `Evoluție lunară — ${CAT[selected.cat]?.name}` : 'Evoluție lunară pe categorii'}
          sub={selected ? 'Click din nou pe categorie pentru a vedea toate' : 'Top 9 categorii'}
          actions={<Seg value={trend} options={[['stack', 'Stivuit'], ['percent', '100%'], ['lines', 'Linii']]} onChange={setTrend} />}
        >
          <EChart option={trendOpt} height={340} />
        </Card>
      )}
    </div>
  );
}
