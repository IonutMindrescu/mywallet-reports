import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

const C = {
  text: '#a5adcb',
  textStrong: '#e8ebff',
  grid: 'rgba(148,163,255,0.08)',
  axis: 'rgba(148,163,255,0.18)',
  tooltipBg: 'rgba(14,16,34,0.92)',
};

echarts.registerTheme('aurora', {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Inter Variable, Inter, system-ui, sans-serif', color: C.text },
  title: { textStyle: { color: C.textStrong } },
  legend: { textStyle: { color: C.text }, pageTextStyle: { color: C.text }, pageIconColor: '#a78bfa', pageIconInactiveColor: '#3b3f63' },
  tooltip: {
    backgroundColor: C.tooltipBg,
    borderColor: 'rgba(167,139,250,0.35)',
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { color: C.textStrong, fontSize: 12 },
    extraCssText: 'backdrop-filter: blur(12px); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.45);',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: C.axis } },
    axisTick: { show: false },
    axisLabel: { color: C.text },
    splitLine: { show: false, lineStyle: { color: C.grid } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: C.text },
    splitLine: { lineStyle: { color: C.grid } },
  },
  timeAxis: {
    axisLine: { lineStyle: { color: C.axis } },
    axisLabel: { color: C.text },
    splitLine: { show: false },
  },
});

export type EChartsOption = echarts.EChartsOption;

interface Props {
  option: EChartsOption;
  height?: number | string;
  onClick?: (p: echarts.ECElementEvent) => void;
  className?: string;
}

export function EChart({ option, height = 320, onClick, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!ref.current) return;
    const inst = echarts.init(ref.current, 'aurora', { renderer: 'canvas' });
    chart.current = inst;
    inst.on('click', (p) => clickRef.current?.(p as echarts.ECElementEvent));
    const ro = new ResizeObserver(() => inst.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      inst.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption({ animationDuration: 700, animationEasing: 'cubicOut', ...option }, { notMerge: true });
  }, [option]);

  return <div ref={ref} className={className} style={{ width: '100%', height }} />;
}

export const echartsGraphic = echarts.graphic;
