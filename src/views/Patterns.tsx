import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '../components/EChart';
import {
  byCategory, cumulativeByMonth, dailySpend, dateLabel, dayOfMonthPattern, monthLabel, calendarMonthsInRange, monthOf, monthStart, daysBetween, toDate, weekdayPattern, WEEKDAYS,
  WEEKDAYS_SHORT,
} from '../lib/analytics';
import { CAT } from '../lib/categories';
import { monthMode } from '../lib/months';
import { compact } from '../lib/format';
import { axisMoney, grad, round } from './charts';
import { type AppData, Card, NoData, Seg } from './shared';

const BUCKETS: [number, number, string][] = [
  [0, 25, '< 25'], [25, 50, '25–50'], [50, 100, '50–100'], [100, 250, '100–250'], [250, 500, '250–500'], [500, 1000, '500–1k'], [1000, 3000, '1k–3k'], [3000, Infinity, '3k+'],
];

export function Patterns({ d }: { d: AppData }) {
  const { ctx, fmt } = d;
  const [histMode, setHistMode] = useState<'count' | 'sum'>('sum');

  const calendar = useMemo<EChartsOption>(() => {
    const m = dailySpend(ctx);
    const data = [...m.entries()].map(([k, v]) => [k, round(v)]);
    const vals = data.map((x) => x[1] as number).sort((a, b) => a - b);
    const p90 = vals[Math.floor(vals.length * 0.9)] ?? 100;
    const months = calendarMonthsInRange(ctx.from, ctx.to);
    // Split into balanced rows of at most 7 months so cells stay large
    const rowsN = Math.ceil(months.length / 7);
    const per = Math.ceil(months.length / rowsN);
    const chunks: string[][] = [];
    for (let i = 0; i < months.length; i += per) chunks.push(months.slice(i, i + per));
    return {
      tooltip: { formatter: (p) => { const v = (p as unknown as { data: [string, number] }).data; return `${dateLabel(v[0])}<br/><b>${fmt(v[1])}</b>`; } },
      visualMap: {
        min: 0, max: Math.max(50, p90), calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 160,
        inRange: { color: ['#1e1b4b', '#5b21b6', '#a855f7', '#f472b6', '#fb923c'] }, textStyle: { color: '#a5adcb' },
        formatter: (v) => compact(Number(v)),
      },
      calendar: chunks.map((ch, i) => {
        const last = ch[ch.length - 1];
        const end = new Date(+last.slice(0, 4), +last.slice(5, 7), 0);
        return {
          top: 30 + i * 175, left: 40, right: 16, cellSize: ['auto', 18],
          range: [ch[0] + '-01', `${last}-${end.getDate()}`],
          itemStyle: { color: 'rgba(20,23,52,0.6)', borderColor: 'rgba(6,7,26,1)', borderWidth: 3 },
          splitLine: { show: false },
          dayLabel: { firstDay: 1, nameMap: WEEKDAYS_SHORT.slice(6).concat(WEEKDAYS_SHORT.slice(0, 6)), color: '#6b7299', fontSize: 10 },
          monthLabel: { nameMap: ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'], color: '#a5adcb' },
          yearLabel: { show: false },
        };
      }),
      series: chunks.map((_, i) => ({ type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: i, data, itemStyle: { borderRadius: 4 } })),
    } as EChartsOption;
  }, [ctx, fmt]);
  const calHeight = 30 + Math.ceil(calendarMonthsInRange(ctx.from, ctx.to).length / 7) * 175 + 40;

  const weekday = useMemo<EChartsOption>(() => {
    const wp = weekdayPattern(ctx);
    return {
      grid: { left: 8, right: 8, top: 20, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', formatter: (p) => { const x = (p as { dataIndex: number }[])[0]; const w = wp[x.dataIndex]; return `<b>${WEEKDAYS[x.dataIndex]}</b><br/>Medie/zi: <b>${fmt(w.avg)}</b><br/>${w.count} tranzacții · total ${fmt(w.total)}`; } },
      xAxis: { type: 'category', data: WEEKDAYS.map((w) => w.slice(0, 3)) },
      yAxis: { type: 'value', ...axisMoney },
      series: [{
        type: 'bar', barMaxWidth: 40,
        data: wp.map((w, i) => ({ value: round(w.avg), itemStyle: { borderRadius: [8, 8, 3, 3], color: i >= 5 ? grad('#f472b6', 'rgba(244,114,182,0.2)') : grad('#8b5cf6', 'rgba(139,92,246,0.2)') } })),
        label: { show: true, position: 'top', color: '#a5adcb', fontSize: 11, formatter: (p) => compact(Number(p.value)) },
      }],
    };
  }, [ctx, fmt]);

  const dom = useMemo<EChartsOption>(() => {
    const arr = dayOfMonthPattern(ctx);
    return {
      grid: { left: 8, right: 8, top: 20, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v) => fmt(Number(v)) },
      xAxis: { type: 'category', data: arr.map((_, i) => String(i + 1)), axisLabel: { interval: 2 } },
      yAxis: { type: 'value', ...axisMoney },
      series: [{ type: 'bar', data: arr.map(round), barMaxWidth: 14, itemStyle: { borderRadius: [5, 5, 2, 2], color: grad('#22d3ee', 'rgba(34,211,238,0.15)') } }],
    };
  }, [ctx, fmt]);

  const cumul = useMemo<EChartsOption | null>(() => {
    const res = cumulativeByMonth(ctx);
    const months = Object.keys(res);
    if (months.length < 2) return null;
    const lastM = months[months.length - 1];
    const lastDay = lastM === monthOf(ctx.to) ? daysBetween(monthStart(lastM), ctx.to) : 31;
    const others = months.slice(0, -1);
    const avg = Array(31).fill(0).map((_, i) => others.reduce((s, m) => s + res[m][i], 0) / others.length);
    return {
      grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
      legend: { top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 4, data: [monthLabel(lastM, true), 'Media lunilor anterioare'] },
      tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '—' : fmt(Number(v))) },
      xAxis: { type: 'category', data: Array.from({ length: 31 }, (_, i) => String(i + 1)), boundaryGap: false },
      yAxis: { type: 'value', ...axisMoney },
      series: [
        ...others.map((m) => ({ name: monthLabel(m), type: 'line' as const, data: res[m].map(round), showSymbol: false, smooth: true, lineStyle: { width: 1, color: 'rgba(148,163,255,0.18)' }, silent: true, tooltip: { show: false } })),
        { name: 'Media lunilor anterioare', type: 'line', data: avg.map(round), showSymbol: false, smooth: true, lineStyle: { width: 2, type: 'dashed', color: '#a5adcb' }, itemStyle: { color: '#a5adcb' } },
        { name: monthLabel(lastM, true), type: 'line', data: res[lastM].map((v, i) => (i < lastDay ? round(v) : null)), showSymbol: false, smooth: true, lineStyle: { width: 3, color: '#f472b6' }, itemStyle: { color: '#f472b6' }, areaStyle: { color: grad('rgba(244,114,182,0.3)', 'rgba(244,114,182,0)') } },
      ],
    };
  }, [ctx, fmt]);

  const hist = useMemo<EChartsOption>(() => {
    const counts = BUCKETS.map(() => 0);
    const sums = BUCKETS.map(() => 0);
    for (const t of ctx.spend) {
      const v = -t.amount;
      const i = BUCKETS.findIndex(([a, b]) => v >= a && v < b);
      counts[i]++;
      sums[i] += v;
    }
    const isSum = histMode === 'sum';
    return {
      grid: { left: 8, right: 8, top: 20, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', formatter: (p) => { const i = (p as { dataIndex: number }[])[0].dataIndex; return `<b>${BUCKETS[i][2]} lei</b><br/>${counts[i]} tranzacții<br/>Total: <b>${fmt(sums[i])}</b>`; } },
      xAxis: { type: 'category', data: BUCKETS.map((b) => b[2]) },
      yAxis: { type: 'value', ...(isSum ? axisMoney : {}) },
      series: [{
        type: 'bar', barMaxWidth: 46, data: (isSum ? sums : counts).map(round),
        itemStyle: { borderRadius: [8, 8, 3, 3], color: grad('#fbbf24', 'rgba(251,191,36,0.15)') },
        label: { show: true, position: 'top', color: '#a5adcb', fontSize: 11, formatter: (p) => (isSum ? compact(Number(p.value)) : String(p.value)) },
      }],
    };
  }, [ctx, fmt, histMode]);

  const matrix = useMemo<EChartsOption>(() => {
    const cats = byCategory(ctx.spend).slice(0, 10).map((c) => c.cat);
    const data: [number, number, number][] = [];
    let max = 0;
    cats.forEach((cat, y) => {
      const arr = Array(7).fill(0);
      for (const t of ctx.spend) if (t.cat === cat) arr[(toDate(t.date).getDay() + 6) % 7] -= t.amount;
      arr.forEach((v, x) => data.push([x, y, round(v)]));
    });
    const nz = data.map((x) => x[2]).filter((v) => v > 0).sort((a, b) => a - b);
    max = nz[Math.floor(nz.length * 0.85)] ?? 1;
    return {
      grid: { left: 8, right: 8, top: 8, bottom: 50, containLabel: true },
      tooltip: { formatter: (p) => { const v = (p as { data: number[] }).data; return `${CAT[cats[v[1]]]?.name} · ${WEEKDAYS[v[0]]}<br/><b>${fmt(v[2])}</b>`; } },
      xAxis: { type: 'category', data: WEEKDAYS.map((w) => w.slice(0, 3)), splitArea: { show: false } },
      yAxis: { type: 'category', inverse: true, data: cats.map((c) => CAT[c]?.name ?? c), axisLabel: { color: '#e8ebff', fontSize: 11 } },
      visualMap: { min: 0, max: Math.max(1, max), show: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 10, inRange: { color: ['#141734', '#4c1d95', '#7c3aed', '#c026d3', '#f472b6'] }, textStyle: { color: '#a5adcb' }, formatter: (v) => compact(Number(v)) },
      series: [{ type: 'heatmap', data, itemStyle: { borderColor: 'rgba(6,7,26,1)', borderWidth: 3, borderRadius: 6 }, label: { show: true, color: '#e8ebff', fontSize: 10, formatter: (p) => { const v = (p.data as number[])[2]; return v ? compact(v) : ''; } } }],
    };
  }, [ctx, fmt]);

  if (!ctx.spend.length) return <NoData />;

  return (
    <div className="stack">
      <Card title="Calendarul cheltuielilor" sub="Fiecare pătrățel e o zi · culoarea = cât ai cheltuit. Click pe o zi pentru tranzacții">
        <EChart option={calendar} height={calHeight} onClick={(p) => d.goTx({ date: (p.data as [string])[0], dir: 'out' })} />
      </Card>
      <div className="grid g-2">
        <Card title="Ziua săptămânii" sub="Cheltuiala medie pe zi · weekend-ul e evidențiat cu roz">
          <EChart option={weekday} height={280} />
        </Card>
        <Card title="Ziua din lună" sub="Când pleacă banii în cursul lunii (cumulat pe perioada selectată)">
          <EChart option={dom} height={280} />
        </Card>
      </div>
      <div className="grid g-2">
        {cumul && (
          <Card title="Ritmul lunar" sub={monthMode() === 'salary' ? 'Cheltuieli cumulate pe zilele ciclului salarial (ziua 1 = ziua salariului) vs. media ciclurilor anterioare' : 'Cheltuieli cumulate în ultima lună vs. media lunilor anterioare'}>
            <EChart option={cumul} height={300} />
          </Card>
        )}
        <Card title="Mărimea tranzacțiilor" sub="Distribuția plăților pe intervale de valoare" actions={<Seg value={histMode} options={[['sum', 'Sumă'], ['count', 'Număr']]} onChange={setHistMode} />}>
          <EChart option={hist} height={300} />
        </Card>
      </div>
      <Card title="Categorii × zile ale săptămânii" sub="Ce cumperi în ce zi — top 10 categorii">
        <EChart option={matrix} height={420} />
      </Card>
    </div>
  );
}
