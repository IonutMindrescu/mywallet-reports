/** Synthetic 12-month statement in the Banca Transilvania CSV layout — for demo & tests. */

const MONTHS_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtNum = (v: number) => {
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
};
const dLong = (d: Date) => `${pad(d.getDate())} ${MONTHS_RO[d.getMonth()]} ${d.getFullYear()}`;
const dShort = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

interface Ev {
  date: Date;
  type: string;
  amount: number; // signed
  details: string[];
}

export function generateDemoCsv(endDate = new Date(), months = 12, seed = 42): string {
  const rnd = mulberry32(seed);
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const ri = (a: number, b: number) => Math.floor(r(a, b + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const money = (a: number, b: number) => Math.round(r(a, b) * 100) / 100;

  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1);
  const evs: Ev[] = [];
  let auth = 100000 + ri(0, 800000);

  const pos = (date: Date, merchant: string, amount: number, type = 'Cumparare POS') => {
    const authDate = addDays(date, -ri(0, 2) || 0);
    evs.push({
      date,
      type,
      amount: -amount,
      details: [
        `Data finalizarii (decontarii): ${dShort(date)}`,
        'Numar card:**** 7822',
        `Tranzactie la:${merchant}`,
        `Data autorizarii:${dShort(authDate < start ? date : authDate)}`,
        `Numar autorizare:${String(auth++).padStart(6, '0')}`,
      ],
    });
  };
  const opOut = (date: Date, who: string, detail: string, amount: number, type = 'Plata OP intra - canal electronic') =>
    evs.push({ date, type, amount: -amount, details: [`Beneficiar:${who}`, 'IBAN beneficiar:RO02BTRLRONCRT0000000001', `Detalii:${detail}`, `Referinta:${ri(10000000, 99999999)}`] });
  const opIn = (date: Date, who: string, detail: string, amount: number, type = 'Incasare OP - canal electronic') =>
    evs.push({ date, type, amount, details: [`Ordonator:${who}`, `Detalii:${detail}`, `Referinta:${ri(10000000, 99999999)}`] });

  const groceries = ['KAUFLAND 6100  RO  BUCURESTI', 'LIDL 0123  RO  BUCURESTI', 'MEGA IMAGE 0432  RO  BUCURESTI', 'CARREFOUR MARKET  RO  BUCURESTI', 'PROFI 1820  RO  BUCURESTI', 'PENNY 3321  RO  BUCURESTI'];
  const restaurants = ['STARBUCKS COFFEE  RO  BUCURESTI', 'MC DONALDS 042  RO  BUCURESTI', '5 TO GO 117  RO  BUCURESTI', 'TRATTORIA IL CALCIO  RO  BUCURESTI', 'SALAD BOX  RO  BUCURESTI', 'BISTRO LA CASA  RO  BUCURESTI', 'SUSHI TERRA  RO  BUCURESTI'];
  const delivery = ['GLOVO PRIME  RO  BUCURESTI', 'TAZZ BY EMAG  RO  BUCURESTI', 'WOLT ROMANIA  RO  BUCURESTI', 'BOLT FOOD  EE  TALLINN'];
  const fuel = ['OMV 2241  RO  BUCURESTI', 'PETROM 1102  RO  BUCURESTI', 'MOL 0921  RO  ILFOV', 'ROMPETROL 33  RO  BUCURESTI'];
  const online = ['PayU*emag.ro  RO  ROMANIA', 'PayU*sameday.ro  RO  ROMANIA', 'AMAZON MKTPLACE  LU  LUXEMBOURG', 'TEMU.COM  IE  DUBLIN', 'PayU*fashiondays.ro  RO  ROMANIA'];
  const health = ['CATENA 0113  RO  BUCURESTI', 'DR MAX 221  RO  BUCURESTI', 'HELP NET 08  RO  BUCURESTI', 'REGINA MARIA  RO  BUCURESTI'];
  const misc = ['ZARA 5521  RO  BUCURESTI', 'H&M 0711  RO  BUCURESTI', 'IKEA PALLADY  RO  BUCURESTI', 'DEDEMAN 22  RO  BUCURESTI', 'DECATHLON  RO  BUCURESTI', 'CARTURESTI VERONA  RO  BUCURESTI', 'CINEMA CITY AFI  RO  BUCURESTI', 'NOTINO.RO  RO  ROMANIA', 'ALTEX 0042  RO  BUCURESTI', 'ANIMAX 12  RO  BUCURESTI'];

  for (let m = 0; m < months; m++) {
    const y = start.getFullYear();
    const mo = start.getMonth() + m;
    const day = (d: number) => new Date(y, mo, Math.min(d, new Date(y, mo + 1, 0).getDate()));
    const monthDate = day(1);
    const monthIdx = monthDate.getMonth();
    const winter = [11, 0, 1, 2].includes(monthIdx);
    const summer = [6, 7].includes(monthIdx);
    const december = monthIdx === 11;
    const prevMonthName = MONTHS_RO[(monthIdx + 11) % 12];

    opIn(day(10), 'ACME SOFTWARE SRL', `Salariu ${prevMonthName}`, money(11150, 11300));
    if (december) opIn(day(18), 'ACME SOFTWARE SRL', 'Bonus anual', 3500);
    if (rnd() < 0.35) opIn(day(ri(1, 28)), 'IONESCU ANDREI', 'Bani bilete concert', money(80, 250), 'Incasare instant');

    opOut(day(3), 'POPESCU MARIA', `Chirie ${MONTHS_RO[monthIdx]}`, 2200);
    evs.push({ date: day(11), type: 'Transfer intre conturi proprii', amount: -1000, details: ['Beneficiar:ION DEMO', 'Detalii:Economii lunare'] });
    pos(day(5), 'ENEL ENERGIE MUNTENIA  RO  BUCURESTI', money(winter ? 230 : 140, winter ? 320 : 190), 'Plata utilitati');
    if (winter || rnd() < 0.4) pos(day(6), 'ENGIE ROMANIA  RO  BUCURESTI', money(winter ? 260 : 60, winter ? 420 : 110), 'Plata utilitati');
    pos(day(7), 'DIGI ROMANIA  RO  BUCURESTI', 61.5);
    pos(day(8), 'ORANGE ROMANIA  RO  BUCURESTI', 55);
    pos(day(14), 'NETFLIX.COM  NL  AMSTERDAM', 59.99);
    pos(day(16), 'Spotify AB  SE  STOCKHOLM', 26.99);
    pos(day(20), 'OPENAI *CHATGPT SUBSCR  US  SAN FRANCISCO', money(103, 109));
    pos(day(2), 'WORLD CLASS ROMANIA  RO  BUCURESTI', 249);
    evs.push({ date: day(28), type: 'Comision administrare cont', amount: -9.9, details: ['Pachet Star Forte'] });

    const nG = ri(9, 14) + (december ? 4 : 0);
    for (let i = 0; i < nG; i++) pos(day(ri(1, 28)), pick(groceries), money(35, i % 4 === 0 ? 520 : 210));
    const nR = ri(5, 10);
    for (let i = 0; i < nR; i++) pos(day(ri(1, 28)), pick(restaurants), money(18, 190));
    const nD = ri(3, 8);
    for (let i = 0; i < nD; i++) pos(day(ri(1, 28)), pick(delivery), money(45, 140));
    const nB = ri(5, 12);
    for (let i = 0; i < nB; i++) pos(day(ri(1, 28)), 'BOLT.EU/R/2211  EE  TALLINN', money(14, 48));
    for (let i = 0; i < ri(2, 4); i++) pos(day(ri(1, 28)), pick(fuel), money(190, 300));
    for (let i = 0; i < ri(1, 3) + (december ? 4 : 0); i++) pos(day(ri(1, 28)), pick(online), money(60, december ? 900 : 420));
    if (rnd() < 0.6) pos(day(ri(1, 28)), pick(health), money(30, 260));
    for (let i = 0; i < ri(1, 3) + (december ? 2 : 0); i++) pos(day(ri(1, 28)), pick(misc), money(40, 480));
    if (rnd() < 0.8) {
      const atm = ri(1, 28);
      evs.push({ date: day(atm), type: 'Retragere numerar ATM', amount: -pick([200, 300, 500]), details: [`Tranzactie la:BT ATM ${ri(100, 999)}  RO  BUCURESTI`, 'Numar card:**** 7822', `Numar autorizare:${auth++}`] });
    }
    if (rnd() < 0.5) opOut(day(ri(1, 28)), 'IONESCU ANDREI', 'Cadou ziua lui Mihai', money(50, 200), 'Transfer BT Pay');
    if (rnd() < 0.3) pos(day(ri(1, 28)), 'Revolut**4231*  LT  VILNIUS', pick([200, 300, 500]), 'Alimentare card Revolut');
    if (summer) {
      pos(day(ri(1, 10)), 'WIZZ AIR HU  HU  BUDAPEST', money(650, 1100));
      pos(day(ri(10, 20)), 'BOOKING.COM HOTEL  NL  AMSTERDAM', money(1400, 2400));
      for (let i = 0; i < 5; i++) pos(day(ri(18, 28)), 'TAVERNA MYKONOS  GR  MYKONOS', money(90, 260));
    }
    if (monthIdx === 3) pos(day(12), 'ALLIANZ TIRIAC RCA  RO  BUCURESTI', 1240);
    if (monthIdx === 4) pos(day(22), 'GHISEUL.RO IMPOZIT AUTO  RO  BUCURESTI', 386);
    if (m === 4) evs.push({ date: day(19), type: 'Incasare OP - canal electronic', amount: 289.99, details: ['Ordonator:DANTE INTERNATIONAL SA', 'Detalii:Retur comanda emag 3311'] });
    // Two identical purchases on the same day (should NOT be deduped)
    if (m === 2) {
      pos(day(15), 'MEGA IMAGE 0432  RO  BUCURESTI', 23.45);
      pos(day(15), 'MEGA IMAGE 0432  RO  BUCURESTI', 23.45);
    }
  }

  const list = evs.filter((e) => e.date >= start && e.date <= end).sort((a, b) => a.date.getTime() - b.date.getTime());

  const lines: string[] = [];
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  lines.push('Extras de cont,,,,,,,');
  lines.push('Titular cont:,ION DEMO,,,,,,');
  lines.push('Cod IBAN:,RO49BTRLRONCRT0123456789,,,,,,');
  lines.push('Valuta:,RON,,,,,,');
  lines.push(`Perioada:,${dShort(start)} - ${dShort(end)},,,,,,`);
  lines.push(',,,,,,,');
  lines.push('Data,,,Detalii tranzactie,Debit,,Credit,Balanta');
  let balance = 6420.35;
  lines.push(`,,,SOLD ANTERIOR,,,,${q(fmtNum(balance))}`);
  let i = 0;
  while (i < list.length) {
    const dayKey = list[i].date.getTime();
    let dDeb = 0, dCred = 0;
    while (i < list.length && list[i].date.getTime() === dayKey) {
      const e = list[i];
      balance = Math.round((balance + e.amount) * 100) / 100;
      const deb = e.amount < 0 ? q(fmtNum(-e.amount)) : '';
      const cred = e.amount > 0 ? q(fmtNum(e.amount)) : '';
      if (e.amount < 0) dDeb += -e.amount; else dCred += e.amount;
      lines.push(`${dLong(e.date)},,,${q(e.type)},${deb},,${cred},${q(fmtNum(balance))}`);
      for (const d of e.details) lines.push(`,,,${q(d)},,,,`);
      i++;
    }
    lines.push(`,,,RULAJ ZI,${q(fmtNum(dDeb))},,${q(fmtNum(dCred))},`);
    lines.push(`,,,SOLD FINAL ZI,,,,${q(fmtNum(balance))}`);
  }
  lines.push(',,,,,,,');
  lines.push(`,,,SOLD FINAL CONT,,,,${q(fmtNum(balance))}`);
  return lines.join('\n');
}
