import { echartsGraphic, type EChartsOption } from '../components/EChart';
import { isoOf, balanceSeries, byMonth, dailyFlow, daysBetween, dateLabel, monthLabel, type Ctx } from '../lib/analytics';
import { compact } from '../lib/format';
import type { CTx } from '../lib/types';

export const grad = (top: string, bottom: string) =>
  new echartsGraphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: top },
    { offset: 1, color: bottom },
  ]);

export const axisMoney = { axisLabel: { formatter: (v: number) => compact(v) } };

export function cashflowOption(c: Ctx, fmt: (v: number) => string): EChartsOption {
  const monthly = daysBetween(c.from, c.to) > 62;
  let labels: string[], inc: number[], out: number[], net: number[] | null = null;
  if (monthly) {
    const ms = byMonth(c);
    labels = ms.map((m) => monthLabel(m.month));
    inc = ms.map((m) => round(m.income));
    out = ms.map((m) => round(m.spend));
    net = ms.map((m) => round(m.net));
  } else {
    const ds = dailyFlow(c);
    labels = ds.map((d) => dateLabel(d.day, false));
    inc = ds.map((d) => round(d.income));
    out = ds.map((d) => round(d.spend));
  }
  return {
    grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
    legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, data: ['Venituri', 'Cheltuieli', ...(net ? ['Net'] : [])] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(139,92,246,0.08)' } }, valueFormatter: (v) => fmt(Number(v)) },
    xAxis: { type: 'category', data: labels, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', ...axisMoney },
    series: [
      { name: 'Venituri', type: 'bar', data: inc, barMaxWidth: 22, barGap: '20%', itemStyle: { borderRadius: [6, 6, 2, 2], color: grad('#34d399', 'rgba(52,211,153,0.25)') } },
      { name: 'Cheltuieli', type: 'bar', data: out, barMaxWidth: 22, itemStyle: { borderRadius: [6, 6, 2, 2], color: grad('#a78bfa', 'rgba(139,92,246,0.25)') } },
      ...(net
        ? [{
            name: 'Net', type: 'line' as const, data: net, smooth: true, symbol: 'circle', symbolSize: 7,
            lineStyle: { width: 2.5, color: '#22d3ee' }, itemStyle: { color: '#22d3ee', borderColor: '#06071a', borderWidth: 2 },
          }]
        : []),
    ],
  };
}

export function balanceOption(all: CTx[], from: string, to: string, fmt: (v: number) => string): EChartsOption | null {
  const pts = balanceSeries(all, from, to);
  if (pts.length < 2) return null;
  return {
    grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmt(Number(v)) },
    xAxis: { type: 'time', axisLabel: { hideOverlap: true, formatter: (v: number) => dateLabel(isoOf(new Date(v)), false) } },
    yAxis: { type: 'value', scale: true, ...axisMoney },
    series: [
      {
        name: 'Sold', type: 'line', data: pts, smooth: 0.3, showSymbol: false, step: false,
        lineStyle: { width: 2.5, color: new echartsGraphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#22d3ee' }]) },
        areaStyle: { color: grad('rgba(139,92,246,0.35)', 'rgba(34,211,238,0)') },
        markPoint: {
          symbol: 'circle', symbolSize: 9,
          label: { show: true, position: 'top', color: '#e8ebff', fontSize: 11, formatter: (p) => compact(Number((p as { value: number }).value)) },
          data: [
            { type: 'max', name: 'Max', itemStyle: { color: '#34d399' } },
            { type: 'min', name: 'Min', itemStyle: { color: '#fb7185' } },
          ],
        },
      },
    ],
  };
}

export const round = (v: number) => Math.round(v * 100) / 100;
