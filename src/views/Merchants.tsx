import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '../components/EChart';
import { byMerchant, dateLabel } from '../lib/analytics';
import { CAT } from '../lib/categories';
import { compact } from '../lib/format';
import { stripDiacritics } from '../lib/parser';
import { CategorySelect } from './Transactions';
import { type AppData, Card, CatIcon, NoData, Seg } from './shared';

type Sort = 'total' | 'count' | 'avg';

export function Merchants({ d }: { d: AppData }) {
  const { ctx, fmt } = d;
  const [sort, setSort] = useState<Sort>('total');
  const [q, setQ] = useState('');
  const merchants = useMemo(() => byMerchant(ctx.spend), [ctx]);

  const bubble = useMemo<EChartsOption>(() => {
    const top = merchants.slice(0, 60);
    const maxT = Math.max(1, ...top.map((m) => m.total));
    const cats = [...new Set(top.map((m) => m.cat))];
    return {
      grid: { left: 8, right: 24, top: 40, bottom: 30, containLabel: true },
      legend: { type: 'scroll', top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, data: cats.map((c) => CAT[c]?.name ?? c) },
      tooltip: {
        formatter: (p) => {
          const v = (p as { data: { value: number[]; name: string } }).data;
          return `<b>${v.name}</b><br/>${v.value[0]} tranzacții · medie ${fmt(v.value[1])}<br/>Total: <b>${fmt(v.value[2])}</b>`;
        },
      },
      xAxis: { type: 'log', name: 'frecvență (nr. tranzacții)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: '#6b7299' }, splitLine: { lineStyle: { color: 'rgba(148,163,255,0.06)' } }, axisLabel: { color: '#a5adcb' }, min: 1 },
      yAxis: { type: 'log', name: 'valoare medie', nameTextStyle: { color: '#6b7299' }, axisLabel: { formatter: (v: number) => compact(v) } },
      series: cats.map((c) => ({
        name: CAT[c]?.name ?? c,
        type: 'scatter',
        itemStyle: { color: CAT[c]?.color, opacity: 0.8, borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1, shadowBlur: 14, shadowColor: CAT[c]?.color },
        emphasis: { focus: 'series', label: { show: true, formatter: (p: { data: { name: string } }) => p.data.name, position: 'top', color: '#fff' } },
        label: { show: true, formatter: (p: { data: { name: string; value: number[] } }) => (p.data.value[2] > maxT * 0.18 ? p.data.name : ''), position: 'top', color: '#e8ebff', fontSize: 11 },
        symbolSize: (v: number[]) => 10 + Math.sqrt(v[2] / maxT) * 52,
        data: top.filter((m) => m.cat === c).map((m) => ({ name: m.name, key: m.key, value: [m.count, Math.round(m.avg * 100) / 100, Math.round(m.total)] })),
      })) as EChartsOption['series'],
    };
  }, [merchants, fmt]);

  const filtered = useMemo(() => {
    const nq = stripDiacritics(q.toLowerCase());
    const list = nq ? merchants.filter((m) => stripDiacritics(m.name.toLowerCase()).includes(nq)) : merchants;
    return [...list].sort((a, b) => b[sort] - a[sort]);
  }, [merchants, q, sort]);

  if (!ctx.spend.length) return <NoData />;

  return (
    <div className="stack">
      <Card title="Harta comercianților" sub="Cât de des cumperi vs. cât de mult cheltuiești pe tranzacție · mărimea = total">
        <EChart option={bubble} height={440} onClick={(p) => d.peekTx({ merchant: (p.data as { key: string }).key })} />
      </Card>
      <Card
        title={`Toți comercianții (${merchants.length})`}
        sub="Schimbă categoria unui comerciant — se aplică tuturor tranzacțiilor lui"
        actions={
          <div className="row wrap">
            <div className="search">
              <Search size={15} />
              <input className="input" placeholder="Caută comerciant…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Seg value={sort} options={[['total', 'Total'], ['count', 'Frecvență'], ['avg', 'Medie']]} onChange={setSort} />
          </div>
        }
      >
        <div className="table-wrap" style={{ maxHeight: 620 }}>
          <table className="tx">
            <thead>
              <tr>
                <th>#</th>
                <th>Comerciant</th>
                <th>Categorie</th>
                <th style={{ textAlign: 'right' }}>Tranzacții</th>
                <th style={{ textAlign: 'right' }}>Medie</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Prima / ultima</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((m, i) => (
                <tr key={m.key}>
                  <td className="faint">{i + 1}</td>
                  <td>
                    <div className="row" style={{ cursor: 'pointer' }} onClick={() => d.peekTx({ merchant: m.key })}>
                      <CatIcon cat={m.cat} size={30} />
                      <span className="tx-merchant">{m.name}</span>
                    </div>
                  </td>
                  <td>
                    <CategorySelect value={m.cat} overridden={!!d.overrides[m.key]} onChange={(c) => d.setOverride(m.key, c)} />
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>{m.count}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{fmt(m.avg)}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(m.total)}</td>
                  <td className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{dateLabel(m.first, false)} → {dateLabel(m.last, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
