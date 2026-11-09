const cache = new Map<string, Intl.NumberFormat>();

function nf(currency: string, digits: number) {
  const k = currency + digits;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat('ro-RO', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(k, f);
  }
  return f;
}

export function money(v: number, currency = 'RON', digits?: number) {
  const d = digits ?? (Math.abs(v) >= 1000 ? 0 : 2);
  return nf(currency, d).format(v);
}

export function compact(v: number) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (a >= 1e4) return Math.round(v / 1e3) + 'k';
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace('.', ',') + 'k';
  return String(Math.round(v));
}

export const num = (v: number, d = 0) => v.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`;

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
