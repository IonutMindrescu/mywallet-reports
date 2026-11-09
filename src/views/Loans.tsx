import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Landmark, Pencil, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '../components/EChart';
import { dateLabel, monthLabel, monthOf } from '../lib/analytics';
import { compact } from '../lib/format';
import { analyzeLoans, dtiZone, type Loan, LOAN_KINDS, type LoanKind, type LoanSettings } from '../lib/loans';
import { round } from './charts';
import { type AppData, Card, CatIcon, NoData, Seg } from './shared';

const KEY = 'mwr.loans.v1';
const PALETTE = ['#8b5cf6', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#fb923c', '#60a5fa', '#e879f9'];

export function loadLoanSettings(): { settings: Record<string, LoanSettings>; incomeMode: 'salary' | 'all' } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { settings: raw.settings ?? {}, incomeMode: raw.incomeMode ?? 'salary' };
  } catch {
    return { settings: {}, incomeMode: 'salary' };
  }
}
function saveLoanSettings(v: { settings: Record<string, LoanSettings>; incomeMode: 'salary' | 'all' }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

const STATUS: Record<Loan['status'], { label: string; color: string }> = {
  activ: { label: 'Activ', color: '#34d399' },
  nou: { label: 'Nou — fără rate încă', color: '#22d3ee' },
  inchis: { label: 'Închis', color: '#6b7299' },
};

function gaugeOption(v: number): EChartsOption {
  const zone = dtiZone(v);
  return {
    series: [
      {
        type: 'gauge', min: 0, max: 60, startAngle: 205, endAngle: -25, radius: '100%', center: ['50%', '62%'],
        axisLine: {
          lineStyle: {
            width: 16,
            color: [[0.5, '#34d399'], [40 / 60, '#fbbf24'], [45 / 60, '#fb923c'], [1, '#fb7185']],
          },
        },
        pointer: { length: '62%', width: 6, itemStyle: { color: '#e8ebff' } },
        anchor: { show: true, size: 14, itemStyle: { color: '#e8ebff', borderColor: '#06071a', borderWidth: 3 } },
        axisTick: { show: false },
        splitLine: { distance: -16, length: 16, lineStyle: { color: '#06071a', width: 3 } },
        splitNumber: 6,
        axisLabel: { distance: 22, color: '#6b7299', fontSize: 11, formatter: (x: number) => x + '%' },
        detail: {
          valueAnimation: true, offsetCenter: [0, '38%'], fontSize: 34, fontWeight: 700, fontFamily: 'Space Grotesk Variable',
          color: zone.color, formatter: (x: number) => x.toFixed(1).replace('.', ',') + '%',
        },
        title: { offsetCenter: [0, '68%'], color: '#a5adcb', fontSize: 13 },
        data: [{ value: Math.min(60, round(v * 100)), name: zone.label }],
      },
    ],
  };
}

export function Loans({ d }: { d: AppData }) {
  const { fmt } = d;
  const [state, setState] = useState(loadLoanSettings);
  const [editing, setEditing] = useState<string | null>(null);
  const update = (next: typeof state) => {
    setState(next);
    saveLoanSettings(next);
  };
  const setLoan = (key: string, patch: Partial<LoanSettings>) =>
    update({ ...state, settings: { ...state.settings, [key]: { ...state.settings[key], ...patch } } });

  const a = useMemo(() => analyzeLoans(d.all, state.settings, d.dataTo, state.incomeMode, d.excluded), [d.all, state.settings, d.dataTo, state.incomeMode, d.excluded, d.ctx]); // ctx changes with month mode
  const visible = a.loans.filter((l) => !state.settings[l.key]?.hidden);
  const hidden = a.loans.filter((l) => state.settings[l.key]?.hidden);
  const colorOf = (key: string) => PALETTE[a.loans.findIndex((l) => l.key === key) % PALETTE.length];

  // Months of the selected period
  const months = a.months.filter((m) => m >= monthOf(d.ctx.from) && m <= monthOf(d.ctx.to));
  const paidInPeriod = months.reduce((s, m) => s + (a.servicePerMonth[m] ?? 0), 0);
  const incomeSrc = state.incomeMode === 'salary' && Object.keys(a.salaryPerMonth).length ? a.salaryPerMonth : a.incomePerMonth;

  const chart = useMemo<EChartsOption>(() => {
    const withPay = visible.filter((l) => months.some((m) => (l.monthly[m] ?? 0) + (l.insurance[m] ?? 0) > 0));
    const hasGroup = months.some((m) => (a.groupInsurance[m] ?? 0) > 0);
    // Skip months with partial income (statement edges) — they'd show absurd ratios.
    const dti = months.map((m) => (incomeSrc[m] && incomeSrc[m] >= a.incomeBasis * 0.5 ? round(((a.servicePerMonth[m] ?? 0) / incomeSrc[m]) * 100) : null));
    return {
      grid: { left: 8, right: 8, top: 40, bottom: 4, containLabel: true },
      legend: { type: 'scroll', top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => (v == null ? '—' : String(v)),
        formatter: (ps) => {
          const arr = ps as unknown as { seriesName: string; value: number | null; marker: string; axisValue: string }[];
          const rows = arr
            .filter((p) => p.value)
            .map((p) => `${p.marker}${p.seriesName}: <b>${p.seriesName.startsWith('Grad') ? String(p.value).replace('.', ',') + '%' : fmt(Number(p.value))}</b>`);
          return `<b>${arr[0]?.axisValue}</b><br/>${rows.join('<br/>')}`;
        },
      },
      xAxis: { type: 'category', data: months.map((m) => monthLabel(m)) },
      yAxis: [
        { type: 'value', axisLabel: { formatter: (v: number) => compact(v) } },
        { type: 'value', min: 0, max: (x: { max: number }) => Math.max(50, Math.ceil(x.max / 10) * 10), axisLabel: { formatter: '{value}%' }, splitLine: { show: false } },
      ],
      series: [
        ...withPay.map((l) => ({
          name: l.name, type: 'bar' as const, stack: 'r', barMaxWidth: 42,
          itemStyle: { color: colorOf(l.key), borderRadius: 3 },
          data: months.map((m) => round((l.monthly[m] ?? 0) + (l.insurance[m] ?? 0))),
        })),
        ...(hasGroup
          ? [{ name: 'Asigurări credite (grup)', type: 'bar' as const, stack: 'r', barMaxWidth: 42, itemStyle: { color: '#475569', borderRadius: 3 }, data: months.map((m) => round(a.groupInsurance[m] ?? 0)) }]
          : []),
        {
          name: 'Grad de îndatorare', type: 'line' as const, yAxisIndex: 1, data: dti, smooth: true, connectNulls: true, symbol: 'circle', symbolSize: 8,
          lineStyle: { width: 3, color: '#fb7185' }, itemStyle: { color: '#fb7185', borderColor: '#06071a', borderWidth: 2 },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: '#fbbf24', type: 'dashed' }, label: { color: '#fbbf24', formatter: 'limită BNR 40%', position: 'insideEndTop' }, data: [{ yAxis: 40 }] },
        },
      ],
    };
  }, [visible, months, a, incomeSrc, fmt]);

  if (!a.loans.length && !a.events.length)
    return (
      <Card>
        <NoData text="Nu am găsit rate de credit în extras. Dacă plătești rate prin transfer către o firmă (IFN, leasing, BNPL), schimbă-i categoria în „Credite & rate” din ecranul Tranzacții sau Comercianți." />
      </Card>
    );

  const zone = a.dti != null ? dtiZone(a.dti) : null;
  const pending = visible.filter((l) => l.status === 'nou' && state.settings[l.key]?.manualRate == null);
  // Suggest the new loan's rate from loans it refinanced (paid off on the same day it was drawn).
  const suggestFor = (l: Loan) => {
    if (!l.drawdown) return 0;
    return a.loans.filter((x) => x.refinancedBy === l.key && x.status === 'inchis').reduce((s, x) => s + x.typicalRate + x.typicalInsurance, 0);
  };
  const candidates = d.recurring.filter((r) => r.cat !== 'loans' && r.cat !== 'insurance' && /credit|financ|leasing|ifn|twisto|tbi|mokka|paypo|rate|bank|heyblu|provident|credius|ferratum/i.test(r.name));

  return (
    <div className="stack">
      {pending.map((l) => {
        const sug = suggestFor(l);
        return (
          <div key={l.key} className="card fade-in" style={{ borderColor: 'rgba(34,211,238,.4)' }}>
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <div className="row" style={{ minWidth: 0 }}>
                <AlertTriangle size={20} color="var(--cyan)" />
                <div>
                  <b>{l.name}: credit nou de {fmt(l.drawdown?.amount ?? 0, 0)} tras pe {dateLabel(l.drawdown?.date ?? '')}</b>
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    {sug > 0
                      ? `A refinanțat ${a.loans.filter((x) => x.refinancedBy === l.key && x.status === 'inchis').length} credite, pe care le-am închis. Până la prima rată, gradul de îndatorare folosește o estimare: cât costau ele pe lună (~${fmt(sug, 0)} cu asigurări). Introdu rata din contract sau încarcă extrasul după prima rată.`
                      : 'Nu există încă nicio rată plătită, deci nu e inclus în gradul de îndatorare. Introdu rata lunară din contract.'}
                  </div>
                </div>
              </div>
              <RateInput onSave={(v) => setLoan(l.key, { manualRate: v })} fmt={fmt} />
            </div>
          </div>
        );
      })}

      <div className="grid g-12">
        <Card title="Gradul de îndatorare" sub={`Rate lunare + asigurările aferente, raportate la ${a.incomeLabel} (ultimele 3 luni complete)`}
          actions={<Seg value={state.incomeMode} options={[['salary', 'Salariu'], ['all', 'Toate veniturile']]} onChange={(v) => update({ ...state, incomeMode: v })} />}>
          {a.dti != null ? (
            <>
              <EChart option={gaugeOption(a.dti)} height={250} />
              <div className="row between" style={{ marginTop: 4 }}>
                <div>
                  <div className="faint" style={{ fontSize: 12 }}>Rate pe lună acum</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{fmt(a.currentService, 0)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="faint" style={{ fontSize: 12 }}>{a.incomeLabel}</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{fmt(a.incomeBasis, 0)}</div>
                </div>
              </div>
              <div className="insight-text" style={{ marginTop: 12, color: zone!.color }}>{zone!.text}</div>
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                Mai poți susține rate de încă ~<b style={{ color: 'var(--text)' }}>{fmt(Math.max(0, a.incomeBasis * 0.4 - a.currentService), 0)}</b>/lună până la limita BNR de 40%.
              </div>
            </>
          ) : (
            <NoData text="Nu am găsit venituri în perioada analizată pentru a calcula gradul de îndatorare." />
          )}
        </Card>
        <Card title="Rate plătite pe lună" sub="Pe fiecare credit (rată + asigurare) · linia roșie = gradul de îndatorare din luna respectivă">
          {months.length ? <EChart option={chart} height={340} /> : <NoData />}
          <div className="row wrap faint" style={{ fontSize: 12.5, marginTop: 10, gap: 16 }}>
            <span>În perioada selectată ai plătit <b style={{ color: 'var(--text)' }}>{fmt(paidInPeriod, 0)}</b> pentru credite</span>
            <span>· media <b style={{ color: 'var(--text)' }}>{fmt(paidInPeriod / Math.max(1, months.length), 0)}</b>/lună</span>
            <span>· proiecție pe an la ratele actuale: <b style={{ color: 'var(--pink)' }}>{fmt(a.currentService * 12, 0)}</b></span>
          </div>
        </Card>
      </div>

      <Card title={`Creditele tale (${visible.length})`} sub="Grupate după contul de credit din extras · poți redenumi fiecare credit și îi poți seta tipul">
        <div className="insights">
          {visible.map((l) => {
            const st = STATUS[l.status];
            const s = state.settings[l.key] ?? {};
            const color = colorOf(l.key);
            return (
              <div className="sub-card" key={l.key} style={{ opacity: l.status === 'inchis' ? 0.7 : 1, borderColor: color + '44' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="rank-ico" style={{ background: color + '22', color }}><Landmark size={18} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {editing === l.key ? (
                      <input className="input" autoFocus defaultValue={l.name} style={{ width: '100%', padding: '4px 8px' }}
                        onBlur={(e) => { setLoan(l.key, { name: e.target.value.trim() || undefined }); setEditing(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    ) : (
                      <div className="rank-name" style={{ cursor: 'pointer' }} onClick={() => setEditing(l.key)} title="Redenumește">
                        {l.name} <Pencil size={11} style={{ opacity: 0.5 }} />
                      </div>
                    )}
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <span className="tag" style={{ color: st.color, borderColor: st.color + '55', background: st.color + '14' }}>{st.label}</span>
                      <select className="cat-select" value={l.kind} onChange={(e) => setLoan(l.key, { kind: e.target.value as LoanKind })} style={{ color: 'var(--text-2)' }}>
                        {LOAN_KINDS.map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="icon-btn" title="Ascunde (nu e un credit)" onClick={() => setLoan(l.key, { hidden: true })}><EyeOff size={15} /></button>
                </div>
                <div className="row between">
                  <div>
                    <div className="faint" style={{ fontSize: 11 }}>{l.status === 'inchis' ? 'Ultima rată' : l.estimated ? 'Rată estimată' : 'Rata lunară'}</div>
                    <div className="sub-amount num" style={{ color: l.status === 'inchis' ? 'var(--text-3)' : 'var(--text)' }}>
                      {fmt(l.status === 'inchis' ? l.typicalRate : s.manualRate ?? (l.estimated ? l.currentRate : l.typicalRate))}
                    </div>
                    {l.typicalInsurance > 0 && <div className="faint" style={{ fontSize: 11 }}>+ {fmt(l.typicalInsurance)} asigurare</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="faint" style={{ fontSize: 11 }}>Plătit în extras</div>
                    <div className="num" style={{ fontWeight: 700 }}>{fmt(l.totalPaid, 0)}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{Object.keys(l.monthly).length} luni</div>
                  </div>
                </div>
                <div className="faint" style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {l.drawdown && <span><ArrowDownLeft size={12} style={{ verticalAlign: -2 }} color="var(--green)" /> Tras {fmt(l.drawdown.amount, 0)} pe {dateLabel(l.drawdown.date)}</span>}
                  {l.payoff && <span><ArrowUpRight size={12} style={{ verticalAlign: -2 }} color="var(--violet-2)" /> Rambursat anticipat {fmt(l.payoff.amount, 0)} pe {dateLabel(l.payoff.date)}{l.status !== 'inchis' && !l.refinancedBy && l.lastDate && l.lastDate < l.payoff.date ? ' — dacă rata s-a schimbat, introdu rata nouă mai jos' : ''}</span>}
                  {l.refinancedBy && (
                    <span style={{ color: 'var(--cyan)' }}>
                      Refinanțat prin {a.loans.find((x) => x.key === l.refinancedBy)?.name ?? 'un credit nou'} — achitat integral
                    </span>
                  )}
                  {l.fees > 0 && <span><Receipt size={12} style={{ verticalAlign: -2 }} /> Comisioane: {fmt(l.fees, 0)}</span>}
                  {l.firstDate && <span>Rate în extras: {dateLabel(l.firstDate, false)} → {dateLabel(l.lastDate!, false)}</span>}
                </div>
                <div className="row wrap" style={{ gap: 6, fontSize: 12, justifyContent: 'space-between' }}>
                  {l.status !== 'inchis' ? (
                    <span className="row" style={{ gap: 6 }}>
                      <span className="faint">Rată manuală:</span>
                      <RateInput small value={s.manualRate} onSave={(v) => setLoan(l.key, { manualRate: v })} fmt={fmt} />
                    </span>
                  ) : <span />}
                  <button className="btn ghost sm" onClick={() => setLoan(l.key, { closed: l.status !== 'inchis' })}>
                    {l.status === 'inchis' ? 'Redeschide' : 'Marchează închis'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {hidden.length > 0 && (
          <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
            <span className="faint" style={{ fontSize: 12 }}>Ascunse:</span>
            {hidden.map((l) => (
              <button key={l.key} className="chip" onClick={() => setLoan(l.key, { hidden: false })}><Eye size={11} style={{ verticalAlign: -1 }} /> {l.name}</button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid g-2">
        <Card title="Evenimente credite" sub="Trageri, rambursări anticipate și comisioane">
          {a.events.length ? (
            <div className="rank">
              {a.events.map((e, i) => {
                const loan = a.loans.find((l) => l.key === e.loanKey);
                const color = e.type === 'drawdown' ? 'var(--green)' : e.type === 'payoff' ? 'var(--violet-2)' : 'var(--text-3)';
                return (
                  <div className="rank-item" key={i} style={{ cursor: 'default' }}>
                    <div className="rank-ico" style={{ background: 'rgba(148,163,255,.08)', color }}>
                      {e.type === 'drawdown' ? <ArrowDownLeft size={17} /> : e.type === 'payoff' ? <ArrowUpRight size={17} /> : <Receipt size={17} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="rank-name">{e.label}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{dateLabel(e.date)}{loan ? ` · ${loan.name}` : ''}</div>
                    </div>
                    <div className="rank-val"><b style={{ color: e.type === 'drawdown' ? 'var(--green)' : undefined }}>{e.type === 'drawdown' ? '+' : '−'}{fmt(e.amount, 0)}</b></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <NoData text="Fără trageri sau rambursări anticipate în perioada din extras." />
          )}
        </Card>
        <Card title="Plăți care ar putea fi rate" sub="Plăți lunare recurente la firme de creditare / BNPL, încă necategorisite drept credit">
          {candidates.length ? (
            <div className="rank">
              {candidates.map((r) => (
                <div className="rank-item" key={r.key} style={{ cursor: 'default' }}>
                  <CatIcon cat={r.cat} />
                  <div style={{ minWidth: 0 }}>
                    <div className="rank-name">{r.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>~{fmt(r.avg, 0)}/lună · {r.months} luni</div>
                  </div>
                  <button className="btn sm" onClick={() => d.setOverride(r.key, 'loans')}>E o rată</button>
                </div>
              ))}
            </div>
          ) : (
            <NoData text="Nicio altă plată recurentă nu pare a fi o rată. Poți marca orice comerciant drept „Credite & rate” din ecranul Comercianți." />
          )}
        </Card>
      </div>
      <div className="faint" style={{ fontSize: 12, padding: '0 4px' }}>
        Gradul de îndatorare = totalul ratelor lunare (inclusiv asigurările legate de credite) / venitul net lunar. BNR limitează gradul de îndatorare la 40% pentru credite noi
        (45% pentru prima locuință în lei). Calculul folosește doar ce apare în acest extras — rate plătite din alte conturi nu sunt incluse.
      </div>
    </div>
  );
}

function RateInput({ onSave, suggestion, value, fmt, small }: { onSave: (v: number | undefined) => void; suggestion?: number; value?: number; fmt: (v: number, d?: number) => string; small?: boolean }) {
  const [v, setV] = useState(value != null ? String(value) : '');
  const commit = () => {
    const num = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    onSave(Number.isFinite(num) && num > 0 ? num : undefined);
  };
  return (
    <div className="row" style={{ gap: 6 }}>
      <input className="input" inputMode="decimal" placeholder={suggestion ? `ex. ${Math.round(suggestion)}` : 'lei/lună'} value={v}
        onChange={(e) => setV(e.target.value)} onBlur={small ? commit : undefined} onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={{ width: small ? 110 : 140, padding: small ? '4px 8px' : undefined }} />
      {!small && <button className="btn sm" onClick={commit}>Salvează</button>}
      {!small && suggestion ? <button className="btn ghost sm" onClick={() => { setV(String(Math.round(suggestion))); onSave(Math.round(suggestion)); }}>Folosește ~{fmt(suggestion, 0)}</button> : null}
    </div>
  );
}
