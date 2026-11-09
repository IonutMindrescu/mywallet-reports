import { CalendarClock, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { EChart, type EChartsOption } from '../components/EChart';
import { dateLabel, monthLabel, monthOf } from '../lib/analytics';
import { CAT } from '../lib/categories';
import { pct } from '../lib/format';
import { grad, round } from './charts';
import { type AppData, Card, CatIcon, CatTag, NoData } from './shared';

function Spark({ data, color }: { data: number[]; color: string }) {
  const opt = useMemo<EChartsOption>(
    () => ({
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
      yAxis: { type: 'value', show: false, scale: true },
      series: [{ type: 'line', data: data.map(round), smooth: true, showSymbol: false, lineStyle: { width: 2, color }, areaStyle: { color: grad(color + '55', color + '00') } }],
      animation: false,
    }),
    [data, color],
  );
  return <EChart option={opt} height={42} />;
}

export function RecurringView({ d }: { d: AppData }) {
  const { fmt, recurring } = d;
  const monthly = recurring.reduce((s, r) => s + r.avg, 0);
  const subs = recurring.filter((r) => r.cat === 'subscriptions');

  const byCatOpt = useMemo<EChartsOption>(() => {
    const m = new Map<string, number>();
    for (const r of recurring) m.set(r.cat, (m.get(r.cat) ?? 0) + r.avg);
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return {
      tooltip: { trigger: 'item', valueFormatter: (v) => fmt(Number(v)) + '/lună' },
      legend: { type: 'scroll', bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['50%', '78%'], center: ['50%', '44%'], padAngle: 2, itemStyle: { borderRadius: 8 },
        label: { show: false },
        data: arr.map(([c, v]) => ({ name: CAT[c]?.name ?? c, value: round(v), itemStyle: { color: CAT[c]?.color } })),
      }],
    };
  }, [recurring, fmt]);

  const timeline = useMemo<EChartsOption>(() => {
    const months = [...new Set(recurring.flatMap((r) => r.history.map((h) => monthOf(h.date))))].sort();
    const top = recurring.slice(0, 10);
    return {
      grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
      legend: { type: 'scroll', top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => fmt(Number(v)) },
      xAxis: { type: 'category', data: months.map((m) => monthLabel(m)) },
      yAxis: { type: 'value' },
      series: top.map((r, i) => ({
        name: r.name, type: 'bar', stack: 'r', barMaxWidth: 34,
        itemStyle: { color: i < 9 ? undefined : '#64748b', borderRadius: 2 },
        data: months.map((m) => round(r.history.filter((h) => monthOf(h.date) === m).reduce((s, h) => s + h.amount, 0))),
      })),
      color: ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#60a5fa', '#a3e635', '#e879f9', '#94a3b8'],
    };
  }, [recurring, fmt]);

  if (!recurring.length)
    return (
      <Card>
        <NoData text="Nu am găsit plăți recurente. Pentru detecție am nevoie de cel puțin 2–3 luni de date, în care aceeași plată apare lunar." />
      </Card>
    );

  return (
    <div className="stack">
      <div className="kpis">
        <div className="card kpi"><div className="kpi-label">Plăți recurente detectate</div><div className="kpi-value num">{recurring.length}</div><div className="kpi-foot">{subs.length} abonamente digitale</div></div>
        <div className="card kpi"><div className="kpi-label">Cost lunar</div><div className="kpi-value num">{fmt(monthly, 0)}</div><div className="kpi-foot">media ultimelor plăți</div></div>
        <div className="card kpi"><div className="kpi-label">Cost anual estimat</div><div className="kpi-value num" style={{ color: 'var(--pink)' }}>{fmt(monthly * 12, 0)}</div><div className="kpi-foot">dacă nu renunți la nimic</div></div>
        <div className="card kpi"><div className="kpi-label">Doar abonamente</div><div className="kpi-value num">{fmt(subs.reduce((s, r) => s + r.annual, 0), 0)}</div><div className="kpi-foot">pe an · {fmt(subs.reduce((s, r) => s + r.avg, 0), 0)}/lună</div></div>
      </div>

      <div className="grid g-12">
        <Card title="Pe categorii" sub="Cost lunar recurent">
          <EChart option={byCatOpt} height={280} />
        </Card>
        <Card title="Istoric lunar" sub="Top 10 plăți recurente">
          <EChart option={timeline} height={280} />
        </Card>
      </div>

      <Card title="Toate plățile recurente" sub="Ordonate după costul anual · click pentru tranzacții">
        <div className="insights">
          {recurring.map((r) => (
            <div className="sub-card" key={r.key} style={{ cursor: 'pointer' }} onClick={() => d.peekTx({ merchant: r.key })}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <CatIcon cat={r.cat} size={38} />
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                  <div className="rank-name" title={r.name} style={{ maxWidth: '100%' }}>{r.name}</div>
                  <CatTag cat={r.cat} />
                </div>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span className="sub-amount num">{fmt(r.last)}</span>
                <span className="faint" style={{ fontSize: 12 }}> pe lună</span>
              </div>
              <Spark data={r.history.map((h) => h.amount)} color={CAT[r.cat]?.color ?? '#8b5cf6'} />
              <div className="row between faint" style={{ fontSize: 11.5, flexWrap: 'wrap', rowGap: 4 }}>
                <span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> următoarea ~{dateLabel(r.nextDate, false)}</span>
                <span>{r.months} luni · <b style={{ color: 'var(--text)' }}>{fmt(r.annual, 0)}/an</b></span>
              </div>
              {Math.abs(r.priceChange) >= 0.05 && (
                <div className="row" style={{ fontSize: 11.5, alignItems: 'flex-start', color: r.priceChange > 0 ? 'var(--red)' : 'var(--green)' }}>
                  <TrendingUp size={13} /> Prețul s-a {r.priceChange > 0 ? 'mărit' : 'micșorat'} cu {pct(Math.abs(r.priceChange))} față de prima plată ({fmt(r.first)})
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
