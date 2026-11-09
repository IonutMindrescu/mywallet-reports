import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, CalendarClock, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '../components/EChart';
import { Icon } from '../components/Icon';
import { buildInsights, byCategory, byMerchant, dateLabel, selfTransferCandidates, totals, type Ctx } from '../lib/analytics';
import { CAT } from '../lib/categories';
import { pct } from '../lib/format';
import { analyzeLoans, dtiZone } from '../lib/loans';
import { loadLoanSettings } from './Loans';
import { balanceOption, cashflowOption } from './charts';
import { type AppData, Card, CatIcon, NoData } from './shared';

function Delta({ cur, prev, invert = false }: { cur: number; prev: number | undefined; invert?: boolean }) {
  if (prev == null || prev === 0) return null;
  const d = (cur - prev) / Math.abs(prev);
  if (!Number.isFinite(d)) return null;
  const good = invert ? d <= 0 : d >= 0;
  return (
    <span className={`delta ${good ? 'up' : 'down'}`}>
      {d >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {pct(Math.abs(d))}
    </span>
  );
}

function Kpi({ label, value, icon, color, foot }: { label: string; value: string; icon: React.ReactNode; color: string; foot?: React.ReactNode }) {
  return (
    <div className="card kpi">
      <div className="kpi-glow" style={{ background: color }} />
      <div className="kpi-label">
        <div className="kpi-ico" style={{ background: color + '22', color }}>{icon}</div>
        {label}
      </div>
      <div className="kpi-value num">{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export function KpiRow({ d }: { d: AppData }) {
  const T = totals(d.ctx);
  const P = d.prevCtx ? totals(d.prevCtx) : null;
  const lastBal = [...d.ctx.all].reverse().find((t) => t.balance != null);
  const firstBal = d.ctx.all.find((t) => t.balance != null);
  const startBal = firstBal ? firstBal.balance! - firstBal.amount : null;
  const vs = P ? <span>vs. perioada anterioară</span> : null;
  return (
    <div className="kpis">
      <Kpi label="Venituri" value={d.fmt(T.income, 0)} icon={<TrendingUp size={16} />} color="#34d399"
        foot={<><Delta cur={T.income} prev={P?.income} />{vs ?? <span>{d.ctx.income.length} încasări</span>}</>} />
      <Kpi label="Cheltuieli" value={d.fmt(T.spend, 0)} icon={<TrendingDown size={16} />} color="#a78bfa"
        foot={<><Delta cur={T.spend} prev={P?.spend} invert />{vs ?? <span>{T.spendCount} plăți</span>}<span>· ~{d.fmt(T.avgDaily, 0)}/zi</span></>} />
      <Kpi label="Economisit (net)" value={d.fmt(T.net, 0)} icon={<PiggyBank size={16} />} color={T.net >= 0 ? '#22d3ee' : '#fb7185'}
        foot={T.savingsRate != null ? <span className={T.savingsRate >= 0 ? 'pos' : 'red'}>{pct(T.savingsRate)} rată de economisire</span> : undefined} />
      <Kpi label="Sold la final de perioadă" value={lastBal ? d.fmt(lastBal.balance!, 0) : '—'} icon={<Wallet size={16} />} color="#f472b6"
        foot={startBal != null && lastBal ? <><Delta cur={lastBal.balance!} prev={startBal} /><span>de la {d.fmt(startBal, 0)} la început</span></> : undefined} />
    </div>
  );
}

export function donutOption(c: Ctx, fmt: (v: number) => string): EChartsOption {
  const cats = byCategory(c.spend);
  const total = cats.reduce((s, x) => s + x.total, 0);
  const totalText = fmt(total).replace(/,\d\d(?=\s)/, '');
  return {
    tooltip: { trigger: 'item', valueFormatter: (v) => fmt(Number(v)) },
    title: {
      text: totalText,
      subtext: 'cheltuieli totale',
      left: 'center', top: '40%',
      textStyle: { fontFamily: 'Space Grotesk Variable', fontSize: totalText.length > 10 ? 17 : totalText.length > 8 ? 19 : 22, fontWeight: 700, color: '#e8ebff' },
      subtextStyle: { color: '#6b7299', fontSize: 12 },
    },
    series: [
      {
        type: 'pie', radius: ['66%', '90%'], center: ['50%', '50%'], padAngle: 2,
        itemStyle: { borderRadius: 8, borderColor: 'rgba(6,7,26,0.6)', borderWidth: 1 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 6, label: { show: false } },
        data: cats.map((x) => ({ name: CAT[x.cat]?.name ?? x.cat, value: Math.round(x.total * 100) / 100, id: x.cat, itemStyle: { color: CAT[x.cat]?.color } })),
      },
    ],
  };
}

const DISMISS_KEY = 'mwr.dismissed.v1';
function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
  } catch {
    return [];
  }
}

function SelfTransferHint({ d }: { d: AppData }) {
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  const cands = useMemo(() => selfTransferCandidates(d.all).filter((c) => !dismissed.includes(c.key)), [d.all, dismissed]);
  if (!cands.length) return null;
  const dismiss = (k: string) => {
    const next = [...dismissed, k];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <Card title={<span className="row"><ArrowLeftRight size={18} color="var(--cyan)" /> Sunt acestea conturile tale?</span>}
      sub="Am găsit transferuri frecvente în ambele sensuri. Dacă e un cont propriu (altă bancă, Revolut etc.), marchează-l ca să nu fie numărat la venituri și cheltuieli.">
      <div className="rank">
        {cands.slice(0, 4).map((c) => (
          <div key={c.key} className="row wrap" style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(14,16,40,.5)', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div className="rank-name">{c.name}</div>
              <div className="faint" style={{ fontSize: 12 }}>
                <span className="pos">+{d.fmt(c.inSum, 0)}</span> în {c.inCount} încasări · −{d.fmt(c.outSum, 0)} în {c.outCount} transferuri
              </div>
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => d.setOverride(c.key, 'own-transfer')}>Da, e contul meu</button>
              <button className="btn ghost sm" onClick={() => dismiss(c.key)}>Nu</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Overview({ d }: { d: AppData }) {
  const { ctx, fmt } = d;
  const cash = useMemo(() => cashflowOption(ctx, fmt), [ctx, fmt]);
  const donut = useMemo(() => donutOption(ctx, fmt), [ctx, fmt]);
  const bal = useMemo(() => balanceOption(d.all, ctx.from, ctx.to, fmt), [d.all, ctx.from, ctx.to, fmt]);
  const insights = useMemo(() => {
    const list = buildInsights(ctx, (v) => fmt(v, 0), d.recurring);
    const { settings, incomeMode } = loadLoanSettings();
    const la = analyzeLoans(d.all, settings, d.dataTo, incomeMode, d.excluded);
    if (la.dti != null && la.currentService > 0) {
      const z = dtiZone(la.dti);
      const pendingNew = la.loans.some((l) => l.status === 'nou' && settings[l.key]?.manualRate == null);
      list.splice(1, 0, {
        icon: 'Landmark',
        tone: la.dti < 0.3 ? 'good' : la.dti < 0.4 ? 'neutral' : 'bad',
        title: 'Grad de îndatorare',
        value: pct(la.dti, 1),
        text: `Rate de ${fmt(la.currentService, 0)}/lună din ${la.incomeLabel} de ${fmt(la.incomeBasis, 0)}. ${z.label}.${pendingNew ? ' Atenție: un credit nou nu are încă rata introdusă.' : ''}`,
      });
    }
    return list;
  }, [ctx, fmt, d.recurring, d.all, d.dataTo, d.excluded]);
  const cats = useMemo(() => byCategory(ctx.spend), [ctx]);
  const merchants = useMemo(() => byMerchant(ctx.spend).slice(0, 7), [ctx]);
  const biggest = useMemo(() => [...ctx.spend].sort((a, b) => a.amount - b.amount).slice(0, 6), [ctx]);
  const upcoming = useMemo(() => [...d.recurring].sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1)).slice(0, 6), [d.recurring]);

  if (!ctx.all.length) return <NoData />;

  return (
    <div className="stack">
      <KpiRow d={d} />
      <SelfTransferHint d={d} />

      <div className="grid g-21">
        <Card title="Cashflow" sub="Venituri vs. cheltuieli în perioada selectată">
          <EChart option={cash} height={300} />
        </Card>
        <Card title="Pe ce s-au dus banii" sub="Click pe o felie pentru detalii">
          <EChart option={donut} height={230} onClick={(p) => d.peekTx({ cat: (p.data as { id: string }).id, dir: 'out' })} />
          <div className="legend-list" style={{ marginTop: 10 }}>
            {cats.slice(0, 8).map((x) => (
              <span key={x.cat} onClick={() => d.peekTx({ cat: x.cat, dir: 'out' })}>
                <i className="dot" style={{ background: CAT[x.cat]?.color }} />
                {CAT[x.cat]?.name} <b className="num" style={{ color: 'var(--text)' }}>{pct(x.share)}</b>
              </span>
            ))}
          </div>
        </Card>
      </div>

      {insights.length > 0 && (
        <Card title="Observații" sub="Generate automat din tranzacțiile tale">
          <div className="insights">
            {insights.map((i, k) => (
              <div className={`insight tone-${i.tone}`} key={k}>
                <div className="insight-top">
                  <div className="insight-ico"><Icon name={i.icon} size={17} /></div>
                  <div className="insight-title">{i.title}</div>
                  {i.value && <div className="insight-val">{i.value}</div>}
                </div>
                <div className="insight-text">{i.text}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid g-21">
        <Card title="Evoluția soldului" sub="Pe baza soldului raportat de bancă după fiecare zi">
          {bal ? <EChart option={bal} height={280} /> : <NoData text="Nu există suficiente date de sold." />}
        </Card>
        <Card title="Top comercianți" sub="După suma cheltuită">
          <div className="rank">
            {merchants.map((m) => (
              <div className="rank-item" key={m.key} onClick={() => d.peekTx({ merchant: m.key })}>
                <CatIcon cat={m.cat} />
                <div style={{ minWidth: 0 }}>
                  <div className="rank-name">{m.name}</div>
                  <div className="rank-bar"><i style={{ width: `${(m.total / merchants[0].total) * 100}%`, background: CAT[m.cat]?.color }} /></div>
                </div>
                <div className="rank-val">
                  <b>{fmt(m.total, 0)}</b>
                  <div>{m.count}× · ~{fmt(m.avg, 0)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-2">
        <Card title="Cele mai mari cheltuieli">
          <div className="rank">
            {biggest.map((t) => (
              <div className="rank-item" key={t.id} onClick={() => d.peekTx({ merchant: t.mkey })}>
                <CatIcon cat={t.cat} />
                <div style={{ minWidth: 0 }}>
                  <div className="rank-name">{t.merchant}</div>
                  <div className="faint" style={{ fontSize: 11.5 }}>{dateLabel(t.date)} · {CAT[t.cat]?.name}</div>
                </div>
                <div className="rank-val"><b>{fmt(-t.amount)}</b></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Următoarele plăți recurente" sub="Estimate pe baza istoricului" actions={<button className="btn ghost sm" onClick={() => d.setView('recurring')}>Vezi toate</button>}>
          {upcoming.length ? (
            <div className="rank">
              {upcoming.map((r) => (
                <div className="rank-item" key={r.key} onClick={() => d.peekTx({ merchant: r.key })}>
                  <CatIcon cat={r.cat} />
                  <div style={{ minWidth: 0 }}>
                    <div className="rank-name">{r.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      <CalendarClock size={11} style={{ verticalAlign: -1 }} /> ~{dateLabel(r.nextDate)}
                    </div>
                  </div>
                  <div className="rank-val"><b>{fmt(r.last)}</b><div>{fmt(r.annual, 0)}/an</div></div>
                </div>
              ))}
            </div>
          ) : (
            <NoData text="Încă nu am detectat plăți recurente (ai nevoie de cel puțin 2–3 luni de date)." />
          )}
        </Card>
      </div>
    </div>
  );
}
