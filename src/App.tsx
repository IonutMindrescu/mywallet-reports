import { CalendarRange, ChartPie, CircleAlert, CircleCheck, Landmark, LayoutDashboard, List, Repeat, Store, Waves } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileManager } from './components/FileManager';
import { PeriodBar, type Period, resolvePeriod } from './components/PeriodBar';
import { buildCtx, detectRecurring, isoOf, toDate } from './lib/analytics';
import { configureMonths, detectPayday, type MonthMode, monthOf, monthStart, shiftKey } from './lib/months';
import { categorize, DEFAULT_EXCLUDED } from './lib/categories';
import { decodeBytes } from './lib/csv';
import { generateDemoCsv } from './lib/demo';
import { money } from './lib/format';
import { parseStatement } from './lib/parser';
import { loadNotOwn, makeStoredFile, mergeFiles, store, StorageFullError } from './lib/storage';
import type { StoredFile } from './lib/types';
import { Empty } from './views/Empty';
import { Overview } from './views/Overview';
import { Categories } from './views/Categories';
import { Merchants } from './views/Merchants';
import { Patterns } from './views/Patterns';
import { RecurringView } from './views/Recurring';
import { Flow } from './views/Flow';
import { Loans } from './views/Loans';
import { Transactions } from './views/Transactions';
import type { AppData, TxFilter, ViewId } from './views/shared';
import { Logo } from './components/Logo';

const VIEWS: { id: ViewId; label: string; icon: typeof List; sub: string }[] = [
  { id: 'overview', label: 'Prezentare', icon: LayoutDashboard, sub: 'Imaginea de ansamblu a banilor tăi' },
  { id: 'categories', label: 'Categorii', icon: ChartPie, sub: 'Pe ce se duc banii, la nivel de categorie și comerciant' },
  { id: 'merchants', label: 'Comercianți', icon: Store, sub: 'Unde cheltuiești cel mai des și cel mai mult' },
  { id: 'patterns', label: 'Tipare & calendar', icon: CalendarRange, sub: 'Când cheltuiești: zile, săptămâni, ritm lunar' },
  { id: 'recurring', label: 'Recurente', icon: Repeat, sub: 'Abonamente și plăți care se repetă lunar' },
  { id: 'loans', label: 'Credite & îndatorare', icon: Landmark, sub: 'Ratele lunare pe fiecare credit și gradul tău de îndatorare' },
  { id: 'flow', label: 'Flux de bani', icon: Waves, sub: 'De unde vin banii și unde pleacă' },
  { id: 'transactions', label: 'Tranzacții', icon: List, sub: 'Toate tranzacțiile, cu căutare și recategorisire' },
];

interface Toast {
  id: number;
  text: string;
  err?: boolean;
}

export function App() {
  const [files, setFiles] = useState<StoredFile[]>(() => store.loadFiles());
  const [overrides, setOverrides] = useState<Record<string, string>>(() => store.loadOverrides());
  const [excluded, setExcluded] = useState<string[]>(() => store.loadExcluded() ?? DEFAULT_EXCLUDED);
  const prefs = useMemo(() => store.loadPrefs(), []);
  const [view, setView] = useState<ViewId>((prefs.view as ViewId) ?? 'overview');
  const [period, setPeriod] = useState<Period>((prefs.period as Period) ?? { kind: 'all' });
  const [currency, setCurrency] = useState<string>((prefs.currency as string) ?? '');
  const [monthMode, setMonthMode] = useState<MonthMode>((prefs.monthMode as MonthMode) ?? 'calendar');
  const [paydayPref, setPaydayPref] = useState<number | null>((prefs.payday as number) ?? null);
  const [txFilter, setTxFilter] = useState<TxFilter>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [usage, setUsage] = useState(() => store.usageBytes());

  const toast = useCallback((text: string, err = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), err ? 7000 : 4500);
  }, []);

  const persistFiles = useCallback(
    (next: StoredFile[]) => {
      try {
        store.saveFiles(next);
        setFiles(next);
        setUsage(store.usageBytes());
        return true;
      } catch (e) {
        toast(e instanceof StorageFullError ? e.message : 'Nu am putut salva în browser: ' + String(e), true);
        return false;
      }
    },
    [toast],
  );

  useEffect(() => {
    try {
      store.savePrefs({ view, period, currency, monthMode, payday: paydayPref });
    } catch {
      /* non-critical */
    }
  }, [view, period, currency, monthMode, paydayPref]);

  const addParsed = useCallback(
    (entries: StoredFile[]) => {
      if (!entries.length) return;
      const existing = new Set(files.flatMap((f) => f.txs.map((t) => t.id)));
      const accepted: StoredFile[] = [];
      for (const f of entries) {
        const dup = f.txs.filter((t) => existing.has(t.id)).length;
        if (f.txs.length && dup === f.txs.length) {
          toast(`„${f.name}” pare deja încărcat — toate cele ${dup} tranzacții există deja.`, true);
          continue;
        }
        accepted.push(f);
        f.txs.forEach((t) => existing.add(t.id));
        toast(
          `✓ ${f.name}: ${f.count} tranzacții încărcate${dup ? ` (${dup} suprapuse cu alte fișiere — numărate o singură dată)` : ''}.`,
        );
      }
      if (accepted.length && persistFiles([...files, ...accepted])) {
        setPeriod({ kind: 'all' });
      }
    },
    [files, persistFiles, toast],
  );

  const onFiles = useCallback(
    async (list: File[]) => {
      const parsed: StoredFile[] = [];
      for (const file of list) {
        try {
          const text = decodeBytes(await file.arrayBuffer());
          const res = parseStatement(text);
          if (!res.txs.length) {
            toast(`„${file.name}”: nu am găsit nicio tranzacție.`, true);
            continue;
          }
          parsed.push(makeStoredFile(file.name, res.txs, res.currency, res.iban));
        } catch (e) {
          toast(`„${file.name}”: ${e instanceof Error ? e.message : String(e)}`, true);
        }
      }
      addParsed(parsed);
    },
    [addParsed, toast],
  );

  const onDemo = useCallback(() => {
    const today = new Date();
    const res = parseStatement(generateDemoCsv(today, 12, Math.floor(Math.random() * 1000)));
    addParsed([makeStoredFile('demo-extras-12-luni.csv', res.txs, res.currency, res.iban)]);
  }, [addParsed]);

  const onDelete = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (persistFiles(files.filter((x) => x.id !== id)) && f) toast(`Am șters „${f.name}” din browser.`);
  };
  const onClear = () => {
    store.clearAll();
    setFiles([]);
    setOverrides({});
    setExcluded(DEFAULT_EXCLUDED);
    setUsage(store.usageBytes());
    toast('Toate datele au fost șterse din browser.');
  };

  const setOverride = useCallback(
    (key: string, cat: string | null) => {
      setOverrides((prev) => {
        const next = { ...prev };
        if (cat) next[key] = cat;
        else delete next[key];
        try {
          store.saveOverrides(next);
        } catch (e) {
          toast(String(e), true);
        }
        return next;
      });
    },
    [toast],
  );
  const toggleExcluded = useCallback((cat: string) => {
    setExcluded((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      try {
        store.saveExcluded(next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ---- Derived data
  const currencies = useMemo(() => [...new Set(files.map((f) => f.currency))], [files]);
  const activeCurrency = currencies.includes(currency) ? currency : currencies[0] ?? 'RON';
  const merged = useMemo(() => mergeFiles(files.filter((f) => f.currency === activeCurrency)), [files, activeCurrency]);
  const all = useMemo(() => categorize(merged, overrides, loadNotOwn()), [merged, overrides]);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);
  // Month buckets: calendar months or salary cycles (configured before any month-based computation).
  const salaryInfo = useMemo(() => detectPayday(all.filter((t) => t.cat === 'salary' && t.amount > 0).map((t) => ({ date: t.date, amount: t.amount }))), [all]);
  const payday = paydayPref ?? salaryInfo.payday ?? 10;
  const monthCfg = useMemo(() => {
    configureMonths(monthMode, payday, salaryInfo.main);
    return `${monthMode}:${payday}:${salaryInfo.main.length}`;
  }, [monthMode, payday, salaryInfo]);
  const dataFrom = all[0]?.date ?? isoOf(new Date());
  const dataTo = all[all.length - 1]?.date ?? isoOf(new Date());
  const { from, to } = resolvePeriod(period, dataFrom, dataTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => buildCtx(all, from, to, excludedSet), [all, from, to, excludedSet, monthCfg]);
  const prevCtx = useMemo(() => {
    const len = Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000) + 1;
    const pTo = isoOf(new Date(toDate(from).getTime() - 86400000));
    let pFrom: string;
    if (period.kind === 'month' || /^\d+m$/.test(period.kind)) {
      // Aligned to month buckets (calendar months or salary cycles)
      const n = period.kind === 'month' ? 1 : parseInt(period.kind, 10);
      pFrom = monthStart(shiftKey(monthOf(from), -n));
    } else {
      pFrom = isoOf(new Date(toDate(from).getTime() - len * 86400000));
    }
    if (pTo < dataFrom) return null;
    return buildCtx(all, pFrom < dataFrom ? dataFrom : pFrom, pTo, excludedSet);
  }, [all, from, to, period.kind, dataFrom, excludedSet, monthCfg]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recurring = useMemo(() => detectRecurring(all, excludedSet), [all, excludedSet, monthCfg]);
  const fmt = useCallback((v: number, d?: number) => money(v, activeCurrency, d), [activeCurrency]);

  const goTx = useCallback((f: TxFilter) => {
    setTxFilter(f);
    setView('transactions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const data: AppData = {
    ctx, prevCtx, all, recurring, fmt, currency: activeCurrency, excluded: excludedSet, toggleExcluded,
    overrides, setOverride, goTx, txFilter, setTxFilter, dataFrom, dataTo, setView,
  };

  const hasData = files.length > 0;
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];

  return (
    <>
      <div className="aurora"><span /></div>
      <div className="grain" />
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <Logo size={42} />
            <div>
              <div className="brand-name">MyWallet Reports</div>
              <div className="brand-sub">Analiza contului tău, 100% local</div>
            </div>
          </div>

          {hasData && (
            <nav className="nav">
              {VIEWS.map((v) => (
                <button key={v.id} className={`nav-item ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
                  <v.icon size={18} />
                  {v.label}
                  {v.id === 'recurring' && recurring.length > 0 && <span className="badge">{recurring.length}</span>}
                </button>
              ))}
            </nav>
          )}

          <div style={{ marginTop: hasData ? 'auto' : 0 }}>
            <FileManager files={files} usage={usage} onFiles={onFiles} onDelete={onDelete} onClear={onClear} onDemo={onDemo} />
          </div>
        </aside>

        <main className="main">
          {!hasData ? (
            <Empty onFiles={onFiles} onDemo={onDemo} />
          ) : (
            <div key={view} className="fade-in">
              <div className="topbar">
                <div>
                  <h1 className="page-title">{current.label}</h1>
                  <div className="page-sub">{current.sub}</div>
                </div>
                <div className="topbar-right">
                  {currencies.length > 1 && (
                    <div className="seg" title="Monedă">
                      {currencies.map((c) => (
                        <button key={c} className={c === activeCurrency ? 'on' : ''} onClick={() => setCurrency(c)}>{c}</button>
                      ))}
                    </div>
                  )}
                  <PeriodBar period={period} setPeriod={setPeriod} dataFrom={dataFrom} dataTo={dataTo} from={from} to={to}
                    monthMode={monthMode} setMonthMode={setMonthMode} payday={payday} autoPayday={salaryInfo.payday} setPayday={setPaydayPref} />
                </div>
              </div>
              {view === 'overview' && <Overview d={data} />}
              {view === 'categories' && <Categories d={data} />}
              {view === 'merchants' && <Merchants d={data} />}
              {view === 'patterns' && <Patterns d={data} />}
              {view === 'recurring' && <RecurringView d={data} />}
              {view === 'loans' && <Loans d={data} />}
              {view === 'flow' && <Flow d={data} />}
              {view === 'transactions' && <Transactions d={data} />}
            </div>
          )}
        </main>
      </div>
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.err ? 'err' : ''}`}>
            {t.err ? <CircleAlert size={17} color="var(--red)" /> : <CircleCheck size={17} color="var(--green)" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}
